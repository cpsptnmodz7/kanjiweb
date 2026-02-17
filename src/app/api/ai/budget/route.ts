import { NextResponse } from "next/server";
import { getOpenAI } from "@/lib/openai";

export const runtime = "nodejs";

type Body = {
    currency?: string;
    goals: Array<{ title: string; monthly_target: number; current_month_net: number }>;
    monthSummary: { income?: number; fixedCosts?: number; variableCosts?: number };
    userNote?: string;
};

export async function POST(req: Request) {
    try {
        const body = (await req.json()) as Body;

        const openai = getOpenAI();
        const maxTokens = Number(process.env.AI_MAX_TOKENS || "700");

        const prompt = `
Kamu adalah AI budgeting assistant untuk aplikasi tabungan "Kanji Laopu".
Output HARUS JSON valid saja:
{
  "headline": string,
  "plan": { "safeMonthlySaving": number, "suggestedSplit": [{ "goal": string, "amount": number }] },
  "tips": string[],
  "warnings": string[],
  "nextActions": string[]
}

Data:
- Currency: ${body.currency || "IDR"}
- Goals: ${JSON.stringify(body.goals || [])}
- MonthSummary: ${JSON.stringify(body.monthSummary || {})}
- UserNote: ${body.userNote || ""}

Aturan:
- safeMonthlySaving jangan melebihi income - fixedCosts - 10% buffer.
- Split goal proporsional terhadap target tapi prioritaskan goal yang paling kecil gap-nya (target - current_month_net).
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
            json = { headline: "Saran budget siap.", plan: { safeMonthlySaving: 0, suggestedSplit: [] }, tips: [], warnings: [], nextActions: [], raw: text };
        }

        return NextResponse.json(json);
    } catch (e: any) {
        return NextResponse.json({ error: e?.message || "AI error" }, { status: 500 });
    }
}
