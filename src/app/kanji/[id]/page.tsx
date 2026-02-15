"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import AuthGuard from "@/components/AuthGuard";

type KanjiDetail = {
    id: string;
    meaning: string;
    onyomi: string;
    kunyomi: string;
    level: string;
};

type UserProgress = {
    state: string;
    reps: number;
    interval_days: number;
    ease: number;
    next_due: string;
};

export default function KanjiDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const kanjiChar = decodeURIComponent(id);

    const [kanji, setKanji] = useState<KanjiDetail | null>(null);
    const [progress, setProgress] = useState<UserProgress | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);

            // 1. Fetch Kanji details
            const { data: kData } = await supabase
                .from("kanji")
                .select("*")
                .eq("id", kanjiChar)
                .single();

            // 2. Fetch User progress
            const { data: auth } = await supabase.auth.getUser();
            if (auth.user) {
                const { data: ukData } = await supabase
                    .from("user_kanji")
                    .select("state, reps, interval_days, ease, due_at")
                    .eq("user_id", auth.user.id)
                    .eq("kanji_id", kanjiChar)
                    .single();

                if (ukData) {
                    setProgress({
                        state: ukData.state,
                        reps: ukData.reps,
                        interval_days: ukData.interval_days,
                        ease: ukData.ease,
                        next_due: ukData.due_at
                    });
                }
            }

            if (kData) setKanji(kData as KanjiDetail);
            setLoading(false);
        };

        fetchData();
    }, [kanjiChar]);

    if (loading) return (
        <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-pink-500" />
        </div>
    );

    if (!kanji) return (
        <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-6 text-center">
            <h1 className="text-2xl font-bold mb-4">Kanji Tidak Ditemukan</h1>
            <Link href="/levels" className="bg-white/10 px-6 py-3 rounded-2xl hover:bg-white/20 transition">Kembali ke Daftar</Link>
        </div>
    );

    return (
        <AuthGuard>
            <main className="min-h-screen bg-slate-950 text-white p-6 sm:p-10">
                <div className="mx-auto max-w-4xl">
                    <Link href={`/levels/${kanji.level}`} className="text-xs opacity-50 hover:opacity-100 mb-6 inline-block">← Back to Level {kanji.level}</Link>

                    <div className="grid gap-8 md:grid-cols-[1fr_2fr]">
                        {/* Big Kanji Display */}
                        <div className="flex flex-col items-center">
                            <div className="w-full aspect-square rounded-3xl border border-white/10 bg-white/5 flex items-center justify-center text-[10rem] font-bold shadow-2xl backdrop-blur relative overflow-hidden">
                                <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-pink-500/10 to-transparent pointer-events-none" />
                                {kanji.id}
                            </div>

                            {progress ? (
                                <div className="mt-6 w-full rounded-2xl bg-emerald-500/10 border border-emerald-500/20 p-4 text-center">
                                    <div className="text-[10px] uppercase opacity-50 mb-1">Status Belajar</div>
                                    <div className="text-lg font-semibold text-emerald-400 capitalize">{progress.state}</div>
                                </div>
                            ) : (
                                <button className="mt-6 w-full rounded-2xl bg-pink-600 py-4 font-semibold hover:bg-pink-500 transition shadow-lg shadow-pink-600/20">
                                    Mulai Belajar Kanji Ini
                                </button>
                            )}
                        </div>

                        {/* Information Details */}
                        <div className="space-y-6">
                            <div className="rounded-3xl border border-white/10 bg-white/5 p-8 backdrop-blur">
                                <h1 className="text-4xl font-bold mb-2">{kanji.meaning}</h1>
                                <div className="inline-block px-3 py-1 rounded-full bg-pink-500/20 text-pink-400 text-xs font-bold uppercase tracking-wider mb-6 border border-pink-500/30">
                                    Level {kanji.level}
                                </div>

                                <div className="grid gap-6">
                                    <div>
                                        <div className="text-xs opacity-40 uppercase tracking-widest mb-2">Onyomi (Chinese Reading)</div>
                                        <div className="text-2xl font-medium tracking-wide">{kanji.onyomi || "—"}</div>
                                    </div>
                                    <div>
                                        <div className="text-xs opacity-40 uppercase tracking-widest mb-2">Kunyomi (Japanese Reading)</div>
                                        <div className="text-2xl font-medium tracking-wide">{kanji.kunyomi || "—"}</div>
                                    </div>
                                </div>
                            </div>

                            {progress && (
                                <div className="rounded-3xl border border-white/10 bg-white/5 p-8 backdrop-blur">
                                    <h3 className="text-lg font-semibold mb-4 border-b border-white/10 pb-2">SRS Progress Information</h3>
                                    <div className="grid grid-cols-2 gap-6">
                                        <div>
                                            <div className="text-xs opacity-40 uppercase mb-1">Repetitions</div>
                                            <div className="text-xl font-medium">{progress.reps}x</div>
                                        </div>
                                        <div>
                                            <div className="text-xs opacity-40 uppercase mb-1">Interval</div>
                                            <div className="text-xl font-medium">{progress.interval_days} hari</div>
                                        </div>
                                        <div>
                                            <div className="text-xs opacity-40 uppercase mb-1">Ease Factor</div>
                                            <div className="text-xl font-medium">{progress.ease.toFixed(2)}</div>
                                        </div>
                                        <div>
                                            <div className="text-xs opacity-40 uppercase mb-1">Next Review</div>
                                            <div className="text-sm font-medium">{new Date(progress.next_due).toLocaleDateString()}</div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            <div className="rounded-3xl border border-white/10 bg-white/5 p-8 backdrop-blur flex items-center justify-between">
                                <div className="opacity-60 text-sm italic">Mau menguji hafalan Anda untuk kanji ini?</div>
                                <Link
                                    href={`/quiz?level=${kanji.level}`}
                                    className="px-6 py-2 rounded-xl bg-white/10 text-sm font-semibold hover:bg-white/20 transition"
                                >
                                    Quiz Level {kanji.level}
                                </Link>
                            </div>
                        </div>
                    </div>
                </div>
            </main>
        </AuthGuard>
    );
}
