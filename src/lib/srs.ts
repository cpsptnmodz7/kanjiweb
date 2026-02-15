export enum SRSGrade {
    AGAIN = 0,
    HARD = 1,
    GOOD = 2,
    EASY = 3,
}

export interface SRSState {
    interval: number; // days
    repetition: number;
    easeFactor: number;
}

/**
 * SuperMemo-2 Style Algorithm (Anki-like)
 */
export function calculateNextReview(current: SRSState, grade: SRSGrade): SRSState {
    let { interval, repetition, easeFactor } = current;

    if (grade === SRSGrade.AGAIN) {
        return {
            interval: 0, // < 1 day (minutes)
            repetition: 0,
            easeFactor: Math.max(1.3, easeFactor - 0.2),
        };
    }

    // Success (Hard, Good, Easy)
    if (repetition === 0) {
        interval = 1;
    } else if (repetition === 1) {
        interval = 6;
    } else {
        interval = Math.round(interval * easeFactor);
    }

    repetition += 1;

    // Ease adjustments
    if (grade === SRSGrade.HARD) {
        easeFactor = Math.max(1.3, easeFactor - 0.15);
    } else if (grade === SRSGrade.EASY) {
        easeFactor += 0.15;
    }
    // Good: easeFactor unchanged

    return { interval, repetition, easeFactor };
}
