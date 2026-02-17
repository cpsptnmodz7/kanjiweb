"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

const PUBLIC_ROUTES = ["/login"];

export default function AuthGuard({ children }: { children: React.ReactNode }) {
    const router = useRouter();
    const pathname = usePathname();
    const [ready, setReady] = useState(false);

    useEffect(() => {
        let mounted = true;

        async function run() {
            const isPublic = PUBLIC_ROUTES.includes(pathname || "");
            const { data } = await supabase.auth.getSession();
            const hasSession = !!data.session;

            if (!isPublic && !hasSession) router.replace("/login");
            if (isPublic && hasSession) router.replace("/");

            if (mounted) setReady(true);
        }

        run();

        const { data: sub } = supabase.auth.onAuthStateChange(() => {
            // re-check simple
            run();
        });

        return () => {
            mounted = false;
            sub.subscription.unsubscribe();
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [pathname]);

    if (!ready) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="glass p-6 rounded-2xl text-white/80">
                    Loading…
                </div>
            </div>
        );
    }

    return <>{children}</>;
}
