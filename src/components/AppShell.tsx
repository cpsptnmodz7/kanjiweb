"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

function getUsername(email?: string | null) {
    if (!email) return "User";
    const left = email.split("@")[0] || "User";
    return left.length > 14 ? left.slice(0, 14) + "…" : left;
}

export default function AppShell({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const router = useRouter();
    const isLogin = pathname === "/login";

    const [email, setEmail] = useState<string | null>(null);

    useEffect(() => {
        supabase.auth.getUser().then(({ data }) => {
            setEmail(data.user?.email ?? null);
        });
        const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
            setEmail(session?.user?.email ?? null);
        });
        return () => sub.subscription.unsubscribe();
    }, []);

    const username = useMemo(() => getUsername(email), [email]);

    async function logout() {
        await supabase.auth.signOut();
        router.replace("/login");
    }

    return (
        <div className="app-root">
            <div className="bg-anime" aria-hidden="true" />
            <div className="bg-overlay" aria-hidden="true" />

            {/* Top Nav (hidden on login) */}
            {!isLogin && (
                <header className="topbar">
                    <div className="topbar-inner">
                        <div className="brand">
                            <div className="brand-badge">
                                <span className="brand-mark">今</span>
                            </div>
                            <div className="brand-text">
                                <div className="brand-title">Kanji Laopu</div>
                                <div className="brand-sub">Hi, <b>{username}</b></div>
                            </div>
                        </div>

                        <nav className="nav">
                            <Link className={`navlink ${pathname === "/" ? "active" : ""}`} href="/">Home</Link>
                            <Link className={`navlink ${pathname?.startsWith("/quiz") ? "active" : ""}`} href="/quiz">Quiz</Link>
                            <Link className={`navlink ${pathname?.startsWith("/review") ? "active" : ""}`} href="/review">Review</Link>
                            <Link className={`navlink ${pathname?.startsWith("/dashboard") ? "active" : ""}`} href="/dashboard">Dashboard</Link>
                            <Link className={`navlink ${pathname?.startsWith("/savings") ? "active" : ""}`} href="/savings">Money</Link>
                            <Link className={`navlink ${pathname?.startsWith("/missions") ? "active" : ""}`} href="/missions">Missions</Link>
                            <Link className={`navlink ${pathname?.startsWith("/shop") ? "active" : ""}`} href="/shop">Shop</Link>
                            <Link className={`navlink ${pathname?.startsWith("/voice") ? "active" : ""}`} href="/voice">Voice</Link>
                        </nav>

                        <button className="btn btn-ghost" onClick={logout}>
                            Log out
                        </button>
                    </div>
                </header>
            )}

            <main className={`page ${isLogin ? "page-login" : ""}`}>
                {children}
            </main>
        </div>
    );
}
