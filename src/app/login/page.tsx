"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

function getErr(e: any) {
    const msg = e?.message || String(e);
    if (msg.toLowerCase().includes("invalid api key")) {
        return "Invalid API key. Cek ENV Supabase di Vercel (.env / Environment Variables) lalu redeploy.";
    }
    return msg;
}

export default function LoginPage() {
    const router = useRouter();
    const [mode, setMode] = useState<"login" | "register">("login");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [err, setErrMsg] = useState<string | null>(null);

    const canSubmit = useMemo(() => email.length > 4 && password.length >= 6, [email, password]);

    async function submit() {
        setLoading(true);
        setErrMsg(null);

        try {
            if (mode === "login") {
                const { error } = await supabase.auth.signInWithPassword({ email, password });
                if (error) throw error;
                router.replace("/");
            } else {
                const { error } = await supabase.auth.signUp({ email, password });
                if (error) throw error;
                // kalau confirm email aktif, user perlu cek email. Tapi tetap arahkan ke home agar UX bagus.
                router.replace("/");
            }
        } catch (e: any) {
            setErrMsg(getErr(e));
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="glass p-6 md:p-7">
            <div style={{ display: "flex", justifyContent: "center", marginBottom: 14 }}>
                <div
                    style={{
                        width: 54,
                        height: 54,
                        borderRadius: 18,
                        background: "radial-gradient(circle at 30% 30%, rgba(255,45,166,.95), rgba(184,51,255,.55))",
                        border: "1px solid rgba(255,255,255,.16)",
                        boxShadow: "0 16px 40px rgba(255,45,166,.22)",
                        display: "grid",
                        placeItems: "center",
                    }}
                >
                    <span style={{ fontWeight: 900, color: "white" }}>今</span>
                </div>
            </div>

            <div style={{ textAlign: "center" }}>
                <div className="h1">Kanji Laopu</div>
                <div className="small" style={{ marginTop: 6 }}>
                    Masuk untuk lanjut belajar kanji, review, dan progress.
                </div>
            </div>

            <div style={{ display: "flex", gap: 10, marginTop: 18 }}>
                <button
                    className={`btn ${mode === "login" ? "btn-primary" : ""}`}
                    style={{ flex: 1 }}
                    onClick={() => setMode("login")}
                >
                    Login
                </button>
                <button
                    className={`btn ${mode === "register" ? "btn-primary" : ""}`}
                    style={{ flex: 1 }}
                    onClick={() => setMode("register")}
                >
                    Register
                </button>
            </div>

            <div style={{ marginTop: 16 }}>
                <label className="small">Email</label>
                <input className="input" placeholder="you@email.com" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>

            <div style={{ marginTop: 12 }}>
                <label className="small">Password</label>
                <input
                    className="input"
                    type="password"
                    placeholder="minimal 6 karakter"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                />
            </div>

            {err && (
                <div
                    style={{
                        marginTop: 12,
                        padding: 12,
                        borderRadius: 14,
                        border: "1px solid rgba(255,45,166,.35)",
                        background: "rgba(255,45,166,.10)",
                        color: "rgba(255,255,255,.9)",
                        fontSize: 13,
                    }}
                >
                    {err}
                </div>
            )}

            <button
                className={`btn btn-primary`}
                style={{ width: "100%", marginTop: 14 }}
                onClick={submit}
                disabled={!canSubmit || loading}
            >
                {loading ? "Loading…" : mode === "login" ? "Login" : "Create Account"}
            </button>

            <div className="small" style={{ textAlign: "center", marginTop: 14 }}>
                © {new Date().getFullYear()} Kanji Laopu
            </div>
        </div>
    );
}
