"use client";

import React, { useEffect, useRef } from "react";

type Props = {
    children: React.ReactNode;
    backgroundImage?: string; // e.g. "/anime-wallpaper.jpg"
    className?: string;
};

export default function AppShell({
    children,
    backgroundImage = "/anime-wallpaper.jpg",
    className = "",
}: Props) {
    const ref = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        const el = ref.current;
        if (!el) return;

        const onMove = (e: MouseEvent) => {
            const r = el.getBoundingClientRect();
            const x = (e.clientX - r.left) / r.width; // 0..1
            const y = (e.clientY - r.top) / r.height; // 0..1
            el.style.setProperty("--mx", String(x));
            el.style.setProperty("--my", String(y));
        };

        window.addEventListener("mousemove", onMove, { passive: true });
        return () => window.removeEventListener("mousemove", onMove);
    }, []);

    return (
        <div ref={ref} className={`kl-shell ${className}`}>
            <div
                className="kl-bg"
                style={{ backgroundImage: `url(${backgroundImage})` }}
                aria-hidden="true"
            />
            <div className="kl-bgOverlay" aria-hidden="true" />
            <div className="kl-vignette" aria-hidden="true" />
            <div className="kl-content">{children}</div>
        </div>
    );
}
