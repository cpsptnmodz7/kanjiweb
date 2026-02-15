"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import AuthGuard from "@/components/AuthGuard";

type KanjiRow = {
    id: string;
    meaning: string;
    onyomi: string;
    kunyomi: string;
    level: string;
};

export default function LevelDetailPage({ params }: { params: Promise<{ lvl: string }> }) {
    const { lvl } = use(params);
    const [kanjiList, setKanjiList] = useState<KanjiRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [userKanjiIds, setUserKanjiIds] = useState<Set<string>>(new Set());

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);

            // Fetch all kanji for this level
            const { data: kData } = await supabase
                .from("kanji")
                .select("*")
                .eq("level", lvl);

            // Fetch user's studied kanji
            const { data: auth } = await supabase.auth.getUser();
            if (auth.user) {
                const { data: ukData } = await supabase
                    .from("user_kanji")
                    .select("kanji_id")
                    .eq("user_id", auth.user.id);

                setUserKanjiIds(new Set((ukData ?? []).map(x => x.kanji_id)));
            }

            setKanjiList((kData ?? []) as KanjiRow[]);
            setLoading(false);
        };

        fetchData();
    }, [lvl]);

    return (
        <AuthGuard>
            <main className="min-h-screen bg-slate-950 text-white p-6 sm:p-10">
                <div className="mx-auto max-w-5xl">
                    <header className="mb-8 flex items-center justify-between">
                        <div>
                            <Link href="/levels" className="text-xs opacity-50 hover:opacity-100 mb-2 inline-block">← Back to Levels</Link>
                            <h1 className="text-3xl font-bold tracking-tight">Kanji Level {lvl}</h1>
                            <p className="text-sm opacity-60 mt-1">Daftar semua kanji untuk level {lvl}.</p>
                        </div>
                    </header>

                    {loading ? (
                        <div className="flex items-center justify-center h-64">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-pink-500" />
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                            {kanjiList.map((k) => {
                                const isStudied = userKanjiIds.has(k.id);
                                return (
                                    <Link
                                        key={k.id}
                                        href={`/kanji/${k.id}`}
                                        className={`group relative rounded-2xl border p-6 text-center transition-all hover:scale-105 active:scale-95 ${isStudied ? "bg-emerald-500/10 border-emerald-500/20" : "bg-white/5 border-white/10 hover:bg-white/10"}`}
                                    >
                                        <div className="text-4xl font-semibold mb-2 group-hover:text-pink-500 transition-colors">{k.id}</div>
                                        <div className="text-[10px] opacity-40 uppercase truncate">{k.meaning}</div>
                                        {isStudied && (
                                            <div className="absolute top-2 right-2 h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                                        )}
                                    </Link>
                                );
                            })}
                        </div>
                    )}

                    {kanjiList.length === 0 && !loading && (
                        <div className="text-center py-20 opacity-40">
                            Belum ada data kanji untuk level ini.
                        </div>
                    )}
                </div>
            </main>
        </AuthGuard>
    );
}
