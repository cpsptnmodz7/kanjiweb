"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { aiBudget } from "@/lib/useAI";
import { awardXPAndCoins, bumpDailyMission } from "@/lib/progress";

type Goal = {
    id: string;
    title: string;
    monthly_target: number;
    currency: string;
    is_active: boolean;
};

type Tx = {
    id: string;
    goal_id: string | null;
    amount: number;
    note: string | null;
    occurred_at: string;
};

function idr(n: number) {
    return new Intl.NumberFormat("id-ID").format(n);
}

function ym(d = new Date()) {
    return { y: d.getFullYear(), m: d.getMonth() + 1 };
}

export default function SavingsPage() {
    const [email, setEmail] = useState<string | null>(null);
    const [goals, setGoals] = useState<Goal[]>([]);
    const [tx, setTx] = useState<Tx[]>([]);
    const [activeGoalId, setActiveGoalId] = useState<string | null>(null);

    const [newGoalTitle, setNewGoalTitle] = useState("Target Bulanan");
    const [newGoalTarget, setNewGoalTarget] = useState(1000000);

    const [amount, setAmount] = useState("");
    const [note, setNote] = useState("");

    const [aiLoading, setAiLoading] = useState(false);
    const [aiResult, setAiResult] = useState<any>(null);

    useEffect(() => {
        supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? null));
        loadAll();
    }, []);

    async function loadAll() {
        const { data: g, error: ge } = await supabase
            .from("savings_goals")
            .select("*")
            .order("created_at", { ascending: false });

        if (!ge && g) {
            setGoals(g as any);
            setActiveGoalId((prev) => prev ?? (g[0]?.id ?? null));
        }

        const { data: t, error: te } = await supabase
            .from("savings_transactions")
            .select("*")
            .order("occurred_at", { ascending: false })
            .limit(200);

        if (!te && t) setTx(t as any);
    }

    const activeGoal = useMemo(() => goals.find((g) => g.id === activeGoalId) ?? goals[0] ?? null, [goals, activeGoalId]);

    const monthKey = useMemo(() => {
        const { y, m } = ym(new Date());
        return { y, m };
    }, []);

    const txForActive = useMemo(() => {
        if (!activeGoal) return [];
        return tx.filter((t) => t.goal_id === activeGoal.id);
    }, [tx, activeGoal]);

    const monthTx = useMemo(() => {
        const { y, m } = monthKey;
        return txForActive.filter((t) => {
            const d = new Date(t.occurred_at);
            return d.getFullYear() === y && d.getMonth() + 1 === m;
        });
    }, [txForActive, monthKey]);

    const monthIn = useMemo(() => monthTx.filter(t => t.amount > 0).reduce((a, b) => a + b.amount, 0), [monthTx]);
    const monthOut = useMemo(() => monthTx.filter(t => t.amount < 0).reduce((a, b) => a + Math.abs(b.amount), 0), [monthTx]);
    const monthNet = useMemo(() => monthIn - monthOut, [monthIn, monthOut]);

    const totalNet = useMemo(() => txForActive.reduce((a, b) => a + b.amount, 0), [txForActive]);

    const progressPct = useMemo(() => {
        if (!activeGoal) return 0;
        const tgt = Math.max(1, activeGoal.monthly_target || 1);
        return Math.max(0, Math.min(100, Math.round((monthNet / tgt) * 100)));
    }, [activeGoal, monthNet]);

    const chartPoints = useMemo(() => {
        // 6 bulan terakhir
        if (!activeGoal) return [];
        const now = new Date();
        const points: { label: string; net: number }[] = [];
        for (let i = 5; i >= 0; i--) {
            const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const y = d.getFullYear();
            const m = d.getMonth() + 1;
            const label = `${m}/${String(y).slice(-2)}`;
            const net = txForActive
                .filter((t) => {
                    const td = new Date(t.occurred_at);
                    return td.getFullYear() === y && td.getMonth() + 1 === m;
                })
                .reduce((a, b) => a + b.amount, 0);

            points.push({ label, net });
        }
        return points;
    }, [txForActive, activeGoal]);

    async function createGoal() {
        const title = newGoalTitle.trim();
        if (!title) return;

        const { error } = await supabase.from("savings_goals").insert({
            title,
            monthly_target: newGoalTarget,
            currency: "IDR",
            is_active: true,
        });

        if (!error) {
            setNewGoalTitle("Target Bulanan");
            setNewGoalTarget(1000000);
            await loadAll();
        }
    }

    async function addTx(sign: 1 | -1) {
        if (!activeGoal) return;
        const n = Number(String(amount).replace(/[^\d]/g, ""));
        if (!n || n <= 0) return;

        const { error } = await supabase.from("savings_transactions").insert({
            goal_id: activeGoal.id,
            amount: sign * n,
            note: note.trim() || null,
        });

        if (!error) {
            setAmount("");
            setNote("");
            await loadAll();

            // Gamification: bump mission if saving (positive)
            if (sign === 1 && email) {
                // we need userId, but we have email. 
                // Let's get getUser again or store userId in state.
                supabase.auth.getUser().then(async ({ data }) => {
                    if (data.user) {
                        await bumpDailyMission({
                            userId: data.user.id,
                            missionCode: "save_1",
                            amount: 1
                        });
                    }
                });
            }
        }
    }

    async function runAI() {
        if (!activeGoal) return;
        setAiLoading(true);
        setAiResult(null);
        try {
            const res = await aiBudget({
                currency: activeGoal.currency,
                goals: goals.map((g) => ({
                    title: g.title,
                    monthly_target: g.monthly_target,
                    current_month_net: g.id === activeGoal.id ? monthNet : 0,
                })),
                monthSummary: {
                    income: 0,
                    fixedCosts: 0,
                    variableCosts: 0,
                },
                userNote: "Beri saran yang realistis dan simple untuk saya.",
            });
            setAiResult(res);
        } finally {
            setAiLoading(false);
        }
    }

    // Simple SVG chart
    function MiniChart() {
        const w = 520;
        const h = 140;
        const pad = 12;
        const maxAbs = Math.max(1, ...chartPoints.map((p) => Math.abs(p.net)));
        const xStep = (w - pad * 2) / Math.max(1, chartPoints.length - 1);

        const pts = chartPoints
            .map((p, i) => {
                const x = pad + i * xStep;
                const y = pad + (h - pad * 2) * (0.5 - (p.net / (maxAbs * 2)));
                return `${x},${y}`;
            })
            .join(" ");

        return (
            <div className="card p-5" style={{ overflow: "hidden" }}>
                <div className="h2">Chart (6 bulan)</div>
                <div className="small" style={{ marginTop: 6 }}>Net savings per bulan</div>

                <svg width="100%" viewBox={`0 0 ${w} ${h}`} style={{ marginTop: 10 }}>
                    <defs>
                        <linearGradient id="g" x1="0" x2="1">
                            <stop offset="0" stopColor="rgba(255,45,166,.95)" />
                            <stop offset="1" stopColor="rgba(184,51,255,.75)" />
                        </linearGradient>
                    </defs>
                    <rect x="0" y="0" width={w} height={h} rx="14" fill="rgba(255,255,255,.03)" />
                    <polyline points={pts} fill="none" stroke="url(#g)" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
                </svg>

                <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 8 }}>
                    {chartPoints.map((p) => (
                        <span key={p.label} className="badge">
                            {p.label}: {p.net >= 0 ? "+" : "-"}Rp {idr(Math.abs(p.net))}
                        </span>
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div className="grid cols-2">
            <div className="glass p-6">
                <div className="h1">Celengan</div>
                <div className="small" style={{ marginTop: 6 }}>
                    Login: <b>{email ?? "—"}</b>
                </div>

                <hr className="sep" />

                {/* Goals */}
                <div className="card p-5">
                    <div className="h2">Multi Goals</div>
                    <div className="small" style={{ marginTop: 6 }}>Buat banyak target sekaligus.</div>

                    <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 12 }}>
                        {goals.map((g) => (
                            <button
                                key={g.id}
                                className="btn"
                                style={{
                                    borderColor: g.id === activeGoalId ? "rgba(255,45,166,.35)" : undefined,
                                    background: g.id === activeGoalId ? "linear-gradient(90deg, rgba(255,45,166,.22), rgba(184,51,255,.14))" : undefined,
                                }}
                                onClick={() => setActiveGoalId(g.id)}
                            >
                                {g.title}
                            </button>
                        ))}
                    </div>

                    <div className="grid cols-2" style={{ marginTop: 12 }}>
                        <div>
                            <label className="small">Nama goal</label>
                            <input className="input" value={newGoalTitle} onChange={(e) => setNewGoalTitle(e.target.value)} />
                        </div>
                        <div>
                            <label className="small">Target bulanan</label>
                            <input className="input" value={String(newGoalTarget)} onChange={(e) => setNewGoalTarget(Number(e.target.value.replace(/[^\d]/g, "")))} />
                        </div>
                    </div>

                    <button className="btn btn-primary" style={{ marginTop: 12 }} onClick={createGoal}>
                        + Buat Goal
                    </button>
                </div>

                {/* Stats */}
                <div className="grid cols-2" style={{ marginTop: 14 }}>
                    <div className="card p-5">
                        <div className="small">Total Nabung</div>
                        <div style={{ fontSize: 34, fontWeight: 900, marginTop: 6 }}>Rp {idr(totalNet)}</div>
                        <div className="small">Goal: {activeGoal?.title ?? "—"}</div>
                    </div>
                    <div className="card p-5">
                        <div className="small">Bulan ini</div>
                        <div style={{ fontSize: 34, fontWeight: 900, marginTop: 6 }}>Rp {idr(monthNet)}</div>
                        <div className="small">In: Rp {idr(monthIn)} • Out: Rp {idr(monthOut)}</div>
                    </div>
                </div>

                <div className="card p-5" style={{ marginTop: 14 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                        <div>
                            <div className="h2">Progress bulan ini</div>
                            <div className="small">Target: Rp {idr(activeGoal?.monthly_target ?? 0)} • {progressPct}%</div>
                        </div>
                    </div>

                    <div style={{ marginTop: 12, height: 14, borderRadius: 999, background: "rgba(255,255,255,.08)", overflow: "hidden" }}>
                        <div style={{ width: `${progressPct}%`, height: "100%", background: "linear-gradient(90deg, var(--pink), var(--pink2))" }} />
                    </div>
                </div>

                {/* Add transaction */}
                <div className="card p-5" style={{ marginTop: 14 }}>
                    <div className="h2">Tambah transaksi</div>
                    <div className="small" style={{ marginTop: 6 }}>“Nabung” positif, “Ambil” negatif.</div>

                    <div style={{ marginTop: 12 }}>
                        <label className="small">Nominal</label>
                        <input className="input" placeholder="contoh: 50000" value={amount} onChange={(e) => setAmount(e.target.value)} />
                    </div>

                    <div style={{ marginTop: 12 }}>
                        <label className="small">Catatan (opsional)</label>
                        <input className="input" placeholder="misal: kopi, makan, gaji..." value={note} onChange={(e) => setNote(e.target.value)} />
                    </div>

                    <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 12 }}>
                        <button className="btn btn-primary" onClick={() => addTx(1)}>+ Nabung</button>
                        <button className="btn" onClick={() => addTx(-1)}>- Ambil</button>
                    </div>
                </div>
            </div>

            <div className="grid" style={{ alignContent: "start" }}>
                <MiniChart />

                <div className="card p-5">
                    <div className="h2">AI Budgeting Suggestion</div>
                    <div className="small" style={{ marginTop: 6 }}>
                        AI akan memberi saran split target dan langkah praktis.
                    </div>

                    <button className="btn btn-primary" style={{ marginTop: 12 }} onClick={runAI} disabled={aiLoading}>
                        {aiLoading ? "Thinking…" : "Generate AI Suggestion"}
                    </button>

                    {aiResult && (
                        <div style={{ marginTop: 12 }}>
                            <div className="badge">{aiResult.headline || "AI Result"}</div>

                            <div className="small" style={{ marginTop: 10, lineHeight: 1.6 }}>
                                <b>Safe Monthly Saving:</b>{" "}
                                Rp {idr(aiResult?.plan?.safeMonthlySaving ?? 0)}
                            </div>

                            {!!aiResult?.plan?.suggestedSplit?.length && (
                                <div style={{ marginTop: 10 }}>
                                    <div className="small"><b>Suggested Split</b></div>
                                    <div style={{ display: "grid", gap: 8, marginTop: 8 }}>
                                        {aiResult.plan.suggestedSplit.map((s: any, i: number) => (
                                            <div key={i} className="badge">
                                                {s.goal}: Rp {idr(Number(s.amount || 0))}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {!!aiResult?.tips?.length && (
                                <div style={{ marginTop: 12 }}>
                                    <div className="small"><b>Tips</b></div>
                                    <ul className="small" style={{ marginTop: 8, paddingLeft: 18, lineHeight: 1.7 }}>
                                        {aiResult.tips.map((t: string, i: number) => <li key={i}>{t}</li>)}
                                    </ul>
                                </div>
                            )}

                            {!!aiResult?.warnings?.length && (
                                <div style={{ marginTop: 12 }}>
                                    <div className="small"><b>Warnings</b></div>
                                    <ul className="small" style={{ marginTop: 8, paddingLeft: 18, lineHeight: 1.7 }}>
                                        {aiResult.warnings.map((t: string, i: number) => <li key={i}>{t}</li>)}
                                    </ul>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                <div className="card p-5">
                    <div className="h2">Riwayat (terakhir 20)</div>
                    <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
                        {txForActive.slice(0, 20).map((t) => (
                            <div key={t.id} className="badge" style={{ justifyContent: "space-between" }}>
                                <span>
                                    {t.amount >= 0 ? "+" : "-"}Rp {idr(Math.abs(t.amount))}{" "}
                                    {t.note ? `• ${t.note}` : ""}
                                </span>
                                <span className="small">{new Date(t.occurred_at).toLocaleDateString("id-ID")}</span>
                            </div>
                        ))}
                        {!txForActive.length && <div className="small">Belum ada transaksi.</div>}
                    </div>
                </div>
            </div>
        </div>
    );
}
