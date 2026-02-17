"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import supabase from "@/lib/supabaseClient";

export default function DashboardPage() {
    const router = useRouter();

    const [email, setEmail] = useState<string>("");

    useEffect(() => {
        checkUser();
    }, []);

    async function checkUser() {
        const { data } = await supabase.auth.getSession();

        if (!data.session) {
            router.push("/login");
            return;
        }

        setEmail(data.session.user.email || "");
    }

    async function logout() {
        await supabase.auth.signOut();
        router.push("/login");
    }

    return (
        <div className="min-h-screen p-6 text-white">
            {/* BACKGROUND */}
            <div className="fixed inset-0 -z-10">
                <div
                    className="absolute inset-0"
                    style={{
                        backgroundImage: "url(/anime-wallpaper.jpg)",
                        backgroundSize: "cover",
                        backgroundPosition: "center",
                    }}
                />
                <div className="absolute inset-0 bg-black/70" />
            </div>

            {/* NAVBAR */}
            <div className="mb-6 flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-6 py-4 backdrop-blur-lg">
                <div>
                    <h1 className="text-lg font-semibold">Kanji Laopu</h1>
                    <p className="text-xs text-white/60">{email}</p>
                </div>

                <div className="flex gap-2">
                    <button
                        onClick={() => router.push("/")}
                        className="rounded-xl bg-white/10 px-4 py-2 text-sm hover:bg-white/20"
                    >
                        Home
                    </button>

                    <button
                        onClick={() => router.push("/quiz")}
                        className="rounded-xl bg-white/10 px-4 py-2 text-sm hover:bg-white/20"
                    >
                        Quiz
                    </button>

                    <button
                        onClick={() => router.push("/review")}
                        className="rounded-xl bg-white/10 px-4 py-2 text-sm hover:bg-white/20"
                    >
                        Review
                    </button>

                    {/* 👉 CELENGAN */}
                    <button
                        onClick={() => router.push("/savings")}
                        className="rounded-xl bg-gradient-to-r from-yellow-400 to-orange-400 px-4 py-2 text-sm font-semibold text-black shadow-lg hover:opacity-90"
                    >
                        💰 Celengan
                    </button>

                    <button
                        onClick={logout}
                        className="rounded-xl bg-red-500 px-4 py-2 text-sm hover:bg-red-600"
                    >
                        Logout
                    </button>
                </div>
            </div>

            {/* CONTENT */}
            <div className="grid gap-4 md:grid-cols-3">
                {/* CARD 1 */}
                <div className="rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur-lg">
                    <h2 className="text-lg font-semibold">Start Quiz</h2>
                    <p className="text-sm text-white/60">Latihan kanji sekarang</p>

                    <button
                        onClick={() => router.push("/quiz")}
                        className="mt-4 w-full rounded-xl bg-pink-500 py-2 text-sm font-semibold hover:bg-pink-600"
                    >
                        Start Quiz
                    </button>
                </div>

                {/* CARD 2 */}
                <div className="rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur-lg">
                    <h2 className="text-lg font-semibold">Review</h2>
                    <p className="text-sm text-white/60">Ulangi kanji</p>

                    <button
                        onClick={() => router.push("/review")}
                        className="mt-4 w-full rounded-xl bg-blue-500 py-2 text-sm font-semibold hover:bg-blue-600"
                    >
                        Review
                    </button>
                </div>

                {/* CARD 3 */}
                <div className="rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur-lg">
                    <h2 className="text-lg font-semibold">Celengan</h2>
                    <p className="text-sm text-white/60">
                        Lihat tabungan kamu
                    </p>

                    <button
                        onClick={() => router.push("/savings")}
                        className="mt-4 w-full rounded-xl bg-yellow-400 py-2 text-sm font-semibold text-black hover:bg-yellow-500"
                    >
                        💰 Buka Celengan
                    </button>
                </div>
            </div>
        </div>
    );
}
