"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

function getNiceNameFromUser(user: { user_metadata?: { username?: string; full_name?: string; name?: string }; email?: string }) {
    const metaName =
        user?.user_metadata?.username ||
        user?.user_metadata?.full_name ||
        user?.user_metadata?.name;

    if (metaName && typeof metaName === "string" && metaName.trim().length > 0) {
        return metaName.trim();
    }

    const email: string | undefined = user?.email;
    if (!email) return "senpai";
    return email.split("@")[0];
}

function sleep(ms: number) {
    return new Promise((r) => setTimeout(r, ms));
}

type Phase =
    | "off"
    | "brandIn"
    | "brandHold"
    | "brandOut"
    | "helloIn"
    | "helloHold"
    | "helloOut";

function IosWelcomeA({ username }: { username: string }) {
    const [phase, setPhase] = useState<Phase>("off");

    useEffect(() => {
        let cancelled = false;

        (async () => {
            setPhase("brandIn");
            await sleep(780);
            if (cancelled) return;

            setPhase("brandHold");
            await sleep(280);
            if (cancelled) return;

            setPhase("brandOut");
            await sleep(260);
            if (cancelled) return;

            setPhase("helloIn");
            await sleep(820);
            if (cancelled) return;

            setPhase("helloHold");
            await sleep(520);
            if (cancelled) return;

            setPhase("helloOut");
            await sleep(220);
        })();

        return () => {
            cancelled = true;
        };
    }, []);

    const brandVisible = phase === "brandIn" || phase === "brandHold" || phase === "brandOut";
    const helloVisible = phase === "helloIn" || phase === "helloHold" || phase === "helloOut";

    const brandAnim =
        phase === "brandIn"
            ? "iosText iosIn"
            : phase === "brandHold"
                ? "iosText iosHold"
                : phase === "brandOut"
                    ? "iosText iosOut"
                    : "iosText iosHidden";

    const helloAnim =
        phase === "helloIn"
            ? "iosText iosIn"
            : phase === "helloHold"
                ? "iosText iosHold"
                : phase === "helloOut"
                    ? "iosText iosOutSoft"
                    : "iosText iosHidden";

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center">
            <div className="absolute inset-0 bg-black/55 backdrop-blur-3xl" />
            <div className="pointer-events-none absolute -top-24 left-1/2 h-80 w-80 -translate-x-1/2 rounded-full bg-fuchsia-500/18 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-28 right-1/3 h-96 w-96 rounded-full bg-cyan-400/12 blur-3xl" />
            <div className="iosNoise absolute inset-0 opacity-[0.09]" />

            <div className="relative w-full px-6 text-center select-none">
                {brandVisible && (
                    <div className={brandAnim}>
                        <div className="iosLogoRow">
                            <div className="iosLogo">
                                <span className="iosLogoGlyph">今</span>
                            </div>
                        </div>
                        <div className="iosH1">Kanji Laopu</div>
                        <div className="iosH2">Learn • Quiz • Review</div>
                    </div>
                )}

                {helloVisible && (
                    <div className={helloAnim}>
                        <div className="iosH1">
                            Selamat datang{","} <span className="iosName">{username}</span>
                        </div>
                        <div className="iosH2">Siap lanjut belajar kanji hari ini?</div>
                    </div>
                )}
            </div>

            <style jsx global>{`
        .iosNoise {
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='180' height='180'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='180' height='180' filter='url(%23n)' opacity='.45'/%3E%3C/svg%3E");
          background-size: 220px 220px;
          mix-blend-mode: overlay;
        }

        .iosText {
          position: absolute;
          left: 50%;
          top: 50%;
          width: 100%;
          max-width: 980px;
          transform: translate(-50%, -50%);
        }

        .iosHidden {
          opacity: 0;
          filter: blur(22px);
          transform: translate(-50%, -48%) scale(0.985);
          pointer-events: none;
        }

        .iosH1 {
          font-size: clamp(30px, 5vw, 56px);
          line-height: 1.06;
          font-weight: 650;
          letter-spacing: -0.02em;
          color: rgba(255, 255, 255, 0.96);
          text-shadow: 0 22px 80px rgba(0, 0, 0, 0.45);
        }

        .iosH2 {
          margin-top: 12px;
          font-size: clamp(13px, 1.6vw, 16px);
          line-height: 1.45;
          letter-spacing: 0.01em;
          color: rgba(255, 255, 255, 0.68);
        }

        .iosName {
          color: rgba(255, 255, 255, 0.98);
        }

        .iosLogoRow {
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 18px;
        }

        .iosLogo {
          height: 56px;
          width: 56px;
          border-radius: 18px;
          border: 1px solid rgba(255, 255, 255, 0.14);
          background: rgba(255, 255, 255, 0.06);
          backdrop-filter: blur(18px);
          box-shadow: 0 22px 90px rgba(255, 0, 160, 0.12);
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .iosLogoGlyph {
          font-size: 22px;
          color: rgba(255, 255, 255, 0.9);
        }

        .iosIn {
          animation: iosIn 760ms cubic-bezier(0.18, 0.9, 0.18, 1) forwards;
        }

        .iosHold {
          opacity: 1;
          filter: blur(0px);
          transform: translate(-50%, -50%) scale(1);
        }

        .iosOut {
          animation: iosOut 260ms ease forwards;
        }

        .iosOutSoft {
          animation: iosOutSoft 220ms ease forwards;
        }

        @keyframes iosIn {
          0% {
            opacity: 0;
            filter: blur(24px);
            transform: translate(-50%, -46%) scale(0.985);
          }
          62% {
            opacity: 1;
            filter: blur(3px);
          }
          100% {
            opacity: 1;
            filter: blur(0px);
            transform: translate(-50%, -50%) scale(1);
          }
        }

        @keyframes iosOut {
          0% {
            opacity: 1;
            filter: blur(0px);
            transform: translate(-50%, -50%) scale(1);
          }
          100% {
            opacity: 0;
            filter: blur(20px);
            transform: translate(-50%, -53%) scale(0.992);
          }
        }

        @keyframes iosOutSoft {
          0% {
            opacity: 1;
            filter: blur(0px);
            transform: translate(-50%, -50%) scale(1);
          }
          100% {
            opacity: 0;
            filter: blur(14px);
            transform: translate(-50%, -51.5%) scale(0.995);
          }
        }
      `}</style>
        </div>
    );
}

export default function LoginPage() {
    const router = useRouter();

    const [mode, setMode] = useState<"login" | "register">("login");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");

    const [loading, setLoading] = useState(false);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);

    const [welcomeOpen, setWelcomeOpen] = useState(false);
    const [welcomeName, setWelcomeName] = useState("senpai");

    const subtitle = useMemo(
        () =>
            mode === "login"
                ? "Masuk untuk lanjut belajar kanji."
                : "Buat akun untuk mulai progress belajarmu.",
        [mode]
    );

    useEffect(() => {
        let mounted = true;
        (async () => {
            const { data } = await supabase.auth.getSession();
            if (!mounted) return;
            if (data.session) router.replace("/");
        })();
        return () => {
            mounted = false;
        };
    }, [router]);

    async function playWelcomeThenGo(user: { user_metadata?: { username?: string; full_name?: string; name?: string }; email?: string }) {
        setWelcomeName(getNiceNameFromUser(user));
        setWelcomeOpen(true);
        await sleep(2100);
        router.replace("/");
    }

    async function handleLogin(e: React.FormEvent) {
        e.preventDefault();
        setErrorMsg(null);
        setLoading(true);
        try {
            const { data, error } = await supabase.auth.signInWithPassword({ email, password });
            if (error) throw error;
            await playWelcomeThenGo(data.user);
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : "Login gagal.";
            setErrorMsg(msg);
        } finally {
            setLoading(false);
        }
    }

    async function handleRegister(e: React.FormEvent) {
        e.preventDefault();
        setErrorMsg(null);
        setLoading(true);
        try {
            const { data, error } = await supabase.auth.signUp({
                email,
                password,
                options: { data: { username: email.split("@")[0] } },
            });
            if (error) throw error;

            if (!data.session) {
                setErrorMsg("Akun dibuat. Cek email untuk konfirmasi, lalu login.");
                setMode("login");
                return;
            }

            if (data.user) {
                await playWelcomeThenGo(data.user);
            }
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : "Register gagal.";
            setErrorMsg(msg);
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="min-h-screen flex items-center justify-center px-4 py-10">
            {welcomeOpen && <IosWelcomeA username={welcomeName} />}

            <div className="w-full max-w-md rounded-3xl border border-white/10 bg-white/[0.06] backdrop-blur-2xl shadow-[0_30px_120px_rgba(0,0,0,0.55)] p-7 md:p-8">
                <div className="mb-6 text-center">
                    <div className="mx-auto mb-4 h-12 w-12 rounded-2xl border border-white/12 bg-white/[0.07] backdrop-blur-xl flex items-center justify-center shadow-[0_18px_70px_rgba(255,0,160,0.14)]">
                        <span className="text-xl text-white/90">今</span>
                    </div>
                    <h1 className="text-2xl font-semibold tracking-tight">Kanji Laopu</h1>
                    <p className="text-white/70 text-sm mt-1">{subtitle}</p>
                </div>

                <div className="grid grid-cols-2 gap-2 mb-6">
                    <button
                        type="button"
                        onClick={() => setMode("login")}
                        className={`px-4 py-2 rounded-2xl border text-sm transition ${mode === "login"
                            ? "bg-white/10 border-white/15"
                            : "bg-transparent border-white/10 text-white/70 hover:bg-white/5"
                            }`}
                    >
                        Login
                    </button>
                    <button
                        type="button"
                        onClick={() => setMode("register")}
                        className={`px-4 py-2 rounded-2xl border text-sm transition ${mode === "register"
                            ? "bg-white/10 border-white/15"
                            : "bg-transparent border-white/10 text-white/70 hover:bg-white/5"
                            }`}
                    >
                        Register
                    </button>
                </div>

                <form onSubmit={mode === "login" ? handleLogin : handleRegister}>
                    <label className="block text-sm text-white/75 mb-2">Email</label>
                    <input
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        type="email"
                        className="w-full mb-4 rounded-2xl bg-white/5 border border-white/10 px-4 py-3 outline-none focus:border-white/25 focus:bg-white/7 transition"
                        placeholder="you@email.com"
                        required
                    />

                    <label className="block text-sm text-white/75 mb-2">Password</label>
                    <input
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        type="password"
                        className="w-full mb-5 rounded-2xl bg-white/5 border border-white/10 px-4 py-3 outline-none focus:border-white/25 focus:bg-white/7 transition"
                        placeholder="••••••••"
                        required
                    />

                    {errorMsg && (
                        <div className="mb-4 rounded-2xl border border-red-500/25 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                            {errorMsg}
                        </div>
                    )}

                    <button
                        disabled={loading}
                        className={`w-full rounded-2xl py-3 font-medium transition ${loading
                            ? "bg-white/10 text-white/60 cursor-not-allowed border border-white/10"
                            : "bg-gradient-to-r from-fuchsia-500/90 to-pink-500/90 hover:from-fuchsia-500 hover:to-pink-500 text-white shadow-[0_18px_70px_rgba(255,0,160,0.22)]"
                            }`}
                    >
                        {loading ? "Please wait..." : mode === "login" ? "Login" : "Register"}
                    </button>
                </form>

                <div className="mt-6 text-center text-xs text-white/55">
                    © {new Date().getFullYear()} Kanji Laopu
                </div>
            </div>
        </div>
    );
}
