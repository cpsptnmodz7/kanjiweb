"use client";

import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

export default function ReviewPage() {
    const router = useRouter();

    return (
        <div className="glass p-6" style={{ maxWidth: 780, margin: "0 auto" }}>
            <div className="h1">Review</div>
            <div className="small" style={{ marginTop: 6 }}>
                Halaman review akan membaca `srs_cards` + `review_logs`. (kita sambungkan setelah deploy stabil)
            </div>

            <div className="card p-5" style={{ marginTop: 14 }}>
                <div className="h2">Due Today</div>
                <div className="small" style={{ marginTop: 8 }}>4 items</div>

                <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
                    <button className="btn btn-primary" onClick={() => router.push("/quiz")}>Start Review Quiz</button>
                    <button className="btn" onClick={() => router.push("/quiz")}>Free Quiz</button>

                    {/* Dev / Verification Button */}
                    <button className="btn" onClick={async () => {
                        const { data } = await supabase.auth.getUser();
                        if (data.user) {
                            const { awardXPAndCoins, bumpDailyMission } = await import("@/lib/progress");
                            await awardXPAndCoins({ userId: data.user.id, source: "review", xp: 10, coins: 5 });
                            await bumpDailyMission({ userId: data.user.id, missionCode: "review_10", amount: 1 });
                            alert("Simulated review done! XP +10");
                        }
                    }}>Simulate Review (+10 XP)</button>
                </div>
            </div>
        </div>
    );
}
