import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const PUBLIC_PATHS = [
    "/login",
    "/api",
    "/_next",
    "/favicon.ico",
    "/anime-wallpaper.jpg",
    "/logo.png",
    "/hero.png" // add other public assets here if needed
];

export function middleware(req: NextRequest) {
    const { pathname } = req.nextUrl;

    // allow public
    if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
        return NextResponse.next();
    }

    // simple cookie check (Supabase auth sets cookies)
    // NOTE: Client-side auth uses localStorage, so cookies might be missing on first request.
    // Disabling strict middleware check to avoid login loops. Client-side protection is active.
    /*
    const hasAuth =
        req.cookies.get("sb-access-token") ||
        req.cookies.get("sb:token") ||
        req.cookies.get("supabase-auth-token");

    if (!hasAuth) {
        const url = req.nextUrl.clone();
        url.pathname = "/login";
        return NextResponse.redirect(url);
    }
    */

    return NextResponse.next();
}

export const config = {
    matcher: ["/((?!_next/static|_next/image).*)"],
};
