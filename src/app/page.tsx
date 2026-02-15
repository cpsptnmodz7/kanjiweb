"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Logo from "@/components/Logo";
import { supabase } from "@/lib/supabaseClient";

export default function HomePage() {
  const router = useRouter();
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

  if (loading) {
    return (
      <div className="kl-container">
        <div className="kl-card kl-cardPad">Loading...</div>
      </div>
    );
  }

  return (
    <div className="kl-container">
      <div className="kl-topbar">
        <div className="kl-brand">
          <Logo size={44} />
          <div className="kl-brandTitle">
            <strong>Kanji Laopu</strong>
            <span>Good learning, {username}</span>
          </div>
        </div>

        <div className="kl-actions">
          <button className="kl-btn kl-btnDanger" onClick={logout}>
            Logout
          </button>
        </div>
      </div>

      <div className="kl-hero">
        <div className="kl-card kl-cardPad">
          <p className="kl-muted" style={{ margin: 0 }}>
            Today focus
          </p>
          <h1 className="kl-heroTitle">Keep your streak alive ✨</h1>
          <p className="kl-muted" style={{ marginTop: 6 }}>
            Mulai dari review yang due hari ini, lalu lanjut quiz untuk memperkuat ingatan.
          </p>

          <div className="kl-actions" style={{ marginTop: 14, justifyContent: "flex-start" }}>
            <Link className="kl-btn kl-btnPrimary" href="/review">
              Start Review
            </Link>
            <Link className="kl-btn" href="/quiz">
              Free Quiz
            </Link>
            <Link className="kl-btn" href="/dashboard">
              Dashboard
            </Link>
          </div>
        </div>

        <div className="kl-grid">
          <div className="kl-card kl-cardPad">
            <div className="kl-stat">
              <div className="kl-statLabel">Due today</div>
              <div className="kl-statValue">4</div>
              <div className="kl-muted">kanji harus direview</div>
            </div>
          </div>

          <div className="kl-card kl-cardPad">
            <div className="kl-stat">
              <div className="kl-statLabel">7d Accuracy</div>
              <div className="kl-statValue">0%</div>
              <div className="kl-muted">perkiraan (sementara)</div>
            </div>
          </div>

          <div className="kl-card kl-cardPad">
            <div className="kl-stat">
              <div className="kl-statLabel">Streak</div>
              <div className="kl-statValue">0 hari</div>
              <div className="kl-muted">review berturut-turut</div>
            </div>
          </div>
        </div>
      </div>

      <div className="kl-footer">© {new Date().getFullYear()} Kanji Laopu • Handcrafted with 💗</div>
    </div>
  );
}
