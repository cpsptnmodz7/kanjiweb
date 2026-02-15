import { NextResponse } from "next/server";

export async function POST(req: Request) {
    const body = await req.json();
    const { kanji, meaning } = body || {};

    if (!kanji || !meaning) {
        return NextResponse.json({ error: "kanji & meaning required" }, { status: 400 });
    }

    // Kalau belum set API key, fallback mnemonic lokal
    if (!process.env.OPENAI_API_KEY) {
        return NextResponse.json({
            text: `Mnemonic: Bayangkan “${kanji}” sebagai simbol untuk “${meaning}”. Buat cerita lucu yang kamu ingat.`,
            source: "fallback",
        });
    }

    // NOTE: implementasi OpenAI API kamu tinggal aku rapihin setelah kamu bilang mau model apa.
    // Untuk sekarang biar tidak error build, kita return fallback saja.
    return NextResponse.json({
        text: `Mnemonic: “${kanji}” = “${meaning}”. (AI route siap, tinggal sambungkan OpenAI API.)`,
        source: "placeholder",
    });
}
