"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type Goal = {
    id: string;
    user_id: string;
    name: string;
    target_amount: number;
    color: string | null;
    created_at: string;
    archived: boolean;
};

type Tx = {
    id: string;
    user_id: string;
    goal_id: string | null;
    amount: number; // positive for deposit, negative for withdraw
    note: string | null;
    created_at: string;
};

type AiData = {
    summary: string;
    health_score: number;
    insights: string[];
    next_actions: {
        title: string;
        why: string;
        how: string;
    }[];
    budget_plan: {
        needs_pct: number;
        wants_pct: number;
        savings_pct: number;
        notes: string;
    };
    goal_strategy: string;
    warnings?: string[];
};

function idr(n: number) {
    return new Intl.NumberFormat("id-ID", {
        style: "currency",
        currency: "IDR",
        maximumFractionDigits: 0,
    }).format(Math.round(n || 0));
}

function clamp(n: number, a = 0, b = 1) {
    return Math.max(a, Math.min(b, n));
}

function monthKey(d: Date) {
    const y = d.getFullYear();
    const m = `${d.getMonth() + 1}`.padStart(2, "0");
    return `${y}-${m}`;
}

function monthLabel(key: string) {
    const [y, m] = key.split("-").map((x) => Number(x));
    const dt = new Date(y, m - 1, 1);
    return dt.toLocaleDateString("id-ID", { month: "short" });
}

function startOfMonth(dt = new Date()) {
    return new Date(dt.getFullYear(), dt.getMonth(), 1);
}

function endOfMonth(dt = new Date()) {
    return new Date(dt.getFullYear(), dt.getMonth() + 1, 0, 23, 59, 59, 999);
}


function safeNumber(x: unknown) {
    const n = typeof x === "number" ? x : parseFloat(String(x));
    return Number.isFinite(n) ? n : 0;
}

function genColor(seed: string) {
    // stable-ish neon-ish colors
    const palette = ["#ff4fd8", "#6cf5ff", "#7c5cff", "#55ff9a", "#ffd84f", "#ff6b6b"];
    let h = 0;
    for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
    return palette[h % palette.length];
}

function Card({
    title,
    right,
    children,
    className = "",
}: {
    title?: React.ReactNode;
    right?: React.ReactNode;
    children: React.ReactNode;
    className?: string;
}) {
    return (
        <div
            className={[
                "rounded-2xl border border-white/10 bg-white/[0.06] p-5 backdrop-blur-xl shadow-[0_10px_30px_rgba(0,0,0,0.25)]",
                className,
            ].join(" ")}
        >
            {(title || right) && (
                <div className="mb-4 flex items-start justify-between gap-3">
                    <div className="text-sm font-semibold text-white/90">{title}</div>
                    {right}
                </div>
            )}
            {children}
        </div>
    );
}

function Pill({
    active,
    children,
    onClick,
}: {
    active?: boolean;
    children: React.ReactNode;
    onClick?: () => void;
}) {
    return (
        <button
            onClick={onClick}
            className={[
                "rounded-full px-4 py-2 text-xs font-semibold transition",
                active
                    ? "bg-white/15 text-white border border-white/20"
                    : "bg-white/5 text-white/75 border border-white/10 hover:bg-white/10 hover:text-white",
            ].join(" ")}
        >
            {children}
        </button>
    );
}

function MiniBarChart({
    data,
    height = 120,
}: {
    data: { label: string; value: number }[];
    height?: number;
}) {
    const maxAbs = Math.max(1, ...data.map((d) => Math.abs(d.value)));
    return (
        <div className="w-full">
            <div className="flex items-end gap-2" style={{ height }}>
                {data.map((d) => {
                    const h = Math.round((Math.abs(d.value) / maxAbs) * height);
                    const isNeg = d.value < 0;
                    return (
                        <div key={d.label} className="flex flex-1 flex-col items-center gap-2">
                            <div
                                className={[
                                    "w-full rounded-xl border border-white/10",
                                    isNeg ? "bg-white/5" : "bg-white/5",
                                ].join(" ")}
                                style={{ height }}
                            >
                                <div
                                    className={[
                                        "w-full rounded-xl",
                                        isNeg
                                            ? "bg-gradient-to-b from-red-400/70 to-red-500/20"
                                            : "bg-gradient-to-b from-pink-500/70 to-pink-500/20",
                                    ].join(" ")}
                                    style={{
                                        height: h,
                                        marginTop: height - h,
                                        boxShadow: isNeg
                                            ? "0 10px 25px rgba(255,80,80,0.15)"
                                            : "0 10px 25px rgba(255,79,216,0.18)",
                                    }}
                                />
                            </div>
                            <div className="text-[11px] text-white/60">{d.label}</div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

function RingProgress({
    value,
    label,
    color = "#ff4fd8",
}: {
    value: number; // 0..1
    label: string;
    color?: string;
}) {
    const v = clamp(value, 0, 1);
    const size = 110;
    const stroke = 10;
    const r = (size - stroke) / 2;
    const c = 2 * Math.PI * r;
    const dash = c * v;
    return (
        <div className="flex items-center gap-4">
            <svg width={size} height={size} className="shrink-0">
                <circle
                    cx={size / 2}
                    cy={size / 2}
                    r={r}
                    stroke="rgba(255,255,255,0.12)"
                    strokeWidth={stroke}
                    fill="transparent"
                />
                <circle
                    cx={size / 2}
                    cy={size / 2}
                    r={r}
                    stroke={color}
                    strokeWidth={stroke}
                    fill="transparent"
                    strokeLinecap="round"
                    strokeDasharray={`${dash} ${c - dash}`}
                    transform={`rotate(-90 ${size / 2} ${size / 2})`}
                    style={{
                        filter: "drop-shadow(0 10px 20px rgba(255,79,216,0.22))",
                    }}
                />
                <text
                    x="50%"
                    y="50%"
                    dominantBaseline="middle"
                    textAnchor="middle"
                    fill="rgba(255,255,255,0.92)"
                    fontSize="18"
                    fontWeight="700"
                >
                    {Math.round(v * 100)}%
                </text>
            </svg>
            <div>
                <div className="text-sm font-semibold text-white/90">{label}</div>
                <div className="text-xs text-white/60">Progress target bulan ini</div>
            </div>
        </div>
    );
}


export default function SavingsPage() {
    const router = useRouter();

    const [email, setEmail] = useState<string>("");
    const [userId, setUserId] = useState<string>("");

    const [goals, setGoals] = useState<Goal[]>([]);
    const [activeGoalId, setActiveGoalId] = useState<string>("all"); // "all" | goalId

    const [txs, setTxs] = useState<Tx[]>([]);
    const [loading, setLoading] = useState(true);

    // Inputs
    const [newGoalName, setNewGoalName] = useState("");
    const [newGoalTarget, setNewGoalTarget] = useState("1000000");

    const [targetMonthly, setTargetMonthly] = useState("1000000");

    const [amount, setAmount] = useState("");
    const [note, setNote] = useState("");

    const [aiData, setAiData] = useState<AiData | null>(null);
    const [aiLoading, setAiLoading] = useState(false);
    const [aiError, setAiError] = useState("");

    useEffect(() => {
        (async () => {
            const { data } = await supabase.auth.getSession();
            const session = data.session;

            if (!session) {
                router.push("/login");
                return;
            }

            setEmail(session.user.email || "");
            setUserId(session.user.id);

            await Promise.all([fetchGoals(session.user.id), fetchTxs(session.user.id)]);
            setLoading(false);
        })();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    async function fetchGoals(uid: string) {
        const { data, error } = await supabase
            .from("savings_goals")
            .select("*")
            .eq("user_id", uid)
            .eq("archived", false)
            .order("created_at", { ascending: true });

        if (!error && data) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const normalized = (data as any[]).map((g) => ({
                ...g,
                target_amount: safeNumber(g.target_amount),
            })) as Goal[];
            setGoals(normalized);
        }
    }

    async function fetchTxs(uid: string) {
        const { data, error } = await supabase
            .from("savings_transactions")
            .select("*")
            .eq("user_id", uid)
            .order("created_at", { ascending: false })
            .limit(200);

        if (!error && data) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const normalized = (data as any[]).map((t) => ({
                ...t,
                amount: safeNumber(t.amount),
            })) as Tx[];
            setTxs(normalized);
        }
    }

    const activeGoal = useMemo(() => {
        if (activeGoalId === "all") return null;
        return goals.find((g) => g.id === activeGoalId) || null;
    }, [activeGoalId, goals]);

    const filteredTxs = useMemo(() => {
        if (activeGoalId === "all") return txs;
        return txs.filter((t) => t.goal_id === activeGoalId);
    }, [txs, activeGoalId]);

    const totals = useMemo(() => {
        const total = filteredTxs.reduce((s, t) => s + t.amount, 0);

        const now = new Date();
        const start = startOfMonth(now).getTime();
        const end = endOfMonth(now).getTime();

        const monthTx = filteredTxs.filter((t) => {
            const ts = new Date(t.created_at).getTime();
            return ts >= start && ts <= end;
        });

        const monthDeposits = monthTx.filter((t) => t.amount > 0).reduce((s, t) => s + t.amount, 0);
        const monthWithdrawalsAbs = monthTx
            .filter((t) => t.amount < 0)
            .reduce((s, t) => s + Math.abs(t.amount), 0);

        const monthNet = monthTx.reduce((s, t) => s + t.amount, 0);

        return {
            total,
            monthNet,
            monthDeposits,
            monthWithdrawalsAbs,
            monthTx,
        };
    }, [filteredTxs]);

    const monthlyChart = useMemo(() => {
        // last 6 months net
        const now = new Date();
        const keys: string[] = [];
        for (let i = 5; i >= 0; i--) {
            const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
            keys.push(monthKey(d));
        }

        const map = new Map<string, number>();
        keys.forEach((k) => map.set(k, 0));

        filteredTxs.forEach((t) => {
            const d = new Date(t.created_at);
            const k = monthKey(d);
            if (map.has(k)) map.set(k, (map.get(k) || 0) + t.amount);
        });

        return keys.map((k) => ({
            label: monthLabel(k),
            value: map.get(k) || 0,
        }));
    }, [filteredTxs]);

    const progress = useMemo(() => {
        const target = safeNumber(targetMonthly);
        const p = target > 0 ? totals.monthNet / target : 0;
        return {
            target,
            value: clamp(p, 0, 1),
        };
    }, [totals.monthNet, targetMonthly]);

    async function refreshAiAdvice() {
        if (aiLoading) return;
        setAiLoading(true);
        setAiError("");

        try {
            const payload = {
                currency: "IDR",
                monthlyIncome: 0,
                monthlyTarget: safeNumber(targetMonthly),
                totalSaved: totals.total,
                monthSaved: totals.monthNet,
                transactions: txs.slice(0, 50).map(t => ({
                    amount: t.amount,
                    note: t.note,
                    date: t.created_at
                })),
                goals: goals.map(g => ({
                    name: g.name,
                    target: g.target_amount,
                    saved: txs.filter(t => t.goal_id === g.id).reduce((s, t) => s + t.amount, 0),
                })),
            };

            const res = await fetch("/api/ai/budget", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });

            const json = await res.json();
            if (!json.ok) throw new Error(json.error || "AI error");
            setAiData(json.data);
        } catch (err: unknown) {
            setAiError((err as Error).message || "Gagal memuat saran AI.");
        } finally {
            setAiLoading(false);
        }
    }

    async function onAddTx(sign: 1 | -1) {
        const amt = safeNumber(amount);
        if (!amt || amt <= 0) return;

        const insert = {
            user_id: userId,
            goal_id: activeGoalId === "all" ? null : activeGoalId,
            amount: sign * amt,
            note: note.trim() ? note.trim() : null,
        };

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error } = await supabase.from("savings_transactions").insert(insert as any);
        if (!error) {
            setAmount("");
            setNote("");
            await fetchTxs(userId);
        }
    }

    async function onCreateGoal() {
        const name = newGoalName.trim();
        const target = safeNumber(newGoalTarget);
        if (!name || target <= 0) return;

        const color = genColor(name);

        const { error } = await supabase.from("savings_goals").insert({
            user_id: userId,
            name,
            target_amount: target,
            color,
            archived: false,
        } as any); // eslint-disable-line @typescript-eslint/no-explicit-any

        if (!error) {
            setNewGoalName("");
            setNewGoalTarget("1000000");
            await fetchGoals(userId);
        }
    }

    async function onArchiveGoal(goalId: string) {
        const { error } = await supabase
            .from("savings_goals")
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            .update({ archived: true } as any)
            .eq("id", goalId)
            .eq("user_id", userId);

        if (!error) {
            if (activeGoalId === goalId) setActiveGoalId("all");
            await fetchGoals(userId);
        }
    }

    async function logout() {
        await supabase.auth.signOut();
        router.push("/login");
    }

    if (loading) {
        return (
            <div className="min-h-screen text-white">
                <div className="fixed inset-0 -z-10">
                    <div
                        className="absolute inset-0"
                        style={{
                            backgroundImage: "url(/anime-wallpaper.jpg)",
                            backgroundSize: "cover",
                            backgroundPosition: "center",
                        }}
                    />
                    <div className="absolute inset-0 bg-black/75" />
                </div>
                <div className="mx-auto max-w-6xl px-5 py-10">
                    <div className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-xl">
                        Loading Celengan...
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen text-white">
            {/* BG */}
            <div className="fixed inset-0 -z-10">
                <div
                    className="absolute inset-0"
                    style={{
                        backgroundImage: "url(/anime-wallpaper.jpg)",
                        backgroundSize: "cover",
                        backgroundPosition: "center",
                    }}
                />
                <div className="absolute inset-0 bg-black/70" />
                <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-black/40 to-black/80" />
            </div>

            <div className="mx-auto max-w-6xl px-5 py-6 md:py-10">
                {/* TOP BAR (sticky) */}
                <div className="sticky top-3 z-20 mb-6 rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3 backdrop-blur-xl shadow-[0_10px_30px_rgba(0,0,0,0.35)] md:px-6">
                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                        <div className="flex items-center gap-3">
                            <div className="h-11 w-11 rounded-2xl bg-gradient-to-br from-pink-500 to-purple-500 shadow-[0_12px_30px_rgba(255,79,216,0.18)]" />
                            <div>
                                <div className="text-base font-semibold leading-tight">Celengan</div>
                                <div className="text-xs text-white/60">{email}</div>
                            </div>
                        </div>

                        <div className="flex flex-wrap gap-2">
                            <Pill onClick={() => router.push("/")}>Home</Pill>
                            <Pill onClick={() => router.push("/dashboard")}>Dashboard</Pill>
                            <Pill onClick={() => router.push("/quiz")}>Quiz</Pill>
                            <Pill onClick={() => router.push("/review")}>Review</Pill>
                            <button
                                onClick={logout}
                                className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold text-white/80 hover:bg-white/10 hover:text-white"
                            >
                                Logout
                            </button>
                        </div>
                    </div>
                </div>

                {/* GOAL SELECTOR */}
                <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div className="flex flex-wrap gap-2">
                        <Pill active={activeGoalId === "all"} onClick={() => setActiveGoalId("all")}>
                            Semua Goal
                        </Pill>
                        {goals.map((g) => (
                            <button
                                key={g.id}
                                onClick={() => setActiveGoalId(g.id)}
                                className={[
                                    "rounded-full border px-4 py-2 text-xs font-semibold transition",
                                    activeGoalId === g.id
                                        ? "bg-white/15 text-white border-white/20"
                                        : "bg-white/5 text-white/75 border-white/10 hover:bg-white/10 hover:text-white",
                                ].join(" ")}
                            >
                                <span
                                    className="mr-2 inline-block h-2 w-2 rounded-full align-middle"
                                    style={{ background: g.color || "#ff4fd8" }}
                                />
                                {g.name}
                            </button>
                        ))}
                    </div>

                    <div className="text-xs text-white/60">
                        Tip: Pilih goal untuk transaksi spesifik, atau “Semua Goal” untuk melihat total gabungan.
                    </div>
                </div>

                {/* MAIN GRID */}
                <div className="grid gap-4 md:grid-cols-12">
                    {/* LEFT: Summary + Charts */}
                    <div className="md:col-span-7 space-y-4">
                        <Card
                            title="Ringkasan"
                            right={
                                <div className="text-xs text-white/60">
                                    Bulan ini: <span className="text-white/90 font-semibold">{idr(totals.monthNet)}</span>
                                </div>
                            }
                        >
                            <div className="grid gap-4 sm:grid-cols-2">
                                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                                    <div className="text-xs text-white/60">Total Nabung</div>
                                    <div className="mt-1 text-3xl font-extrabold tracking-tight">{idr(totals.total)}</div>
                                    <div className="mt-2 text-xs text-white/60">
                                        Deposit bulan ini: <span className="text-white/85">{idr(totals.monthDeposits)}</span>
                                        {" • "}
                                        Ambil bulan ini: <span className="text-white/85">{idr(totals.monthWithdrawalsAbs)}</span>
                                    </div>
                                </div>

                                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                                    <div className="flex items-center justify-between gap-3">
                                        <div>
                                            <div className="text-xs text-white/60">Target Bulanan</div>
                                            <div className="mt-1 text-lg font-bold">{idr(safeNumber(targetMonthly))}</div>
                                        </div>
                                        <div className="text-right">
                                            <div className="text-xs text-white/60">Progress</div>
                                            <div className="mt-1 text-lg font-bold">{Math.round(progress.value * 100)}%</div>
                                        </div>
                                    </div>

                                    <div className="mt-3">
                                        <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
                                            <div
                                                className="h-full rounded-full bg-gradient-to-r from-pink-500 to-purple-500"
                                                style={{ width: `${Math.round(progress.value * 100)}%` }}
                                            />
                                        </div>
                                        <div className="mt-3 flex gap-2">
                                            <input
                                                value={targetMonthly}
                                                onChange={(e) => setTargetMonthly(e.target.value)}
                                                inputMode="numeric"
                                                className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none placeholder:text-white/30 focus:border-white/20"
                                                placeholder="Target bulanan"
                                            />
                                            <button
                                                onClick={() => { }}
                                                className="rounded-xl bg-white/10 px-4 py-2 text-sm font-semibold hover:bg-white/20"
                                                title="Target ini dipakai untuk progress & AI suggestion"
                                            >
                                                OK
                                            </button>
                                        </div>
                                        {activeGoal && (
                                            <div className="mt-2 text-xs text-white/55">
                                                Kamu sedang melihat goal: <span className="text-white/80 font-semibold">{activeGoal.name}</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </Card>

                        <Card title="Chart 6 Bulan Terakhir (Net)">
                            <MiniBarChart data={monthlyChart} height={130} />
                            <div className="mt-3 text-xs text-white/55">
                                Bar menunjukkan net per bulan: deposit (+) dikurangi ambil (-).
                            </div>
                        </Card>

                        <Card title="Statistik Bulanan">
                            <div className="grid gap-3 sm:grid-cols-3">
                                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                                    <div className="text-xs text-white/60">Deposit</div>
                                    <div className="mt-1 text-lg font-bold">{idr(totals.monthDeposits)}</div>
                                </div>
                                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                                    <div className="text-xs text-white/60">Ambil</div>
                                    <div className="mt-1 text-lg font-bold">{idr(totals.monthWithdrawalsAbs)}</div>
                                </div>
                                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                                    <div className="text-xs text-white/60">Net</div>
                                    <div className="mt-1 text-lg font-bold">{idr(totals.monthNet)}</div>
                                </div>
                            </div>

                            <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4">
                                <RingProgress value={progress.value} label="Progress target bulanan" color="#ff4fd8" />
                            </div>
                        </Card>
                    </div>

                    {/* RIGHT: Multi Goals + Add Tx + AI */}
                    <div className="md:col-span-5 space-y-4">
                        <Card title="Multi Goal">
                            <div className="grid gap-2">
                                <div className="text-xs text-white/60">Buat goal baru</div>
                                <div className="flex gap-2">
                                    <input
                                        value={newGoalName}
                                        onChange={(e) => setNewGoalName(e.target.value)}
                                        className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none placeholder:text-white/30 focus:border-white/20"
                                        placeholder="Nama goal (contoh: Dana Darurat)"
                                    />
                                </div>
                                <div className="flex gap-2">
                                    <input
                                        value={newGoalTarget}
                                        onChange={(e) => setNewGoalTarget(e.target.value)}
                                        inputMode="numeric"
                                        className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none placeholder:text-white/30 focus:border-white/20"
                                        placeholder="Target (contoh: 5000000)"
                                    />
                                    <button
                                        onClick={onCreateGoal}
                                        className="rounded-xl bg-gradient-to-r from-pink-500 to-purple-500 px-4 py-2 text-sm font-semibold shadow hover:opacity-90"
                                    >
                                        Add
                                    </button>
                                </div>

                                {goals.length > 0 && (
                                    <div className="mt-2 space-y-2">
                                        <div className="text-xs text-white/60">Goal aktif</div>
                                        <div className="grid gap-2">
                                            {goals.map((g) => (
                                                <div
                                                    key={g.id}
                                                    className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 p-3"
                                                >
                                                    <div>
                                                        <div className="flex items-center gap-2">
                                                            <span
                                                                className="inline-block h-2.5 w-2.5 rounded-full"
                                                                style={{ background: g.color || "#ff4fd8" }}
                                                            />
                                                            <div className="text-sm font-semibold">{g.name}</div>
                                                        </div>
                                                        <div className="text-xs text-white/60">Target: {idr(g.target_amount)}</div>
                                                    </div>
                                                    <button
                                                        onClick={() => onArchiveGoal(g.id)}
                                                        className="rounded-xl bg-white/5 px-3 py-2 text-xs font-semibold text-white/70 hover:bg-white/10 hover:text-white"
                                                        title="Archive goal"
                                                    >
                                                        Archive
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </Card>

                        <Card title="Tambah Transaksi">
                            <div className="space-y-3">
                                <div className="text-xs text-white/60">
                                    Mode:{" "}
                                    <span className="text-white/90 font-semibold">
                                        {activeGoal ? `Goal: ${activeGoal.name}` : "Semua Goal"}
                                    </span>
                                </div>

                                <input
                                    value={amount}
                                    onChange={(e) => setAmount(e.target.value)}
                                    inputMode="numeric"
                                    className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none placeholder:text-white/30 focus:border-white/20"
                                    placeholder="Nominal (contoh: 50000)"
                                />
                                <input
                                    value={note}
                                    onChange={(e) => setNote(e.target.value)}
                                    className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none placeholder:text-white/30 focus:border-white/20"
                                    placeholder="Catatan (opsional)"
                                />

                                <div className="grid grid-cols-2 gap-2">
                                    <button
                                        onClick={() => onAddTx(1)}
                                        className="rounded-xl bg-gradient-to-r from-pink-500 to-purple-500 py-2 text-sm font-semibold shadow hover:opacity-90"
                                    >
                                        + Nabung
                                    </button>
                                    <button
                                        onClick={() => onAddTx(-1)}
                                        className="rounded-xl border border-white/15 bg-white/5 py-2 text-sm font-semibold hover:bg-white/10"
                                    >
                                        - Ambil
                                    </button>
                                </div>

                                <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-xs text-white/65">
                                    <div className="font-semibold text-white/85">Quick tips</div>
                                    <ul className="mt-2 list-disc space-y-1 pl-5">
                                        <li>“Nabung” = transaksi positif.</li>
                                        <li>“Ambil” = transaksi negatif.</li>
                                        <li>Pilih goal dulu supaya tabungan terpisah.</li>
                                    </ul>
                                </div>
                            </div>
                        </Card>

                        <Card
                            title="AI Budgeting Suggestion (Smart Tips)"
                            right={
                                <button
                                    onClick={refreshAiAdvice}
                                    disabled={aiLoading}
                                    className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold hover:bg-white/20 disabled:opacity-50"
                                >
                                    {aiLoading ? "Thinking..." : "Refresh AI"}
                                </button>
                            }
                        >
                            <div className="space-y-4">
                                {!aiData && !aiLoading && !aiError && (
                                    <div className="text-center py-4">
                                        <p className="text-sm text-white/60 mb-3">Tekan tombol untuk mendapatkan saran budgeting pintar dari AI.</p>
                                        <button
                                            onClick={refreshAiAdvice}
                                            className="rounded-xl bg-gradient-to-r from-pink-500 to-purple-500 px-6 py-2 text-sm font-semibold shadow hover:opacity-90"
                                        >
                                            Ambil Saran AI
                                        </button>
                                    </div>
                                )}

                                {aiError && (
                                    <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-300">
                                        {aiError}
                                    </div>
                                )}

                                {aiData && (
                                    <div className="animate-in fade-in slide-in-from-bottom-2 duration-700">
                                        <div className="mb-4 flex items-center justify-between gap-4">
                                            <div className="flex-1">
                                                <div className="text-xs text-white/50 uppercase tracking-wider font-bold">Health Score</div>
                                                <div className="mt-1 h-3 w-full bg-white/10 rounded-full overflow-hidden">
                                                    <div
                                                        className={[
                                                            "h-full rounded-full transition-all duration-1000",
                                                            aiData.health_score > 70 ? "bg-green-400" : aiData.health_score > 40 ? "bg-yellow-400" : "bg-red-400"
                                                        ].join(" ")}
                                                        style={{ width: `${aiData.health_score}%` }}
                                                    />
                                                </div>
                                            </div>
                                            <div className="text-2xl font-black text-white/90">{aiData.health_score}</div>
                                        </div>

                                        <p className="text-sm leading-relaxed text-white/90 italic mb-4">&quot;{aiData.summary}&quot;</p>

                                        <div className="space-y-4">
                                            <div>
                                                <div className="text-xs font-bold text-pink-400 uppercase tracking-tight mb-2">Key Insights</div>
                                                <div className="space-y-2">
                                                    {aiData.insights.map((ins, i) => (
                                                        <div key={i} className="flex gap-2 text-sm text-white/75">
                                                            <span className="text-pink-500">•</span>
                                                            {ins}
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>

                                            <div>
                                                <div className="text-xs font-bold text-blue-400 uppercase tracking-tight mb-2">Next Actions</div>
                                                <div className="grid gap-2">
                                                    {aiData.next_actions.map((act, i) => (
                                                        <div key={i} className="rounded-xl bg-white/5 p-3 border border-white/5">
                                                            <div className="text-sm font-bold text-white/90">{act.title}</div>
                                                            <div className="text-xs text-white/60 mt-1">{act.why}</div>
                                                            <div className="text-xs text-blue-300 mt-2 font-medium">Cara: {act.how}</div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>

                                            {aiData.budget_plan && (
                                                <div className="rounded-2xl bg-gradient-to-br from-pink-500/10 to-purple-500/10 border border-white/10 p-4">
                                                    <div className="text-xs font-bold text-white/80 uppercase mb-3">Quick Budget Plan</div>
                                                    <div className="grid grid-cols-3 gap-2 text-center">
                                                        <div>
                                                            <div className="text-lg font-bold text-white">{aiData.budget_plan.needs_pct}%</div>
                                                            <div className="text-[10px] text-white/50">Needs</div>
                                                        </div>
                                                        <div>
                                                            <div className="text-lg font-bold text-white">{aiData.budget_plan.wants_pct}%</div>
                                                            <div className="text-[10px] text-white/50">Wants</div>
                                                        </div>
                                                        <div>
                                                            <div className="text-lg font-bold text-white">{aiData.budget_plan.savings_pct}%</div>
                                                            <div className="text-[10px] text-white/50">Saved</div>
                                                        </div>
                                                    </div>
                                                    <div className="mt-3 text-[11px] text-white/60 text-center">{aiData.budget_plan.notes}</div>
                                                </div>
                                            )}

                                            {aiData.warnings && aiData.warnings.length > 0 && (
                                                <div className="rounded-xl border border-yellow-500/20 bg-yellow-500/5 p-3">
                                                    {aiData.warnings.map((w, i) => (
                                                        <div key={i} className="text-xs text-yellow-200/80 flex gap-2">
                                                            <span>⚠️</span> {w}
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}

                                <div className="text-[10px] text-white/30 text-center italic">
                                    AI-powered by gpt-4o-mini. Saran bersifat finansial umum.
                                </div>
                            </div>
                        </Card>
                    </div>
                </div>

                {/* HISTORY */}
                <div className="mt-6">
                    <Card
                        title="Riwayat (terakhir 50)"
                        right={
                            <div className="text-xs text-white/60">
                                Total items: <span className="text-white/85">{filteredTxs.slice(0, 50).length}</span>
                            </div>
                        }
                    >
                        <div className="overflow-hidden rounded-2xl border border-white/10">
                            <div className="max-h-[420px] overflow-auto">
                                {filteredTxs.slice(0, 50).length === 0 ? (
                                    <div className="p-5 text-sm text-white/60">Belum ada transaksi.</div>
                                ) : (
                                    <div className="divide-y divide-white/10">
                                        {filteredTxs.slice(0, 50).map((t) => {
                                            const isPlus = t.amount > 0;
                                            const dt = new Date(t.created_at);
                                            return (
                                                <div key={t.id} className="flex items-center justify-between gap-3 p-4">
                                                    <div className="min-w-0">
                                                        <div className="text-sm font-semibold">
                                                            {isPlus ? "Nabung" : "Ambil"}{" "}
                                                            <span className={isPlus ? "text-pink-300" : "text-red-300"}>
                                                                {idr(Math.abs(t.amount))}
                                                            </span>
                                                        </div>
                                                        <div className="truncate text-xs text-white/60">
                                                            {t.note || "—"} •{" "}
                                                            {dt.toLocaleString("id-ID", {
                                                                day: "2-digit",
                                                                month: "short",
                                                                hour: "2-digit",
                                                                minute: "2-digit",
                                                            })}
                                                        </div>
                                                    </div>
                                                    <div className="text-xs text-white/50">
                                                        {t.goal_id
                                                            ? goals.find((g) => g.id === t.goal_id)?.name || "Goal"
                                                            : "All"}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        </div>
                    </Card>
                </div>

                <div className="mt-8 text-center text-xs text-white/45">
                    © {new Date().getFullYear()} Kanji Laopu — Celengan
                </div>
            </div>
        </div>
    );
}
