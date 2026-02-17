"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

function usernameFromEmail(email?: string | null) {
  if (!email) return "User";
  return (email.split("@")[0] || "User").replace(/\./g, " ");
}

export default function HomePage() {
  const router = useRouter();
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? null));
  }, []);

  const username = usernameFromEmail(email);

  return (
    <div className="grid cols-3">
      <div className="glass p-6">
        <div className="badge">✨ Today focus</div>
        <div style={{ marginTop: 10 }} className="h1">
          Keep your streak alive
        </div>
        <div className="small" style={{ marginTop: 8, lineHeight: 1.5 }}>
          Halo <b>{username}</b> — mulai dari review yang due hari ini, lalu lanjut quiz untuk memperkuat ingatan.
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 16 }}>
          <button className="btn btn-primary" onClick={() => router.push("/review")}>Start Review</button>
          <button className="btn" onClick={() => router.push("/quiz")}>Free Quiz</button>
          <button className="btn" onClick={() => router.push("/dashboard")}>Dashboard</button>
          <button className="btn" onClick={() => router.push("/savings")}>Celengan</button>
        </div>

        <hr className="sep" />

        <div className="grid cols-2">
          <div className="card p-5">
            <div className="h2">JLPT Levels</div>
            <div className="small" style={{ marginTop: 6 }}>Progress belajar per level N5–N1.</div>
            <button className="btn" style={{ marginTop: 10 }} onClick={() => router.push("/quiz?set=N5")}>Open</button>
          </div>
          <div className="card p-5">
            <div className="h2">Voice Class (soon)</div>
            <div className="small" style={{ marginTop: 6 }}>Ruang belajar bareng (LiveKit).</div>
            <button className="btn" style={{ marginTop: 10 }} disabled>Coming soon</button>
          </div>
        </div>

        <div className="small" style={{ textAlign: "center", marginTop: 20 }}>
          Handcrafted with ❤️ — Kanji Laopu
        </div>
      </div>

      {/* Right cards */}
      <div className="grid" style={{ alignContent: "start" }}>
        <div className="card p-5">
          <div className="small">Due today</div>
          <div style={{ fontSize: 24, fontWeight: 900, marginTop: 6 }}>—</div>
          <div className="small">akan tampil saat data review siap</div>
        </div>
        <div className="card p-5">
          <div className="small">7d Accuracy</div>
          <div style={{ fontSize: 24, fontWeight: 900, marginTop: 6 }}>—</div>
        </div>
        <div className="card p-5">
          <div className="small">Streak</div>
          <div style={{ fontSize: 24, fontWeight: 900, marginTop: 6 }}>—</div>
        </div>
      </div>

      <div className="grid" style={{ alignContent: "start" }}>
        <div className="card p-5">
          <div className="h2">Quick Actions</div>
          <div style={{ display: "grid", gap: 10, marginTop: 10 }}>
            <button className="btn" onClick={() => router.push("/dashboard")}>Open Dashboard</button>
            <button className="btn" onClick={() => router.push("/quiz")}>Start Quiz</button>
            <button className="btn" onClick={() => router.push("/review")}>Start Review</button>
          </div>
        </div>
      </div>
    </div>
  );
}
