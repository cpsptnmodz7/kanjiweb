// src/app/api/ai/sensei/route.ts
import { NextResponse } from "next/server";
import { getOpenAI } from "@/lib/openai";

export const runtime = "nodejs";

type Body = {
    kanji: string;
    meaning?: string;
    onyomi?: string;
    kunyomi?: string;
    level?: string;
    userAnswer?: string;
    isCorrect?: boolean;
};

export async function POST(req: Request) {
    try {
        const body = (await req.json()) as Body;
        if (!body.kanji) return NextResponse.json({ error: "Missing kanji" }, { status: 400 });

        const openai = getOpenAI();
        const maxTokens = Number(process.env.AI_MAX_TOKENS || "700");

        const prompt = `
Kamu adalah "Sensei" untuk belajar kanji di aplikasi Kanji Laopu.
Output HARUS JSON valid saja:
{
  "title": string,
  "mnemonic": string,
  "examples": [{"jp": string, "romaji": string, "id": string}],
  "commonMistake": string,
  "microQuiz": {"q": string, "choices": string[], "answer": string}
}

Data:
kanji: ${body.kanji}
meaning: ${body.meaning || ""}
onyomi: ${body.onyomi || ""}
kunyomi: ${body.kunyomi || ""}
level: ${body.level || ""}
userAnswer: ${body.userAnswer || ""}
isCorrect: ${String(body.isCorrect ?? "")}

Buat gaya ringkas, fun, tapi akurat. Beri 2 contoh kalimat.
`.trim();

        const resp = await openai.responses.create({
            model: "gpt-4.1-mini",
            input: prompt,
            max_output_tokens: maxTokens,
        });

        const text = resp.output_text?.trim() || "{}";
        let json: any;
        try {
            json = JSON.parse(text);
        } catch {
            json = { title: "Sensei", mnemonic: "Ulangi lagi ya.", examples: [], commonMistake: "", microQuiz: null, raw: text };
        }

        return NextResponse.json(json);
    } catch (e: any) {
        return NextResponse.json({ error: e?.message || "AI sensei error" }, { status: 500 });
    }
}
