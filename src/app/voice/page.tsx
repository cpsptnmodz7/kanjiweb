"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { awardXPAndCoins, bumpDailyMission } from "@/lib/progress";

type Room = {
    id: string;
    room_name: string;
    title: string;
    is_active: boolean;
};

function safeUsername(email?: string | null) {
    if (!email) return "user";
    return (email.split("@")[0] || "user").slice(0, 24);
}

export default function VoiceLobbyPage() {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [rooms, setRooms] = useState<Room[]>([]);
    const [userId, setUserId] = useState("");
    const [email, setEmail] = useState("");
    const username = useMemo(() => safeUsername(email), [email]);

    useEffect(() => {
        let mounted = true;
        (async () => {
            setLoading(true);
            const { data } = await supabase.auth.getSession();
            const session = data.session;
            if (!session) { router.replace("/login"); return; }
            if (!mounted) return;

            setUserId(session.user.id);
            setEmail(session.user.email ?? "");

            const { data: r, error } = await supabase
                .from("voice_rooms")
                .select("id,room_name,title,is_active")
                .eq("is_active", true)
                .order("created_at", { ascending: true });

            if (!mounted) return;
            if (error) { console.error("Fetch rooms error:", error); setRooms([]); }
            else { setRooms((r as Room[]) ?? []); }
            setLoading(false);
        })();
        return () => { mounted = false; };
    }, [router]);

    async function join(room: Room) {
        if (!userId) return;
        try { await supabase.from("voice_room_join_logs").insert({ user_id: userId, room_id: room.id }); } catch { }
        try { await bumpDailyMission({ userId, missionCode: "voice_1", amount: 1 }); } catch { }
        try { await awardXPAndCoins({ userId, source: "voice", xp: 10, coins: 2, meta: { room: room.room_name } }); } catch { }
        router.push(`/voice/${encodeURIComponent(room.room_name)}`);
    }

    return (
        <div className="glass p-6" style={{ maxWidth: 900, margin: "0 auto" }}>
            {/* Header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 14 }}>
                <div>
                    <div className="h1">🎙️ Voice Class</div>
                    <div className="small" style={{ marginTop: 6 }}>
                        Pilih room dan gabung untuk belajar bareng. <span style={{ opacity: .6 }}>(LiveKit)</span>
                    </div>
                    <div className="small" style={{ marginTop: 4, opacity: .7 }}>
                        Logged in as <b>{username}</b>
                    </div>
                </div>
                <button className="btn btn-ghost" onClick={() => router.push("/")}>Main Menu</button>
            </div>

            {/* Room List */}
            <div style={{ marginTop: 20 }}>
                {loading ? (
                    <div className="grid cols-2" style={{ gap: 14 }}>
                        <div className="card p-5" style={{ height: 100 }}>
                            <div className="spinner" style={{ margin: "auto" }} />
                        </div>
                        <div className="card p-5" style={{ height: 100 }}>
                            <div className="spinner" style={{ margin: "auto" }} />
                        </div>
                    </div>
                ) : rooms.length === 0 ? (
                    <div className="card p-5" style={{ textAlign: "center", padding: 30 }}>
                        <div className="h2">Belum ada room aktif</div>
                        <div className="small" style={{ marginTop: 10 }}>
                            Pastikan tabel <b>voice_rooms</b> sudah ada dan kolom <b>is_active = true</b>.
                        </div>
                        <div className="small" style={{ marginTop: 8, opacity: .6 }}>
                            🎧 Tips: gunakan headset agar tidak echo
                        </div>
                    </div>
                ) : (
                    <div className="grid cols-2" style={{ gap: 14 }}>
                        {rooms.map((r) => (
                            <div key={r.id} className="card p-5">
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
                                    <div>
                                        <div className="h2">{r.title}</div>
                                        <div className="small" style={{ marginTop: 6 }}>
                                            Room: <b>{r.room_name}</b>
                                        </div>
                                    </div>
                                    <span style={{
                                        fontSize: 11,
                                        padding: "4px 10px",
                                        borderRadius: 999,
                                        background: "rgba(16,185,129,.15)",
                                        border: "1px solid rgba(16,185,129,.25)",
                                        color: "rgba(167,243,208,1)",
                                    }}>
                                        ● Open
                                    </span>
                                </div>
                                <button
                                    className="btn btn-primary"
                                    style={{ marginTop: 14, width: "100%" }}
                                    onClick={() => join(r)}
                                >
                                    Join Room
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <div className="small" style={{ marginTop: 16, opacity: .5, textAlign: "center" }}>
                🎧 Gunakan headset untuk pengalaman suara terbaik
            </div>
        </div>
    );
}
