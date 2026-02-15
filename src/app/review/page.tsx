"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { calculateNextReview, SRSGrade } from "@/lib/srs";

interface ReviewCard {
    user_id: string;
    kanji_id: string;
    ease: number;
    interval_days: number;
    reps: number;
    lapses: number;
    due_at: string;
    last_reviewed_at: string | null;
    kanji: {
        id: string;
        level: string;
        meaning: string;
        onyomi: string;
        kunyomi: string;
    };
}

function cn(...classes: (string | undefined | null | false)[]) {
    return classes.filter(Boolean).join(" ");
}

function todayISODate() {
    return new Date().toISOString().split("T")[0]; // YYYY-MM-DD
}

export default function ReviewPage() {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [cards, setCards] = useState<ReviewCard[]>([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [showAnswer, setShowAnswer] = useState(false);
    const [sessionUserId, setSessionUserId] = useState<string | null>(null);

    // Fetch session & due cards
    useEffect(() => {
        (async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) {
                router.replace("/login");
                return;
            }
            setSessionUserId(session.user.id);
            await loadDueCards(session.user.id);
        })();
    }, [router]);

    async function loadDueCards(uid: string) {
        setLoading(true);
        const now = new Date().toISOString();

        // 1. Get SRS cards due
        const { data, error } = await supabase
            .from("srs_cards")
            .select(`
                *,
                kanji:kanji_id (
                    id, level, meaning, onyomi, kunyomi
                )
            `)
            .eq("user_id", uid)
            .lte("due_at", now)
            .order("due_at", { ascending: true })
            .limit(20);

        if (error) {
            console.error("Error loading cards:", error);
            // alert("Gagal memuat review items.");
        }

        if (data) {
            // filter null kanji (jika ada relasi putus)
            const valid = data.filter((x) => x.kanji) as ReviewCard[];
            setCards(valid);
        }
        setLoading(false);
    }

    async function handleGrade(grade: SRSGrade) {
        if (!sessionUserId) return;
        const currentCard = cards[currentIndex];
        if (!currentCard) return;

        // 1. Calculate new SRS state
        const next = calculateNextReview({
            interval: currentCard.interval_days,
            repetition: currentCard.reps,
            easeFactor: currentCard.ease,
        }, grade);

        // 2. Optimistic UI update
        // remove current card from list
        // if user wants to keep reviewing, we just move to next index or shift array
        // Sederhana: remove from array
        const nextCards = [...cards];
        nextCards.splice(currentIndex, 1);
        setCards(nextCards);
        setShowAnswer(false);
        // index tetap 0 karena elemen geser

        // 3. Persist to DB (background)
        updateCardInBackground(sessionUserId, currentCard, next, grade);
    }

    async function updateCardInBackground(
        uid: string,
        card: ReviewCard,
        next: { interval: number; repetition: number; easeFactor: number },
        grade: SRSGrade
    ) {
        // Update SRS Card
        const due = new Date();
        due.setDate(due.getDate() + next.interval);

        const { error } = await supabase
            .from("srs_cards")
            .update({
                interval_days: next.interval,
                reps: next.repetition,
                ease: next.easeFactor,
                due_at: due.toISOString(),
                last_reviewed_at: new Date().toISOString(),
                lapses: grade === SRSGrade.AGAIN ? card.lapses + 1 : card.lapses,
            })
            .eq("user_id", uid)
            .eq("kanji_id", card.kanji_id);

        if (error) console.error("Failed to update SRS:", error);

        // Log Review
        const isCorrect = grade !== SRSGrade.AGAIN;
        await supabase.from("review_logs").insert({
            user_id: uid,
            kanji_id: card.kanji_id,
            correct: isCorrect,
            rating: SRSGrade[grade].toLowerCase(),
            mode: "review",
        });

        // Update Daily Progress (Streak, XP, etc)
        await applyDaily(uid, isCorrect);
    }

    async function addAllN5() {
        if (!sessionUserId) return;
        setLoading(true);

        // 1. Get all N5 kanji
        const { data: n5, error } = await supabase
            .from("kanji")
            .select("id")
            .eq("level", "N5");

        if (error) {
            alert("Error fetching N5 kanji: " + error.message);
            setLoading(false);
            return;
        }
        if (!n5 || n5.length === 0) {
            alert("Tidak ada data kanji N5.");
            setLoading(false);
            return;
        }

        // 2. Prepare UPSERT to srs_cards
        const rows = n5.map((k) => ({
            user_id: sessionUserId,
            kanji_id: k.id,
            ease: 2.5,
            interval_days: 0,
            reps: 0,
            lapses: 0,
            due_at: new Date().toISOString(),
        }));

        await supabase.from("srs_cards").upsert(rows, { onConflict: "user_id,kanji_id" });
        alert(`Berhasil menambahkan ${rows.length} kanji N5 ke antrian review!`);
        await loadDueCards(sessionUserId);
    }

    async function applyDaily(uid: string, correct: boolean) {
        const d = todayISODate();

        // progress increment with fallback
        try {
            const { error } = await supabase.rpc("increment_daily_progress", {
                p_user_id: uid,
                p_date: d,
                p_reviews: 1,
                p_correct: correct ? 1 : 0,
                p_minutes: 0,
            });
            if (error) throw error;
        } catch (err) {
            console.error("RPC failed, falling back to manual update", err);
            // fallback kalau belum buat RPC: update manual
            const { data } = await supabase
                .from("daily_progress")
                .select("reviews_done,correct_done,minutes_done")
                .eq("user_id", uid)
                .eq("prog_date", d)
                .maybeSingle();

            const curReviews = data?.reviews_done ?? 0;
            const curCorrect = data?.correct_done ?? 0;
            const curMinutes = data?.minutes_done ?? 0;

            await supabase.from("daily_progress").upsert(
                {
                    user_id: uid,
                    prog_date: d,
                    reviews_done: curReviews + 1,
                    correct_done: curCorrect + (correct ? 1 : 0),
                    minutes_done: curMinutes,
                },
                { onConflict: "user_id,prog_date" }
            );
        }

        // streak + xp (simple)
        const { data: stats } = await supabase
            .from("user_stats")
            .select("streak,last_active_date,xp,level")
            .eq("user_id", uid)
            .single();

        let streak = stats?.streak ?? 0;
        const lastDate = stats?.last_active_date;
        const xp = stats?.xp ?? 0;
        const level = stats?.level ?? 1;

        if (lastDate !== d) {
            // cek kemarin
            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);
            const yStr = yesterday.toISOString().split("T")[0];

            if (lastDate === yStr) {
                streak += 1;
            } else {
                streak = 1;
            }
        }

        // XP logic
        const newXp = xp + (correct ? 10 : 2);
        const newLevel = Math.floor(newXp / 100) + 1; // simple level formula

        await supabase.from("user_stats").upsert({
            user_id: uid,
            streak,
            last_active_date: d,
            xp: newXp,
            level: newLevel,
        });
    }

    // --- UI RENDERING ---

    if (loading) {
        return (
            <div className="flex min-h-screen items-center justify-center text-white/50">
                Loading reviews...
            </div>
        );
    }

    if (cards.length === 0) {
        return (
            <div className="flex min-h-[calc(100vh-80px)] items-center justify-center p-4">
                <div className="w-full max-w-md rounded-[28px] border border-white/10 bg-black/40 p-8 text-center shadow-xl backdrop-blur-xl">
                    <div className="text-4xl mb-4">🎉</div>
                    <h2 className="text-2xl font-semibold text-white">All Caught Up!</h2>
                    <p className="mt-2 text-white/60">
                        Tidak ada review pending untuk saat ini.
                    </p>
                    <div className="mt-8 space-y-3">
                        <button
                            onClick={addAllN5}
                            className="w-full rounded-xl bg-white/10 px-4 py-3 font-medium text-white transition hover:bg-white/20 active:scale-95"
                        >
                            + Add All N5 Kanji
                        </button>
                        <button
                            onClick={() => router.push("/dashboard")}
                            className="w-full rounded-xl border border-white/10 bg-transparent px-4 py-3 font-medium text-white/70 transition hover:bg-white/5 active:scale-95"
                        >
                            Back to Dashboard
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    const currentCard = cards[currentIndex];

    // Card UI
    return (
        <div className="relative flex min-h-[calc(100vh-0px)] flex-col items-center justify-center overflow-hidden p-6 md:p-12">

            {/* Header / Stats */}
            <div className="absolute top-0 left-0 right-0 flex items-center justify-between p-6 md:px-12 md:py-8">
                <div className="text-sm font-medium text-white/60">
                    <span className="text-fuchsia-400">{cards.length}</span> items due
                </div>
                <div
                    onClick={() => router.push('/dashboard')}
                    className="cursor-pointer text-sm font-medium text-white/40 hover:text-white"
                >
                    Exit
                </div>
            </div>

            {/* Flashcard Area */}
            <div className="relative w-full max-w-lg perspective-[1200px]">
                <div
                    className={cn(
                        "relative flex min-h-[400px] flex-col items-center justify-center rounded-[32px] border border-white/10 bg-white/5 p-8 text-center shadow-[0_20px_100px_rgba(0,0,0,0.5)] backdrop-blur-2xl transition-all duration-500",
                        showAnswer && "border-white/20 bg-black/40"
                    )}
                >
                    <div className="text-sm font-medium tracking-[0.2em] text-white/30 uppercase mb-8">
                        {currentCard.kanji.level}
                    </div>

                    <div className={cn(
                        "text-[120px] leading-tight font-medium text-white transition-all duration-300",
                        showAnswer ? "scale-75 opacity-60 blur-[1px]" : "scale-100 opacity-100"
                    )}>
                        {currentCard.kanji.id}
                    </div>

                    {showAnswer && (
                        <div className="mt-4 animate-in fade-in slide-in-from-bottom-4 duration-300">
                            <div className="text-3xl font-semibold text-white">
                                {currentCard.kanji.meaning}
                            </div>
                            <div className="mt-4 grid grid-cols-2 gap-x-8 gap-y-2 text-left text-sm">
                                <div>
                                    <div className="text-xs text-white/40 uppercase">Onyomi</div>
                                    <div className="text-fuchsia-300 font-mono">{currentCard.kanji.onyomi || "-"}</div>
                                </div>
                                <div>
                                    <div className="text-xs text-white/40 uppercase">Kunyomi</div>
                                    <div className="text-emerald-300 font-mono">{currentCard.kanji.kunyomi || "-"}</div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Controls */}
            <div className="mt-12 w-full max-w-lg">
                {!showAnswer ? (
                    <button
                        onClick={() => setShowAnswer(true)}
                        className="w-full rounded-2xl bg-white text-black font-semibold py-4 text-lg shadow-[0_0_40px_rgba(255,255,255,0.2)] hover:scale-[1.02] active:scale-[0.98] transition-all"
                    >
                        Show Answer
                    </button>
                ) : (
                    <div className="grid grid-cols-4 gap-3">
                        <GradeButton
                            grade={SRSGrade.AGAIN}
                            label="Again"
                            sub="< 1m"
                            color="bg-rose-500 hover:bg-rose-400"
                            onClick={() => handleGrade(SRSGrade.AGAIN)}
                        />
                        <GradeButton
                            grade={SRSGrade.HARD}
                            label="Hard"
                            sub="2d"
                            color="bg-orange-500 hover:bg-orange-400"
                            onClick={() => handleGrade(SRSGrade.HARD)}
                        />
                        <GradeButton
                            grade={SRSGrade.GOOD}
                            label="Good"
                            sub="4d"
                            color="bg-emerald-600 hover:bg-emerald-500"
                            onClick={() => handleGrade(SRSGrade.GOOD)}
                        />
                        <GradeButton
                            grade={SRSGrade.EASY}
                            label="Easy"
                            sub="7d"
                            color="bg-blue-500 hover:bg-blue-400"
                            onClick={() => handleGrade(SRSGrade.EASY)}
                        />
                    </div>
                )}
            </div>
        </div>
    );
}

function GradeButton({ grade, label, sub, color, onClick }: { grade: unknown, label: string, sub: string, color: string, onClick: () => void }) {
    return (
        <button
            onClick={onClick}
            className={cn(
                "group relative flex flex-col items-center justify-center rounded-2xl py-3 transition-all active:scale-95 shadow-lg",
                color,
                "text-white"
            )}
        >
            <span className="font-semibold text-sm">{label}</span>
            <span className="text-[10px] opacity-70 group-hover:opacity-100">{sub}</span>
        </button>
    );
}
