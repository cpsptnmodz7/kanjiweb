"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { claimMissionReward } from "@/lib/progress";

type Mission = {
    code: string;
    title: string;
    description: string | null;
    target: number;
    reward_xp: number;
    reward_coins: number;
};

type Progress = {
    mission_code: string;
    progress: number;
    completed: boolean;
    claimed: boolean;
};

function today() {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
}

export default function MissionsPage() {
    const [userId, setUserId] = useState("");
    const [missions, setMissions] = useState<Mission[]>([]);
    const [progress, setProgress] = useState<Record<string, Progress>>({});
    const [msg, setMsg] = useState("");

    useEffect(() => {
        (async () => {
            const { data } = await supabase.auth.getSession();
            const session = data.session;
            if (!session) return;
            setUserId(session.user.id);

            // ✅ MASTER MISSIONS
            const { data: m, error: mErr } = await supabase
                .from("daily_missions")
                .select("code,title,description,target,reward_xp,reward_coins")
                .eq("is_active", true)
                .order("created_at", { ascending: true });

            if (!mErr && m) setMissions(m as any);

            // ✅ PROGRESS
            const { data: p, error: pErr } = await supabase
                .from("daily_mission_progress")
                .select("mission_code,progress,completed,claimed")
                .eq("user_id", session.user.id)
                .eq("day", today());

            if (!pErr) {
                const map: Record<string, Progress> = {};
                (p || []).forEach((x: any) => (map[x.mission_code] = x));
                setProgress(map);
            }
        })();
    }, []);

    const list = useMemo(() => {
        return missions.map((m) => {
            const p = progress[m.code];
            const prog = p?.progress ?? 0;
            const done = prog >= m.target;
            const claimed = p?.claimed ?? false;
            return { m, prog, done, claimed };
        });
    }, [missions, progress]);

    async function claim(code: string) {
        setMsg("");
        try {
            await claimMissionReward(userId, code);
            setMsg("Reward claimed!");

            const { data: p } = await supabase
                .from("daily_mission_progress")
                .select("mission_code,progress,completed,claimed")
                .eq("user_id", userId)
                .eq("day", today());

            const map: Record<string, Progress> = {};
            (p || []).forEach((x: any) => (map[x.mission_code] = x));
            setProgress(map);
        } catch (e: any) {
            setMsg(e?.message || "Failed");
        }
    }

    return (
        <div className="glass p-6">
            <div className="h1">Daily Missions</div>
            <div className="small" style={{ marginTop: 6 }}>
                Selesaikan misi harian untuk dapat XP & coins.
            </div>

            {msg && (
                <div className="card p-5" style={{ marginTop: 14 }}>
                    {msg}
                </div>
            )}

            <div className="grid cols-2" style={{ marginTop: 14 }}>
                {list.map(({ m, prog, done, claimed }) => {
                    const pct = Math.min(100, Math.round((prog / m.target) * 100));
                    return (
                        <div key={m.code} className="card p-5">
                            <div className="h2">{m.title}</div>
                            <div className="small" style={{ marginTop: 6 }}>
                                {m.description || ""}
                            </div>

                            <div
                                style={{
                                    marginTop: 12,
                                    height: 12,
                                    borderRadius: 999,
                                    background: "rgba(255,255,255,.08)",
                                    overflow: "hidden",
                                }}
                            >
                                <div
                                    style={{
                                        width: `${pct}%`,
                                        height: "100%",
                                        background: "linear-gradient(90deg, var(--pink), var(--pink2))",
                                    }}
                                />
                            </div>

                            <div className="small" style={{ marginTop: 10 }}>
                                Progress: <b>{prog}</b> / {m.target} • Reward:{" "}
                                <b>{m.reward_xp} XP</b> + <b>{m.reward_coins} coins</b>
                            </div>

                            <button
                                className={`btn ${done && !claimed ? "btn-primary" : ""}`}
                                style={{ marginTop: 12 }}
                                disabled={!done || claimed}
                                onClick={() => claim(m.code)}
                            >
                                {claimed ? "Claimed" : done ? "Claim Reward" : "Not completed"}
                            </button>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
