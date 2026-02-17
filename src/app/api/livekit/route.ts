import { NextResponse } from "next/server";
import { AccessToken } from "livekit-server-sdk";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const room = searchParams.get("room");
        const identity = searchParams.get("identity");

        if (!room) {
            return NextResponse.json({ error: "Missing 'room' query" }, { status: 400 });
        }
        if (!identity) {
            return NextResponse.json({ error: "Missing 'identity' query" }, { status: 400 });
        }

        const livekitUrl = process.env.NEXT_PUBLIC_LIVEKIT_URL;
        const apiKey = process.env.LIVEKIT_API_KEY;
        const apiSecret = process.env.LIVEKIT_API_SECRET;

        if (!livekitUrl || !apiKey || !apiSecret) {
            return NextResponse.json({ error: "Missing LiveKit env vars" }, { status: 500 });
        }

        // Create participant token
        const at = new AccessToken(apiKey, apiSecret, {
            identity,
            name: identity, // use identity as display name for now
        });

        at.addGrant({
            room,
            roomJoin: true,
            canPublish: true,
            canSubscribe: true,
        });

        const token = await at.toJwt();

        return NextResponse.json({ token, url: livekitUrl });
    } catch (error: any) {
        console.error("LiveKit token error:", error);
        return NextResponse.json({ error: error?.message || "Internal Error" }, { status: 500 });
    }
}
