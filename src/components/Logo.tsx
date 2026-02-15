import React from "react";

type Props = {
    size?: number; // px
    label?: string;
    className?: string;
};

export default function Logo({ size = 44, label = "今", className = "" }: Props) {
    return (
        <div
            className={`kl-logo ${className}`}
            style={{ width: size, height: size }}
            aria-label="Kanji Laopu logo"
            role="img"
        >
            <span className="kl-logo__glyph">{label}</span>
            <span className="kl-logo__ring" />
            <span className="kl-logo__glow" />
        </div>
    );
}
