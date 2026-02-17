"use client";

import "@livekit/components-styles";
import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import {
    LiveKitRoom,
    RoomAudioRenderer,
    ControlBar,
} from "@livekit/components-react";

type TokenRes = { token: string; url?: string };

export default function VoiceRoomPage() {
    const router = useRouter();
    const params = useParams<{ room: string }>();
    const roomName = useMemo(() => decodeURIComponent(params.room || ""), [params.room]);

    const [loading, setLoading] = useState(true);
    const [errMsg, setErrMsg] = useState("");
    const [lkUrl, setLkUrl] = useState(process.env.NEXT_PUBLIC_LIVEKIT_URL || "");
    const [token, setToken] = useState("");
    const [identity, setIdentity] = useState("");

    useEffect(() => {
        (async () => {
            setLoading(true);
            setErrMsg("");

            const { data } = await supabase.auth.getSession();
            const session = data.session;
            if (!session) { router.replace("/login"); return; }

            const email = session.user.email || "";
            const name = email ? email.split("@")[0] : session.user.id.slice(0, 8);
            setIdentity(name);

            try {
                const res = await fetch(
                    `/api/livekit?room=${encodeURIComponent(roomName)}&identity=${encodeURIComponent(name)}`
                );

                if (!res.ok) {
                    const text = await res.text();
                    setErrMsg(`API error ${res.status}: ${text}`);
                    setLoading(false);
                    return;
                }

                const json = (await res.json()) as TokenRes;
                if (!json.token) {
                    setErrMsg("Token kosong dari API.");
                    setLoading(false);
                    return;
                }

                if (json.url) setLkUrl(json.url);
                setToken(json.token);
            } catch (e: any) {
                setErrMsg(e?.message || "Network error");
            }
            setLoading(false);
        })();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [roomName, router]);

    /* ---- Loading State ---- */
    if (loading) {
        return (
            <div className="glass p-6" style={{ maxWidth: 900, margin: "0 auto", textAlign: "center", padding: 40 }}>
                <div className="spinner" />
                <div className="small" style={{ marginTop: 12 }}>Menghubungkan ke room <b>{roomName}</b>…</div>
            </div>
        );
    }

    /* ---- Error State ---- */
    if (errMsg || !token || !lkUrl) {
        return (
            <div className="glass p-6" style={{ maxWidth: 900, margin: "0 auto" }}>
                <div className="h1">⚠️ Voice Room</div>
                <div className="small" style={{ marginTop: 10 }}>
                    {errMsg || "Konfigurasi belum lengkap."}
                </div>
                <div className="card p-5" style={{ marginTop: 14 }}>
                    <div className="small">Pastikan:</div>
                    <ul style={{ marginTop: 6, paddingLeft: 18, fontSize: 13, opacity: .8, lineHeight: 1.7 }}>
                        <li><code>NEXT_PUBLIC_LIVEKIT_URL</code> terisi di .env.local</li>
                        <li><code>LIVEKIT_API_KEY</code> dan <code>LIVEKIT_API_SECRET</code> terisi</li>
                        <li>API route <code>/api/livekit</code> mengembalikan token valid</li>
                    </ul>
                </div>
                <div style={{ marginTop: 16, display: "flex", gap: 10 }}>
                    <button className="btn btn-primary" onClick={() => router.push("/voice")}>Kembali</button>
                    <button className="btn" onClick={() => window.location.reload()}>Coba Lagi</button>
                </div>
            </div>
        );
    }

    /* ---- Connected State ---- */
    return (
        <div className="glass p-6" style={{ maxWidth: 1100, margin: "0 auto" }}>
            {/* Header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 14 }}>
                <div>
                    <div className="h1">🎙️ {roomName}</div>
                    <div className="small" style={{ marginTop: 6 }}>
                        Voice conference • kamu sebagai <b>{identity}</b>
                    </div>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                    <button className="btn btn-ghost" onClick={() => router.push("/voice")}>Back</button>
                    <button className="btn btn-ghost" onClick={() => router.push("/")}>Home</button>
                </div>
            </div>

            <div className="divider" />

            {/* LiveKit Room */}
            <LiveKitRoom
                video={false}
                audio={true}
                token={token}
                serverUrl={lkUrl}
                connect={true}
                data-lk-theme="default"
                style={{ width: "100%" }}
            >
                <RoomAudioRenderer />

                <div className="voiceRoomLayout">
                    {/* Stage Area */}
                    <div className="voiceMain">
                        <div className="card p-5 voiceStage">
                            <div className="small" style={{ marginBottom: 10, opacity: .5 }}>🎤 STAGE</div>
                            <div className="small" style={{ opacity: .7 }}>
                                Peserta yang terhubung akan muncul di sini.
                                <br />Pastikan microphone kamu aktif di controls di bawah.
                            </div>
                        </div>

                        <div className="card p-5" style={{ marginTop: 12 }}>
                            <ControlBar
                                variation="minimal"
                                controls={{ microphone: true, camera: false, screenShare: false, leave: true }}
                            />
                        </div>
                    </div>
                </div>
            </LiveKitRoom>
        </div>
    );
}
