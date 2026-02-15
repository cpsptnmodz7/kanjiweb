// src/lib/srs.ts
export type Rating = "again" | "hard" | "good" | "easy";

export type SrsState = {
    ease: number;        // default 2.5
    interval_days: number;
    reps: number;
    lapses: number;
};

export function nextSrs(state: SrsState, rating: Rating): SrsState & { nextIntervalDays: number } {
    let { ease, interval_days, reps, lapses } = state;

    // clamp ease
    const clampEase = (x: number) => Math.max(1.3, Math.min(3.2, x));

    if (rating === "again") {
        lapses += 1;
        reps = 0;
        interval_days = 0;
        ease = clampEase(ease - 0.2);
        return { ease, interval_days, reps, lapses, nextIntervalDays: 0 };
    }

    reps += 1;

    if (rating === "hard") {
        ease = clampEase(ease - 0.15);
        const next = interval_days <= 1 ? 1 : Math.max(1, Math.round(interval_days * 1.2));
        return { ease, interval_days: next, reps, lapses, nextIntervalDays: next };
    }

    if (rating === "good") {
        ease = clampEase(ease);
        const next =
            interval_days === 0 ? 1 :
                interval_days === 1 ? 3 :
                    Math.max(1, Math.round(interval_days * ease));
        return { ease, interval_days: next, reps, lapses, nextIntervalDays: next };
    }

    // easy
    ease = clampEase(ease + 0.15);
    const next =
        interval_days === 0 ? 2 :
            interval_days === 1 ? 4 :
                Math.max(2, Math.round(interval_days * (ease + 0.15)));
    return { ease, interval_days: next, reps, lapses, nextIntervalDays: next };
}
