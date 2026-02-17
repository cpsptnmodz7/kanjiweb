import { NextResponse } from "next/server";
import { AccessToken } from "livekit-server-sdk";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

type Body = { room: string; access_token: string };

export async function POST(req: Request) {
    try {
        const body = (await req.json()) as Body;

        const livekitUrl = process.env.NEXT_PUBLIC_LIVEKIT_URL!;
        const apiKey = process.env.LIVEKIT_API_KEY!;
        const apiSecret = process.env.LIVEKIT_API_SECRET!;

        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
        const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

        if (!livekitUrl || !apiKey || !apiSecret) {
            return NextResponse.json({ error: "Missing LiveKit env" }, { status: 500 });
        }
        if (!supabaseUrl || !supabaseAnon) {
            return NextResponse.json({ error: "Missing Supabase env" }, { status: 500 });
        }

        const room = (body.room || "").trim();
        const accessToken = (body.access_token || "").trim();
        if (!room) return NextResponse.json({ error: "Room required" }, { status: 400 });
        if (!accessToken) return NextResponse.json({ error: "Missing access_token" }, { status: 401 });

        const supabase = createClient(supabaseUrl, supabaseAnon);
        const { data, error } = await supabase.auth.getUser(accessToken);
        if (error || !data?.user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const user = data.user;
        const identity = user.id;
        const name = user.user_metadata?.username || user.email?.split("@")[0] || "user";

        const at = new AccessToken(apiKey, apiSecret, { identity, name });
        at.addGrant({ room, roomJoin: true, canPublish: true, canSubscribe: true });

        return NextResponse.json({ token: await at.toJwt(), url: livekitUrl, room, identity, name });
    } catch (e: any) {
        return NextResponse.json({ error: e?.message || "Token error" }, { status: 500 });
    }
}
