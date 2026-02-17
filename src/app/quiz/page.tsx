"use client";

import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { awardXPAndCoins, bumpDailyMission } from "@/lib/progress";

// FIX 3: Tambah beberapa soal supaya Next benar-benar pindah item
const SAMPLE = [
    { q: "Meaning", a: "now", choices: ["日", "今", "人", "時"], correct: "今" },
    { q: "Meaning", a: "day", choices: ["日", "今", "人", "時"], correct: "日" },
    { q: "Meaning", a: "person", choices: ["日", "今", "人", "時"], correct: "人" },
    { q: "Meaning", a: "time", choices: ["日", "今", "人", "時"], correct: "時" },
];

export default function QuizPage() {
    const router = useRouter();
    const sp = useSearchParams();
    const set = sp.get("set") || "Free";

    const [idx, setIdx] = useState(0);
    const [picked, setPicked] = useState<string | null>(null);
    const [loading, setLoading] = useState(false); // biar tidak spam klik
    const [msg, setMsg] = useState<string>("");

    const item = useMemo(() => SAMPLE[idx], [idx]);

    // FIX 5: progress bar dinamis
    const progressPct = useMemo(() => {
        if (SAMPLE.length <= 0) return 0;
        return Math.round(((idx + 1) / SAMPLE.length) * 100);
    }, [idx]);

    function choose(c: string) {
        setPicked(c);
    }

    // FIX 2: bungkus dengan try/catch + tampilkan error agar tidak "diam"
    async function next() {
        if (loading) return;

        // FIX 4: blok kalau belum pilih
        if (!picked) {
            setMsg("Pilih jawaban dulu 🙂");
            return;
        }

        setLoading(true);
        setMsg("");

        try {
            // Gamification hanya kalau benar
            if (picked === item.correct) {
                const { data } = await supabase.auth.getUser();
                if (data.user) {
                    await awardXPAndCoins({
                        userId: data.user.id,
                        source: "quiz",
                        xp: 8,
                        coins: 1,
                        meta: { correct: true, q: item.q, a: item.a },
                    });

                    await bumpDailyMission({
                        userId: data.user.id,
                        missionCode: "quiz_5",
                        amount: 1,
                    });
                }
            }

            // lanjut soal berikutnya
            setPicked(null);
            setIdx((v) => (v + 1) % SAMPLE.length);
        } catch (e: any) {
            console.error("NEXT ERROR:", e);
            setMsg(e?.message || "Terjadi error saat Next");
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="glass p-6" style={{ maxWidth: 900, margin: "0 auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
                <div>
                    <div className="small">Quiz set</div>
                    <div className="h2">{set}</div>
                </div>
                <button className="btn btn-ghost" onClick={() => router.push("/")}>
                    Main Menu
                </button>
            </div>

            {/* FIX 5: progress bar dinamis */}
            <div style={{ marginTop: 14 }}>
                <div style={{ height: 10, borderRadius: 999, background: "rgba(255,255,255,.08)", overflow: "hidden" }}>
                    <div
                        style={{
                            width: `${progressPct}%`,
                            height: "100%",
                            borderRadius: 999,
                            background: "linear-gradient(90deg, var(--pink), var(--pink2))",
                        }}
                    />
                </div>
                <div className="small" style={{ marginTop: 8 }}>
                    {idx + 1}/{SAMPLE.length}
                </div>
            </div>

            {/* pesan error / info */}
            {msg && (
                <div className="card p-4" style={{ marginTop: 14 }}>
                    {msg}
                </div>
            )}

            <div className="card p-6" style={{ marginTop: 14, textAlign: "center" }}>
                <div className="small" style={{ letterSpacing: ".12em" }}>
                    {item.q.toUpperCase()}
                </div>
                <div style={{ fontSize: 54, fontWeight: 900, marginTop: 10 }}>{item.a}</div>
            </div>

            <div className="grid cols-2" style={{ marginTop: 14 }}>
                {item.choices.map((c) => {
                    const active = picked === c;
                    return (
                        <button
                            key={c}
                            className="btn"
                            style={{
                                padding: "18px 14px",
                                fontSize: 28,
                                borderRadius: 18,
                                background: active ? "linear-gradient(90deg, rgba(255,45,166,.26), rgba(184,51,255,.16))" : undefined,
                                borderColor: active ? "rgba(255,45,166,.35)" : undefined,
                                opacity: loading ? 0.7 : 1,
                            }}
                            onClick={() => choose(c)}
                            disabled={loading}
                        >
                            {c}
                        </button>
                    );
                })}
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, marginTop: 14 }}>
                <button className="btn" onClick={() => router.back()} disabled={loading}>
                    Back
                </button>

                {/* FIX 4: Next disable kalau belum pilih + disable saat loading */}
                <button className="btn btn-primary" onClick={next} disabled={!picked || loading}>
                    {loading ? "Loading..." : "Next"}
                </button>
            </div>
        </div>
    );
}
