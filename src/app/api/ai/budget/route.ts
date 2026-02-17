import { NextResponse } from "next/server";
import OpenAI from "openai";

export const runtime = "nodejs";

type BudgetInput = {
    currency?: string;
    monthlyIncome?: number;
    monthlyTarget?: number;
    totalSaved?: number;
    monthSaved?: number;
    transactions?: Array<{
        amount: number;
        note?: string;
        date?: string;
    }>;
    goals?: Array<{
        name: string;
        target: number;
        saved: number;
        deadline?: string;
    }>;
};

function clampNumber(n: unknown, fallback = 0) {
    const x = Number(n);
    return Number.isFinite(x) ? x : fallback;
}

export async function POST(req: Request) {
    try {
        const body = (await req.json()) as BudgetInput;

        const currency = (body.currency || "IDR").toUpperCase();
        const monthlyIncome = clampNumber(body.monthlyIncome, 0);
        const monthlyTarget = clampNumber(body.monthlyTarget, 0);
        const totalSaved = clampNumber(body.totalSaved, 0);
        const monthSaved = clampNumber(body.monthSaved, 0);

        const transactions = Array.isArray(body.transactions) ? body.transactions.slice(0, 200) : [];
        const goals = Array.isArray(body.goals) ? body.goals.slice(0, 20) : [];

        if (!process.env.OPENAI_API_KEY) {
            return NextResponse.json(
                { ok: false, error: "OPENAI_API_KEY belum diset di environment." },
                { status: 500 }
            );
        }

        const client = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY,
        });

        const input = `
Kamu adalah "AI Budgeting Coach" untuk aplikasi tabungan (celengan) berbahasa Indonesia.
Tujuan: memberi saran yang realistis, tidak menghakimi, dan bisa langsung dilakukan.

DATA USER (ringkas):
- currency: ${currency}
- monthlyIncome: ${monthlyIncome}
- monthlyTarget: ${monthlyTarget}
- totalSaved: ${totalSaved}
- monthSaved (net): ${monthSaved}

TRANSAKSI TERAKHIR (max 200):
${JSON.stringify(transactions)}

GOALS (max 20):
${JSON.stringify(goals)}

INSTRUKSI OUTPUT:
Balas dalam JSON valid, TANPA markdown, dengan schema:
{
  "summary": string,
  "health_score": number,        // 0-100
  "insights": string[],          // 3-7 poin
  "next_actions": {              // 3-7 langkah
    "title": string,
    "why": string,
    "how": string
  }[],
  "budget_plan": {               // rencana sederhana
    "needs_pct": number,
    "wants_pct": number,
    "savings_pct": number,
    "notes": string
  },
  "goal_strategy": string,       // strategi prioritas goal
  "warnings": string[]           // opsional, boleh kosong
}

Aturan:
- Kalau monthlyIncome=0, jangan memaksa bikin % ketat; beri saran “mulai dari nominal kecil”.
- Kalau ada banyak transaksi negatif (ambil), beri saran kontrol pengeluaran.
- Prioritaskan target bulanan + goal terdekat.
`;

        const completion = await client.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
                { role: "system", content: "You are a helpful budgeting assistant that outputs JSON." },
                { role: "user", content: input },
            ],
            response_format: { type: "json_object" },
        });

        const text = completion.choices[0].message.content?.trim() ?? "";

        try {
            const json = JSON.parse(text);
            return NextResponse.json({ ok: true, data: json });
        } catch {
            return NextResponse.json({
                ok: true,
                data: {
                    summary: "AI menghasilkan output non-JSON. Coba ulangi.",
                    raw: text,
                },
            });
        }
    } catch (err: unknown) {
        return NextResponse.json(
            { ok: false, error: (err as Error)?.message || "Unknown error" },
            { status: 500 }
        );
    }
}
