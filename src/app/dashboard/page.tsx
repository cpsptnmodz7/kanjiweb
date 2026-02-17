"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { ensureProfile } from "@/lib/progress";

export default function DashboardPage() {
    const router = useRouter();
    const [xp, setXp] = useState(0);
    const [level, setLevel] = useState(1);
    const [coins, setCoins] = useState(0);
    const [streak, setStreak] = useState(0);

    useEffect(() => {
        (async () => {
            const { data } = await supabase.auth.getSession();
            const session = data.session;
            if (!session) {
                router.replace("/login");
                return;
            }
            const p = await ensureProfile(session.user.id);
            setXp(p.xp ?? 0);
            setLevel(p.level ?? 1);
            setCoins(p.coins ?? 0);
            setStreak(p.streak_count ?? 0);
        })();
    }, [router]);

    return (
        <div className="grid cols-2">
            <div className="glass p-6">
                <div className="h1">Dashboard</div>
                <div className="small" style={{ marginTop: 6 }}>
                    Ringkasan progress kamu hari ini.
                </div>

                <div className="grid cols-2" style={{ marginTop: 14 }}>
                    <div className="card p-5">
                        <div className="small">Level</div>
                        <div style={{ fontSize: 34, fontWeight: 900, marginTop: 6 }}>{level}</div>
                    </div>
                    <div className="card p-5">
                        <div className="small">XP</div>
                        <div style={{ fontSize: 34, fontWeight: 900, marginTop: 6 }}>{xp}</div>
                    </div>
                    <div className="card p-5">
                        <div className="small">Streak</div>
                        <div style={{ fontSize: 34, fontWeight: 900, marginTop: 6 }}>{streak}🔥</div>
                    </div>
                    <div className="card p-5">
                        <div className="small">Coins</div>
                        <div style={{ fontSize: 34, fontWeight: 900, marginTop: 6 }}>{coins}</div>
                    </div>
                </div>

                <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 14 }}>
                    <button className="btn btn-primary" onClick={() => router.push("/missions")}>Daily Missions</button>
                    <button className="btn" onClick={() => router.push("/shop")}>Reward Shop</button>
                    <button className="btn" onClick={() => router.push("/voice")}>Voice Class</button>
                </div>
            </div>

            <div className="grid" style={{ alignContent: "start" }}>
                <div className="card p-5">
                    <div className="h2">Next Up</div>
                    <div className="small" style={{ marginTop: 10 }}>
                        • Selesaikan misi harian untuk reward <br />
                        • Naikkan streak untuk badge <br />
                        • Join voice class untuk bonus XP
                    </div>
                </div>

                <div className="card p-5">
                    <div className="h2">Badges</div>
                    <div className="small" style={{ marginTop: 10 }}>
                        (Auto unlock: streak 3/7/30, XP 500/2000)
                    </div>
                </div>
            </div>
        </div>
    );
}
