"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import supabase from "@/lib/supabaseClient";

type Tx = {
    id: string;
    amount: number;
    note: string | null;
    category: string | null;
    created_at: string;
};

function formatIDR(n: number) {
    try {
        return new Intl.NumberFormat("id-ID", {
            style: "currency",
            currency: "IDR",
            maximumFractionDigits: 0,
        }).format(n);
    } catch {
        return `Rp ${Math.round(n).toLocaleString("id-ID")}`;
    }
}

function startOfMonthISO(d = new Date()) {
    const x = new Date(d.getFullYear(), d.getMonth(), 1);
    return x.toISOString();
}

export default function SavingsPage() {
    const router = useRouter();

    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState("");

    const [userEmail, setUserEmail] = useState<string>("");

    const [monthlyTarget, setMonthlyTarget] = useState<number>(0);
    const [targetInput, setTargetInput] = useState<string>("0");

    const [amountInput, setAmountInput] = useState<string>("");
    const [noteInput, setNoteInput] = useState<string>("");
    const [txs, setTxs] = useState<Tx[]>([]);

    const [total, setTotal] = useState<number>(0);
    const [monthTotal, setMonthTotal] = useState<number>(0);

    const monthISO = useMemo(() => startOfMonthISO(), []);

    async function requireAuth() {
        const { data } = await supabase.auth.getSession();
        if (!data.session) {
            router.replace("/login");
            return null;
        }
        return data.session;
    }

    async function loadAll() {
        setLoading(true);
        setErr("");

        const session = await requireAuth();
        if (!session) return;

        setUserEmail(session.user.email ?? "");

        // 1) Settings (monthly target)
        const settingsRes = await supabase
            .from("savings_settings")
            .select("monthly_target")
            .eq("user_id", session.user.id)
            .maybeSingle();

        if (settingsRes.error) {
            setErr(settingsRes.error.message);
        } else {
            const t = Number(settingsRes.data?.monthly_target ?? 0);
            setMonthlyTarget(t);
            setTargetInput(String(Math.round(t)));
        }

        // 2) Transactions list
        const txRes = await supabase
            .from("savings_transactions")
            .select("id,amount,note,category,created_at")
            .eq("user_id", session.user.id)
            .order("created_at", { ascending: false })
            .limit(50);

        if (txRes.error) {
            setErr(txRes.error.message);
        } else {
            const rows = (txRes.data ?? []).map((r: any) => ({
                id: r.id,
                amount: Number(r.amount),
                note: r.note,
                category: r.category,
                created_at: r.created_at,
            }));
            setTxs(rows);
        }

        // 3) Total (sum)
        // Supabase JS belum punya aggregate sum yang super-enak tanpa RPC,
        // jadi kita hitung dari list + fetch tambahan untuk bulan ini (minimal safe).
        // Jika transaksi kamu > 50, total bisa beda; nanti bisa kita upgrade pakai view/RPC.
        const allRes = await supabase
            .from("savings_transactions")
            .select("amount,created_at")
            .eq("user_id", session.user.id);

        if (allRes.error) {
            setErr(allRes.error.message);
        } else {
            const all = allRes.data ?? [];
            const sumAll = all.reduce((a: number, r: any) => a + Number(r.amount), 0);
            setTotal(sumAll);

            const sumMonth = all
                .filter((r: any) => new Date(r.created_at) >= new Date(monthISO))
                .reduce((a: number, r: any) => a + Number(r.amount), 0);

            setMonthTotal(sumMonth);
        }

        setLoading(false);
    }

    useEffect(() => {
        loadAll();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const progressPct = useMemo(() => {
        if (monthlyTarget <= 0) return 0;
        const p = (monthTotal / monthlyTarget) * 100;
        return Math.max(0, Math.min(100, p));
    }, [monthTotal, monthlyTarget]);

    async function saveTarget() {
        setErr("");
        const session = await requireAuth();
        if (!session) return;

        const v = Number(targetInput.replace(/[^\d.-]/g, "")) || 0;

        const res = await supabase.from("savings_settings").upsert(
            {
                user_id: session.user.id,
                monthly_target: v,
            },
            { onConflict: "user_id" }
        );

        if (res.error) {
            setErr(res.error.message);
            return;
        }

        setMonthlyTarget(v);
    }

    async function addTx(sign: 1 | -1) {
        setErr("");
        const session = await requireAuth();
        if (!session) return;

        const raw = amountInput.replace(/[^\d.-]/g, "");
        const amt = Number(raw);

        if (!amt || amt <= 0) {
            setErr("Masukkan nominal yang benar.");
            return;
        }

        const payload = {
            user_id: session.user.id,
            amount: sign * amt,
            note: noteInput.trim() || null,
            category: "general",
        };

        const res = await supabase.from("savings_transactions").insert(payload);
        if (res.error) {
            setErr(res.error.message);
            return;
        }

        setAmountInput("");
        setNoteInput("");
        await loadAll();
    }

    async function deleteTx(id: string) {
        setErr("");
        const session = await requireAuth();
        if (!session) return;

        const res = await supabase
            .from("savings_transactions")
            .delete()
            .eq("id", id)
            .eq("user_id", session.user.id);

        if (res.error) {
            setErr(res.error.message);
            return;
        }

        await loadAll();
    }

    return (
        <div className="min-h-screen w-full">
            {/* background */}
            <div className="fixed inset-0 -z-10">
                <div
                    className="absolute inset-0"
                    style={{
                        backgroundImage: "url(/anime-wallpaper.jpg)",
                        backgroundSize: "cover",
                        backgroundPosition: "center",
                        filter: "saturate(1.05)",
                    }}
                />
                <div className="absolute inset-0 bg-black/65" />
                <div className="absolute inset-0 bg-[radial-gradient(70%_60%_at_50%_0%,rgba(236,72,153,0.20),transparent_60%),radial-gradient(70%_55%_at_0%_100%,rgba(59,130,246,0.16),transparent_55%)]" />
            </div>

            <div className="mx-auto max-w-6xl px-4 py-6">
                {/* top bar */}
                <div className="mb-5 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                        <div className="h-11 w-11 rounded-2xl bg-gradient-to-br from-fuchsia-500 to-pink-500 shadow-[0_16px_40px_rgba(236,72,153,0.30)]" />
                        <div>
                            <div className="text-white text-xl font-semibold leading-tight">
                                Celengan
                            </div>
                            <div className="text-white/60 text-sm">
                                {userEmail ? `Login: ${userEmail}` : "—"}
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            className="rounded-2xl border border-white/14 bg-white/5 px-4 py-2 text-sm text-white/80 hover:bg-white/10"
                            onClick={() => router.push("/")}
                        >
                            Home
                        </button>
                        <button
                            className="rounded-2xl border border-white/14 bg-white/5 px-4 py-2 text-sm text-white/80 hover:bg-white/10"
                            onClick={() => router.push("/dashboard")}
                        >
                            Dashboard
                        </button>
                    </div>
                </div>

                <div className="grid gap-4 lg:grid-cols-[1.25fr_0.75fr]">
                    {/* left */}
                    <div className="rounded-[28px] border border-white/12 bg-white/[0.06] p-5 shadow-[0_40px_100px_rgba(0,0,0,0.45)] backdrop-blur-xl">
                        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                            <div>
                                <div className="text-white/70 text-sm">Total Nabung</div>
                                <div className="text-white text-4xl font-semibold tracking-tight">
                                    {formatIDR(total)}
                                </div>
                                <div className="mt-1 text-white/55 text-sm">
                                    Bulan ini:{" "}
                                    <span className="text-white/80">{formatIDR(monthTotal)}</span>
                                </div>
                            </div>

                            <div className="w-full md:max-w-sm">
                                <div className="text-white/70 text-sm mb-2">
                                    Target bulanan
                                </div>
                                <div className="flex gap-2">
                                    <input
                                        value={targetInput}
                                        onChange={(e) => setTargetInput(e.target.value)}
                                        placeholder="contoh: 1000000"
                                        className="w-full rounded-2xl border border-white/12 bg-black/25 px-4 py-3 text-white outline-none placeholder:text-white/40 focus:border-pink-500/50"
                                    />
                                    <button
                                        onClick={saveTarget}
                                        className="rounded-2xl bg-gradient-to-r from-fuchsia-500 to-pink-500 px-4 py-3 text-sm font-semibold text-white shadow-[0_18px_45px_rgba(236,72,153,0.25)] hover:opacity-95"
                                    >
                                        Save
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* progress */}
                        <div className="mt-5 rounded-[22px] border border-white/10 bg-black/20 p-4">
                            <div className="flex items-center justify-between">
                                <div className="text-white/80 text-sm font-medium">
                                    Progress bulan ini
                                </div>
                                <div className="text-white/60 text-sm">
                                    {monthlyTarget > 0
                                        ? `${Math.round(progressPct)}%`
                                        : "Set target dulu"}
                                </div>
                            </div>
                            <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-white/10">
                                <div
                                    className="h-full rounded-full bg-gradient-to-r from-fuchsia-500 to-pink-500"
                                    style={{ width: `${progressPct}%` }}
                                />
                            </div>
                            {monthlyTarget > 0 ? (
                                <div className="mt-2 text-white/55 text-xs">
                                    Target:{" "}
                                    <span className="text-white/75">{formatIDR(monthlyTarget)}</span>
                                </div>
                            ) : null}
                        </div>

                        {/* add tx */}
                        <div className="mt-5 grid gap-3 md:grid-cols-[1fr_280px]">
                            <div className="rounded-[22px] border border-white/10 bg-black/20 p-4">
                                <div className="text-white/80 text-sm font-medium">
                                    Tambah transaksi
                                </div>

                                <div className="mt-3 grid gap-2">
                                    <input
                                        value={amountInput}
                                        onChange={(e) => setAmountInput(e.target.value)}
                                        placeholder="Nominal (contoh: 50000)"
                                        className="w-full rounded-2xl border border-white/12 bg-black/25 px-4 py-3 text-white outline-none placeholder:text-white/40 focus:border-pink-500/50"
                                    />
                                    <input
                                        value={noteInput}
                                        onChange={(e) => setNoteInput(e.target.value)}
                                        placeholder="Catatan (opsional)"
                                        className="w-full rounded-2xl border border-white/12 bg-black/25 px-4 py-3 text-white outline-none placeholder:text-white/40 focus:border-pink-500/50"
                                    />
                                </div>

                                <div className="mt-3 flex flex-wrap gap-2">
                                    <button
                                        onClick={() => addTx(1)}
                                        className="rounded-2xl bg-gradient-to-r from-fuchsia-500 to-pink-500 px-4 py-3 text-sm font-semibold text-white shadow-[0_16px_40px_rgba(236,72,153,0.25)] hover:opacity-95"
                                    >
                                        + Nabung
                                    </button>
                                    <button
                                        onClick={() => addTx(-1)}
                                        className="rounded-2xl border border-white/14 bg-white/5 px-4 py-3 text-sm font-semibold text-white/80 hover:bg-white/10"
                                    >
                                        - Ambil
                                    </button>
                                </div>

                                {err ? (
                                    <div className="mt-3 rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                                        {err}
                                    </div>
                                ) : null}
                            </div>

                            <div className="rounded-[22px] border border-white/10 bg-black/20 p-4">
                                <div className="text-white/80 text-sm font-medium">
                                    Quick tips
                                </div>
                                <div className="mt-2 text-white/55 text-sm leading-relaxed">
                                    • “Nabung” = transaksi positif
                                    <br />• “Ambil” = transaksi negatif
                                    <br />• Target bulanan untuk progress bar
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* right: history */}
                    <div className="rounded-[28px] border border-white/12 bg-white/[0.06] p-5 shadow-[0_40px_100px_rgba(0,0,0,0.45)] backdrop-blur-xl">
                        <div className="flex items-center justify-between">
                            <div className="text-white text-lg font-semibold">Riwayat</div>
                            <div className="text-white/50 text-xs">terakhir 50</div>
                        </div>

                        <div className="mt-3 space-y-2">
                            {loading ? (
                                <div className="text-white/60 text-sm">Loading…</div>
                            ) : txs.length === 0 ? (
                                <div className="text-white/55 text-sm">
                                    Belum ada transaksi. Mulai nabung dulu ✨
                                </div>
                            ) : (
                                txs.map((t) => {
                                    const isPlus = t.amount >= 0;
                                    return (
                                        <div
                                            key={t.id}
                                            className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3"
                                        >
                                            <div className="flex items-start justify-between gap-3">
                                                <div>
                                                    <div className="text-white/80 text-sm">
                                                        {t.note || "—"}
                                                    </div>
                                                    <div className="text-white/45 text-xs">
                                                        {new Date(t.created_at).toLocaleString("id-ID")}
                                                    </div>
                                                </div>

                                                <div className="text-right">
                                                    <div
                                                        className={
                                                            "text-sm font-semibold " +
                                                            (isPlus ? "text-emerald-300" : "text-rose-300")
                                                        }
                                                    >
                                                        {isPlus ? "+" : "-"} {formatIDR(Math.abs(t.amount))}
                                                    </div>

                                                    <button
                                                        onClick={() => deleteTx(t.id)}
                                                        className="mt-1 text-xs text-white/45 hover:text-white/70"
                                                    >
                                                        Hapus
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </div>
                </div>

                <div className="mt-6 text-center text-white/40 text-xs">
                    Kanji Laopu • Celengan
                </div>
            </div>
        </div>
    );
}
