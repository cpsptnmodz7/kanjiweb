"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import AuthGuard from "@/components/AuthGuard";

type LevelStats = {
    level: string;
    total: number;
    userCount: number;
};

const JLPT_LEVELS = ["N5", "N4", "N3", "N2", "N1"];

export default function LevelsPage() {
    const router = useRouter();
    const [stats, setStats] = useState<LevelStats[]>([]);
    // const [loading, setLoading] = useState(true);
    const [userId, setUserId] = useState<string | null>(null);
    const [msg, setMsg] = useState<{ text: string; type: "success" | "error" } | null>(null);

    useEffect(() => {
        const fetchStats = async () => {
            const { data: auth } = await supabase.auth.getUser();
            if (!auth.user) return;
            setUserId(auth.user.id);

            // Fetch total kanji per level
            const { data: allKanji } = await supabase.from("kanji").select("level");

            // Fetch user kanji progress
            const { data: userKanji } = await supabase
                .from("user_kanji")
                .select("kanji:kanji_id(level)")
                .eq("user_id", auth.user.id);

            const levelMap = new Map<string, { total: number; userCount: number }>();
            JLPT_LEVELS.forEach(lvl => levelMap.set(lvl, { total: 0, userCount: 0 }));

            (allKanji ?? []).forEach((k: { level: string }) => {
                if (levelMap.has(k.level)) {
                    levelMap.get(k.level)!.total += 1;
                }
            });

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            ((userKanji as any[]) ?? []).forEach((uk: { kanji: { level: string } }) => {
                const lvl = uk.kanji?.level;
                if (lvl && levelMap.has(lvl)) {
                    levelMap.get(lvl)!.userCount += 1;
                }
            });

            const finalStats: LevelStats[] = JLPT_LEVELS.map(lvl => ({
                level: lvl,
                total: levelMap.get(lvl)!.total,
                userCount: levelMap.get(lvl)!.userCount
            }));

            setStats(finalStats);
            // setLoading(false);
        };

        fetchStats();
    }, []);

    const addLevelToQueue = async (level: string) => {
        if (!userId) return;
        setMsg(null);

        const { data: kanjiInLevel, error: kErr } = await supabase
            .from("kanji")
            .select("id")
            .eq("level", level);

        if (kErr || !kanjiInLevel) {
            setMsg({ text: "Gagal memuat data kanji.", type: "error" });
            return;
        }

        const payload = kanjiInLevel.map(k => ({
            user_id: userId,
            kanji_id: k.id,
            due_at: new Date().toISOString(),
            state: "new"
        }));

        const { error: uErr } = await supabase
            .from("user_kanji")
            .upsert(payload, { onConflict: "user_id,kanji_id" });

        if (uErr) {
            setMsg({ text: uErr.message, type: "error" });
        } else {
            setMsg({ text: `Berhasil menambahkan ${payload.length} kanji ${level} ke queue.`, type: "success" });
            // Refresh stats
            const newStats = stats.map(s => s.level === level ? { ...s, userCount: payload.length } : s);
            setStats(newStats);
        }
    };

    return (
        <AuthGuard>
            <main className="min-h-screen bg-slate-950 text-white p-6 sm:p-10">
                <div className="mx-auto max-w-5xl">
                    <header className="mb-10 flex items-center justify-between">
                        <div>
                            <h1 className="text-3xl font-bold tracking-tight">JLPT Levels</h1>
                            <p className="text-sm opacity-60 mt-1">Pilih level untuk mulai belajar atau lihat progress.</p>
                        </div>
                        <Link href="/" className="text-sm opacity-60 hover:opacity-100 transition">Back to Home</Link>
                    </header>

                    {msg && (
                        <div className={`mb-6 p-4 rounded-2xl border ${msg.type === "success" ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" : "bg-rose-500/10 border-rose-500/20 text-rose-400"}`}>
                            {msg.text}
                        </div>
                    )}

                    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                        {stats.map((s) => {
                            const progress = s.total > 0 ? Math.round((s.userCount / s.total) * 100) : 0;
                            // const isComplete = s.userCount >= s.total && s.total > 0;

                            return (
                                <div key={s.level} className="rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur shadow-xl">
                                    <div className="flex items-center justify-between mb-4">
                                        <div className="text-4xl font-bold text-pink-500">{s.level}</div>
                                        <div className="text-xs opacity-50 uppercase tracking-widest">JLPT</div>
                                    </div>

                                    <div className="mb-6">
                                        <div className="flex items-center justify-between text-sm mb-2">
                                            <span className="opacity-60">Progress Belajar</span>
                                            <span className="font-medium">{s.userCount} / {s.total}</span>
                                        </div>
                                        <div className="h-2 rounded-full bg-white/5 overflow-hidden">
                                            <div
                                                className="h-full bg-pink-600 transition-all duration-700"
                                                style={{ width: `${progress}%` }}
                                            />
                                        </div>
                                    </div>

                                    <div className="space-y-3">
                                        {s.userCount > 0 ? (
                                            <button
                                                onClick={() => router.push(`/quiz?level=${s.level}`)}
                                                className="w-full rounded-2xl bg-white/10 py-3 text-sm font-semibold hover:bg-white/20 transition"
                                            >
                                                Lanjut Quiz {s.level}
                                            </button>
                                        ) : (
                                            <button
                                                onClick={() => addLevelToQueue(s.level)}
                                                disabled={s.total === 0}
                                                className={`w-full rounded-2xl py-3 text-sm font-semibold transition ${s.total === 0 ? "bg-white/5 opacity-50 cursor-not-allowed" : "bg-pink-600 hover:bg-pink-500"}`}
                                            >
                                                {s.total === 0 ? "Segera Hadir" : `Mulai Belajar ${s.level}`}
                                            </button>
                                        )}

                                        <button
                                            onClick={() => router.push(`/levels/${s.level}`)}
                                            className="w-full rounded-2xl border border-white/10 bg-transparent py-3 text-sm font-semibold hover:bg-white/5 transition"
                                        >
                                            Lihat Daftar Kanji
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </main>
        </AuthGuard>
    );
}
