"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { nextSrs, type Rating } from "@/lib/srs";

type KanjiRow = {
    id: string;
    level: string;
    meaning: string;
    onyomi: string | null;
    kunyomi: string | null;
};

type CardRow = {
    user_id: string;
    kanji_id: string;
    ease: number;
    interval_days: number;
    reps: number;
    lapses: number;
    due_at: string;
};

function todayISODate() {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
}

export default function ReviewPage() {
    const router = useRouter();

    const [loading, setLoading] = useState(true);
    const [userId, setUserId] = useState<string>("");
    const [email, setEmail] = useState<string>("");

    const [cards, setCards] = useState<CardRow[]>([]);
    const [kanjiMap, setKanjiMap] = useState<Record<string, KanjiRow>>({});

    const [idx, setIdx] = useState(0);
    const [picked, setPicked] = useState<string | null>(null);
    const [feedback, setFeedback] = useState<"idle" | "correct" | "wrong">("idle");

    const current = cards[idx] || null;
    const currentKanji = current ? kanjiMap[current.kanji_id] : null;

    const choices = useMemo(() => {
        if (!currentKanji) return [];
        // meaning -> choose kanji
        const pool = Object.values(kanjiMap);
        if (pool.length < 4) return [];
        const correct = currentKanji;
        const wrongs = pool.filter((k) => k.id !== correct.id).sort(() => Math.random() - 0.5).slice(0, 3);
        return [correct, ...wrongs].sort(() => Math.random() - 0.5);
    }, [currentKanji, kanjiMap]);

    useEffect(() => {
        (async () => {
            const { data } = await supabase.auth.getSession();
            const session = data.session;
            if (!session) {
                router.replace("/login");
                return;
            }
            setUserId(session.user.id);
            setEmail(session.user.email ?? "");
            await ensureDailyMission(session.user.id);
            await loadDue(session.user.id);
        })();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    async function ensureDailyMission(uid: string) {
        const d = todayISODate();
        // upsert mission + progress row
        await supabase.from("daily_missions").upsert(
            { user_id: uid, mission_date: d, goal_reviews: 10, goal_accuracy: 0.8, goal_minutes: 5 },
            { onConflict: "user_id,mission_date" }
        );
        await supabase.from("daily_progress").upsert(
            { user_id: uid, prog_date: d, reviews_done: 0, correct_done: 0, minutes_done: 0 },
            { onConflict: "user_id,prog_date" }
        );
    }

    async function loadDue(uid: string) {
        setLoading(true);

        // 1) get due cards
        const { data: due, error } = await supabase
            .from("srs_cards")
            .select("user_id,kanji_id,ease,interval_days,reps,lapses,due_at")
            .eq("user_id", uid)
            .lte("due_at", new Date().toISOString())
            .order("due_at", { ascending: true })
            .limit(20);

        if (error) {
            console.error(error);
            setCards([]);
            setLoading(false);
            return;
        }

        let dueCards = (due ?? []) as CardRow[];

        // If no cards exist at all → seed from N5
        if (dueCards.length === 0) {
            const { data: anyCard } = await supabase
                .from("srs_cards")
                .select("kanji_id")
                .eq("user_id", uid)
                .limit(1);

            if (!anyCard || anyCard.length === 0) {
                await seedN5(uid, 30);
            }

            // reload due
            const { data: due2 } = await supabase
                .from("srs_cards")
                .select("user_id,kanji_id,ease,interval_days,reps,lapses,due_at")
                .eq("user_id", uid)
                .lte("due_at", new Date().toISOString())
                .order("due_at", { ascending: true })
                .limit(20);

            dueCards = (due2 ?? []) as CardRow[];
        }

        setCards(dueCards);
        setIdx(0);
        setPicked(null);
        setFeedback("idle");

        // fetch kanji details for those due cards
        const ids = Array.from(new Set(dueCards.map((c) => c.kanji_id)));
        if (ids.length === 0) {
            setKanjiMap({});
            setLoading(false);
            return;
        }

        const { data: krows, error: e2 } = await supabase
            .from("kanji")
            .select("id,level,meaning,onyomi,kunyomi")
            .in("id", ids);

        if (e2) {
            console.error(e2);
            setKanjiMap({});
            setLoading(false);
            return;
        }

        const map: Record<string, KanjiRow> = {};
        for (const k of (krows ?? []) as KanjiRow[]) map[k.id] = k;
        setKanjiMap(map);

        setLoading(false);
    }

    async function seedN5(uid: string, count: number) {
        // seed SRS cards for N5
        const { data: n5, error } = await supabase
            .from("kanji")
            .select("id")
            .eq("level", "N5")
            .limit(count);

        if (error) throw error;

        const rows = (n5 ?? []).map((r: { id: string }) => ({
            user_id: uid,
            kanji_id: r.id,
            ease: 2.5,
            interval_days: 0,
            reps: 0,
            lapses: 0,
            due_at: new Date().toISOString(),
        }));

        await supabase.from("srs_cards").upsert(rows, { onConflict: "user_id,kanji_id" });
    }

    async function applyDaily(uid: string, correct: boolean) {
        const d = todayISODate();

        // progress increment
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

        const last = stats?.last_active_date as string | null;
        const today = d;

        let streak = stats?.streak ?? 0;
        if (!last) streak = 1;
        else if (last === today) streak = streak;
        else {
            const lastDate = new Date(last + "T00:00:00Z");
            const todayDate = new Date(today + "T00:00:00Z");
            const diffDays = Math.round((todayDate.getTime() - lastDate.getTime()) / 86400000);

            if (diffDays === 1) streak += 1;
            else streak = 1;
        }

        let xp = (stats?.xp ?? 0) + (correct ? 8 : 3);
        let level = stats?.level ?? 1;
        const need = level * 120;
        if (xp >= need) {
            level += 1;
            xp = xp - need;
        }

        await supabase
            .from("user_stats")
            .upsert({ user_id: uid, streak, last_active_date: today, xp, level }, { onConflict: "user_id" });
    }

    async function grade(rating: Rating, chosenId?: string) {
        if (!current || !currentKanji || picked) return;

        const correct = chosenId ? chosenId === currentKanji.id : rating !== "again";
        setPicked(chosenId ?? currentKanji.id);
        setFeedback(correct ? "correct" : "wrong");

        // update SRS
        const next = nextSrs(
            {
                ease: current.ease,
                interval_days: current.interval_days,
                reps: current.reps,
                lapses: current.lapses,
            },
            rating
        );

        const due = new Date();
        // immediate if again, else add days
        if (next.nextIntervalDays > 0) due.setDate(due.getDate() + next.nextIntervalDays);

        await supabase.from("srs_cards").upsert(
            {
                user_id: userId,
                kanji_id: currentKanji.id,
                ease: next.ease,
                interval_days: next.interval_days,
                reps: next.reps,
                lapses: next.lapses,
                due_at: due.toISOString(),
                last_reviewed_at: new Date().toISOString(),
            },
            { onConflict: "user_id,kanji_id" }
        );

        // insert log
        await supabase.from("review_logs").insert({
            user_id: userId,
            kanji_id: currentKanji.id,
            correct,
            rating,
            mode: "review",
        });

        // daily + streak/xp
        await applyDaily(userId, correct);

        // next
        setTimeout(() => {
            setPicked(null);
            setFeedback("idle");
            setIdx((v) => Math.min(v + 1, cards.length)); // allow end
        }, 520);
    }

    const finished = !loading && cards.length > 0 && idx >= cards.length;

    return (
        <div className="min-h-screen px-4 py-10">
            <div className="mx-auto max-w-4xl">
                <div className="rounded-[28px] border border-white/10 bg-white/5 p-6 md:p-8 backdrop-blur-xl shadow-[0_30px_120px_rgba(0,0,0,0.45)]">
                    <div className="flex items-center justify-between gap-3">
                        <div>
                            <div className="text-sm text-white/60">Kanji Laopu • Smart Review</div>
                            <div className="text-xl font-semibold">Due Today</div>
                            <div className="text-xs text-white/50">{email}</div>
                        </div>
                        <div className="flex gap-2">
                            <button
                                onClick={() => router.push("/")}
                                className="rounded-xl bg-white/10 px-4 py-2 text-sm hover:bg-white/15"
                            >
                                Home
                            </button>
                            <button
                                onClick={() => loadDue(userId)}
                                className="rounded-xl bg-white/10 px-4 py-2 text-sm hover:bg-white/15"
                            >
                                Refresh
                            </button>
                        </div>
                    </div>

                    <div className="mt-5 h-2 rounded-full bg-white/10 overflow-hidden">
                        <div
                            className="h-2 rounded-full bg-gradient-to-r from-fuchsia-500 to-pink-500 transition-all"
                            style={{
                                width: cards.length ? `${Math.min((idx / cards.length) * 100, 100)}%` : "0%",
                            }}
                        />
                    </div>

                    <div className="mt-6 rounded-2xl border border-white/10 bg-black/20 p-6">
                        {loading ? (
                            <div className="text-white/70">Loading due cards…</div>
                        ) : cards.length === 0 ? (
                            <div className="text-white/70">
                                Belum ada due review. Nanti setelah quiz/learning, due akan muncul.
                            </div>
                        ) : finished ? (
                            <div>
                                <div className="text-2xl font-semibold">Selesai 🎉</div>
                                <div className="mt-2 text-white/70">Semua due hari ini sudah beres.</div>
                                <div className="mt-4 flex gap-2">
                                    <button
                                        onClick={() => router.push("/quiz")}
                                        className="rounded-xl bg-gradient-to-r from-fuchsia-500 to-pink-500 px-4 py-2 text-sm font-medium"
                                    >
                                        Practice Quiz
                                    </button>
                                    <button
                                        onClick={() => router.push("/dashboard")}
                                        className="rounded-xl bg-white/10 px-4 py-2 text-sm hover:bg-white/15"
                                    >
                                        Dashboard
                                    </button>
                                </div>
                            </div>
                        ) : !currentKanji ? (
                            <div className="text-white/70">Menyiapkan soal…</div>
                        ) : (
                            <>
                                <div className="text-xs tracking-[0.25em] text-white/50">MEANING</div>
                                <div className="mt-2 text-4xl md:text-5xl font-semibold">{currentKanji.meaning}</div>

                                <div className="mt-6 grid grid-cols-2 gap-3">
                                    {choices.map((k) => {
                                        const isChosen = picked === k.id;
                                        const isCorrect = k.id === currentKanji.id;

                                        const cls =
                                            picked === null
                                                ? "bg-white/5 hover:bg-white/10 border-white/10"
                                                : isChosen && isCorrect
                                                    ? "bg-emerald-500/15 border-emerald-400/40"
                                                    : isChosen && !isCorrect
                                                        ? "bg-rose-500/15 border-rose-400/40"
                                                        : isCorrect
                                                            ? "bg-emerald-500/10 border-emerald-400/25"
                                                            : "bg-white/5 border-white/10 opacity-70";

                                        return (
                                            <button
                                                key={k.id}
                                                disabled={picked !== null}
                                                onClick={() => grade(k.id === currentKanji.id ? "good" : "again", k.id)}
                                                className={`rounded-2xl border p-6 md:p-7 text-center transition ${cls}`}
                                            >
                                                <div className="text-4xl md:text-5xl font-medium">{k.id}</div>
                                                <div className="mt-2 text-xs text-white/55">{k.level}</div>
                                            </button>
                                        );
                                    })}
                                </div>

                                <div className="mt-5 flex items-center justify-between">
                                    <div className="text-xs text-white/55">
                                        Card {idx + 1}/{cards.length} • Ease {current.ease.toFixed(2)} • Interval {current.interval_days}d
                                    </div>
                                    <div className={`text-sm transition ${feedback === "idle" ? "opacity-0" : "opacity-100"}`}>
                                        {feedback === "correct" ? "Nice! ✅" : "Oops ❌"}
                                    </div>
                                </div>

                                {/* Manual rating buttons (Anki-style) */}
                                <div className="mt-4 grid grid-cols-4 gap-2">
                                    <button
                                        onClick={() => grade("again")}
                                        className="rounded-xl bg-white/10 px-3 py-2 text-sm hover:bg-white/15"
                                    >
                                        Again
                                    </button>
                                    <button
                                        onClick={() => grade("hard")}
                                        className="rounded-xl bg-white/10 px-3 py-2 text-sm hover:bg-white/15"
                                    >
                                        Hard
                                    </button>
                                    <button
                                        onClick={() => grade("good")}
                                        className="rounded-xl bg-gradient-to-r from-fuchsia-500/80 to-pink-500/80 px-3 py-2 text-sm font-medium hover:brightness-110"
                                    >
                                        Good
                                    </button>
                                    <button
                                        onClick={() => grade("easy")}
                                        className="rounded-xl bg-white/10 px-3 py-2 text-sm hover:bg-white/15"
                                    >
                                        Easy
                                    </button>
                                </div>
                            </>
                        )}
                    </div>

                    <div className="mt-6 text-xs text-white/50">
                        Next: Dashboard akan ambil data dari review_logs + daily_progress + user_stats untuk grafik dan streak.
                    </div>
                </div>
            </div>
        </div>
    );
}
