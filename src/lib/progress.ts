import { supabase } from "@/lib/supabaseClient";

/* ─── helpers ─── */

export function calcLevel(xp: number) {
    let level = 1;
    let need = 200;
    let remaining = xp;
    while (remaining >= need) {
        remaining -= need;
        level += 1;
        need = Math.floor(need * 1.15);
        if (level > 99) break;
    }
    return level;
}

function isoDate(d: Date) {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
}

function todayISODate() {
    return isoDate(new Date());
}

function yesterdayISODate() {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return isoDate(d);
}

/* ─── types ─── */

export type UserProfile = {
    user_id: string;
    xp: number;
    level: number;
    coins: number;
    streak_count: number;
    last_active_date: string | null;
};

/* ─── ensure profile exists ─── */

export async function ensureProfile(userId: string): Promise<UserProfile> {
    const { data, error } = await supabase
        .from("user_profile")
        .select("user_id,xp,level,coins,streak_count,last_active_date")
        .eq("user_id", userId)
        .maybeSingle();

    if (error) throw error;

    if (data) return data as UserProfile;

    // Profile doesn't exist yet — create it
    const fresh: UserProfile = {
        user_id: userId,
        xp: 0,
        level: 1,
        coins: 0,
        streak_count: 0,
        last_active_date: null,
    };

    const { error: e2 } = await supabase.from("user_profile").insert(fresh);
    if (e2) throw e2;

    return fresh;
}

/* ─── award XP & coins ─── */

export async function awardXPAndCoins(params: {
    userId: string;
    source: "quiz" | "review" | "mission" | "voice" | "savings";
    xp: number;
    coins?: number;
    meta?: any;
}) {
    const coinsDelta = params.coins ?? 0;
    const today = todayISODate();
    const yday = yesterdayISODate();

    // 1) ensure profile
    const profile = await ensureProfile(params.userId);

    // 2) streak
    let streak = profile.streak_count ?? 0;
    const last = profile.last_active_date ? String(profile.last_active_date) : null;

    if (last === today) {
        // same day — keep streak
    } else if (last === yday) {
        streak += 1;
    } else {
        streak = 1;
    }

    // 3) new totals
    const newXP = (profile.xp ?? 0) + (params.xp ?? 0);
    const newCoins = (profile.coins ?? 0) + coinsDelta;
    const newLevel = calcLevel(newXP);

    // 4) log xp event
    const { error: e1 } = await supabase.from("xp_events").insert({
        user_id: params.userId,
        source: params.source,
        points: params.xp,
        meta: params.meta ?? null,
    });
    if (e1) throw e1;

    // 5) update profile
    const { error: e2 } = await supabase
        .from("user_profile")
        .update({
            xp: newXP,
            level: newLevel,
            coins: newCoins,
            streak_count: streak,
            last_active_date: today,
        })
        .eq("user_id", params.userId);

    if (e2) throw e2;

    // 6) auto badges
    await maybeGrantBadges(params.userId, { xp: newXP, streak });

    return { xp: newXP, level: newLevel, coins: newCoins, streak };
}

/* ─── badges ─── */

async function maybeGrantBadges(userId: string, stats: { xp: number; streak: number }) {
    const candidates: string[] = [];
    if (stats.streak >= 3) candidates.push("streak_3");
    if (stats.streak >= 7) candidates.push("streak_7");
    if (stats.streak >= 30) candidates.push("streak_30");
    if (stats.xp >= 500) candidates.push("xp_500");
    if (stats.xp >= 2000) candidates.push("xp_2000");

    if (candidates.length === 0) return;

    const { error } = await supabase
        .from("user_badges")
        .upsert(
            candidates.map((code) => ({ user_id: userId, badge_code: code })),
            { onConflict: "user_id,badge_code" }
        );

    if (error) {
        console.warn("maybeGrantBadges error:", error.message);
    }
}

/* ─── daily mission bump ─── */

export async function bumpDailyMission(params: {
    userId: string;
    missionCode: string;
    amount: number;
}) {
    const day = todayISODate();

    // Get target from master mission table
    const { data: mission, error: mErr } = await supabase
        .from("daily_missions")
        .select("code,target")
        .eq("code", params.missionCode)
        .maybeSingle();

    if (mErr) throw mErr;
    if (!mission) return; // mission not found / inactive

    const target = mission.target ?? 1;

    // Check existing progress for today
    const { data: row, error } = await supabase
        .from("daily_mission_progress")
        .select("id,progress,completed,claimed")
        .eq("user_id", params.userId)
        .eq("mission_code", params.missionCode)
        .eq("day", day)
        .maybeSingle();

    if (error) throw error;

    if (!row) {
        const progress = params.amount;
        const completed = progress >= target;

        const { error: e2 } = await supabase.from("daily_mission_progress").insert({
            user_id: params.userId,
            mission_code: params.missionCode,
            day,
            progress,
            completed,
            claimed: false,
        });
        if (e2) throw e2;
        return;
    }

    const newProgress = (row.progress ?? 0) + params.amount;
    const completed = newProgress >= target;

    const { error: e3 } = await supabase
        .from("daily_mission_progress")
        .update({ progress: newProgress, completed })
        .eq("id", row.id);

    if (e3) throw e3;
}

/* ─── claim mission reward ─── */

export async function claimMissionReward(userId: string, missionCode: string) {
    const day = todayISODate();

    const { data: mission, error: mErr } = await supabase
        .from("daily_missions")
        .select("code,target,reward_xp,reward_coins")
        .eq("code", missionCode)
        .maybeSingle();

    if (mErr) throw mErr;
    if (!mission) throw new Error("Mission not found");

    const { data: prog, error: pErr } = await supabase
        .from("daily_mission_progress")
        .select("id,progress,completed,claimed")
        .eq("user_id", userId)
        .eq("mission_code", missionCode)
        .eq("day", day)
        .maybeSingle();

    if (pErr) throw pErr;
    if (!prog) throw new Error("No mission progress");
    if (prog.claimed) return { ok: true, already: true };

    if ((prog.progress ?? 0) < (mission.target ?? 1)) {
        throw new Error("Mission not complete yet");
    }

    const { error: uErr } = await supabase
        .from("daily_mission_progress")
        .update({ completed: true, claimed: true })
        .eq("id", prog.id);

    if (uErr) throw uErr;

    await awardXPAndCoins({
        userId,
        source: "mission",
        xp: mission.reward_xp ?? 0,
        coins: mission.reward_coins ?? 0,
        meta: { mission: missionCode },
    });

    return { ok: true };
}

/* ─── buy shop item ─── */

export async function buyShopItem(userId: string, sku: string) {
    const { data: item, error: iErr } = await supabase
        .from("shop_items")
        .select("sku,price_coins,is_active")
        .eq("sku", sku)
        .maybeSingle();

    if (iErr) throw iErr;
    if (!item || item.is_active === false) throw new Error("Item not found");

    const profile = await ensureProfile(userId);
    const price = item.price_coins ?? 0;

    if ((profile.coins ?? 0) < price) throw new Error("Coins tidak cukup");

    const { error: pErr } = await supabase.from("user_purchases").insert({ user_id: userId, sku });
    if (pErr) {
        if ((pErr as any).code === "23505") {
            throw new Error("Item ini sudah kamu beli");
        }
        throw pErr;
    }

    const { error: uErr } = await supabase
        .from("user_profile")
        .update({ coins: (profile.coins ?? 0) - price })
        .eq("user_id", userId);

    if (uErr) throw uErr;

    return { ok: true };
}
