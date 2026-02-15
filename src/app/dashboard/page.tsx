"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import Logo from "@/components/Logo";
import { supabase } from "@/lib/supabaseClient";

export default function DashboardPage() {
    const router = useRouter();
    const pathname = usePathname();

    const [email, setEmail] = useState<string>("");
    const [loading, setLoading] = useState(true);

    const username = useMemo(() => {
        if (!email) return "";
        return email.split("@")[0] || email;
    }, [email]);

    useEffect(() => {
        let mounted = true;

        (async () => {
            const { data } = await supabase.auth.getUser();
            if (!mounted) return;

            if (!data?.user) {
                router.replace("/login");
                return;
            }

            setEmail(data.user.email ?? "");
            setLoading(false);
        })();

        return () => {
            mounted = false;
        };
    }, [router]);

    const logout = async () => {
        await supabase.auth.signOut();
        router.replace("/login");
    };

    const navClass = (href: string) =>
        `kl-navLink ${pathname === href ? "kl-navActive" : ""}`;

    if (loading) {
        return (
            <div className="kl-container">
                <div className="kl-card kl-cardPad">Loading dashboard...</div>
            </div>
        );
    }

    return (
        <div className="kl-container">
            {/* TOP MENU BAR */}
            <div className="kl-nav">
                <div className="kl-card kl-navInner">
                    <div className="kl-navLeft">
                        <Logo size={40} />
                        <div className="kl-navTitle">
                            <strong>Dashboard</strong>
                            <span>Hi, {username}</span>
                        </div>
                    </div>

                    <div className="kl-navRight">
                        <Link className={navClass("/")} href="/">
                            Home
                        </Link>
                        <Link className={navClass("/quiz")} href="/quiz">
                            Quiz
                        </Link>
                        <Link className={navClass("/review")} href="/review">
                            Review
                        </Link>
                        <button className="kl-navLink kl-navLogout" onClick={logout}>
                            Logout
                        </button>
                    </div>
                </div>
            </div>

            {/* CONTENT */}
            <div className="kl-grid" style={{ gap: 14 }}>
                {/* Stats */}
                <div className="kl-statGrid">
                    <div className="kl-card kl-cardPad">
                        <div className="kl-stat">
                            <div className="kl-statLabel">Streak</div>
                            <div className="kl-statValue">0</div>
                            <div className="kl-muted">hari berturut-turut</div>
                        </div>
                    </div>

                    <div className="kl-card kl-cardPad">
                        <div className="kl-stat">
                            <div className="kl-statLabel">Due today</div>
                            <div className="kl-statValue" style={{ color: "var(--pink)" }}>
                                4
                            </div>
                            <div className="kl-muted">kanji harus direview</div>
                        </div>
                    </div>

                    <div className="kl-card kl-cardPad">
                        <div className="kl-stat">
                            <div className="kl-statLabel">Daily goal</div>
                            <div className="kl-statValue">0/10</div>
                            <div className="kl-muted">target harian belajar</div>
                        </div>
                    </div>

                    <div className="kl-card kl-cardPad">
                        <div className="kl-stat">
                            <div className="kl-statLabel">7d Accuracy</div>
                            <div className="kl-statValue">0%</div>
                            <div className="kl-muted">akurasi 7 hari terakhir</div>
                        </div>
                    </div>
                </div>

                {/* Panels */}
                <div className="kl-grid" style={{ gap: 14 }}>
                    <div className="kl-card kl-cardPad">
                        <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                            <div>
                                <div className="kl-statLabel">Activity</div>
                                <div style={{ fontSize: 16, fontWeight: 800, marginTop: 6 }}>
                                    Aktivitas (7 hari)
                                </div>
                                <div className="kl-muted" style={{ marginTop: 6 }}>
                                    Nanti kita isi dengan chart dari database.
                                </div>
                            </div>

                            <Link className="kl-btn" href="/review">
                                Start Review
                            </Link>
                        </div>

                        {/* simple bars (dummy) */}
                        <div style={{ marginTop: 14, display: "grid", gap: 10 }}>
                            {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
                                <div key={d} style={{ display: "grid", gridTemplateColumns: "44px 1fr 24px", gap: 10, alignItems: "center" }}>
                                    <div className="kl-muted" style={{ fontSize: 12 }}>{d}</div>
                                    <div
                                        style={{
                                            height: 10,
                                            borderRadius: 999,
                                            border: "1px solid var(--stroke)",
                                            background: "rgba(255,255,255,0.05)",
                                            overflow: "hidden",
                                        }}
                                    >
                                        <div
                                            style={{
                                                width: "0%",
                                                height: "100%",
                                                background:
                                                    "linear-gradient(90deg, rgba(255,43,214,0.95), rgba(179,65,255,0.85))",
                                            }}
                                        />
                                    </div>
                                    <div className="kl-muted" style={{ fontSize: 12, textAlign: "right" }}>
                                        0
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="kl-card kl-cardPad">
                        <div className="kl-statLabel">Insights</div>
                        <div style={{ fontSize: 16, fontWeight: 800, marginTop: 6 }}>
                            Recent mistakes
                        </div>
                        <div className="kl-muted" style={{ marginTop: 6 }}>
                            Belum ada data (nanti kita tarik dari review_logs).
                        </div>

                        <div style={{ marginTop: 14, display: "flex", gap: 10, flexWrap: "wrap" }}>
                            <Link className="kl-btn kl-btnPrimary" href="/quiz">
                                Practice now
                            </Link>
                            <Link className="kl-btn" href="/">
                                Main Menu
                            </Link>
                        </div>
                    </div>
                </div>

                <div className="kl-footer">© {new Date().getFullYear()} Kanji Laopu</div>
            </div>
        </div>
    );
}
