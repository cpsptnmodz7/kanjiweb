"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

export default function AuthGuard({ children }: { children: React.ReactNode }) {
    const router = useRouter();
    const [checking, setChecking] = useState(true);

    useEffect(() => {
        let mounted = true;

        const run = async () => {
            const { data } = await supabase.auth.getSession();
            const session = data.session;

            if (!mounted) return;

            if (!session?.user) {
                router.replace("/login");
                return;
            }

            setChecking(false);
        };

        run();

        const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
            if (!session?.user) router.replace("/login");
        });

        return () => {
            mounted = false;
            sub.subscription.unsubscribe();
        };
    }, [router]);

    if (checking) {
        return (
            <main className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-4">
                <div className="text-sm opacity-70">Checking session…</div>
            </main>
        );
    }

    return <>{children}</>;
}
