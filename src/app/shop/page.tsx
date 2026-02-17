"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { buyShopItem, ensureProfile } from "@/lib/progress";

type Item = { sku: string; title: string; description: string | null; price_coins: number };

export default function ShopPage() {
    const [userId, setUserId] = useState<string>("");
    const [coins, setCoins] = useState<number>(0);
    const [items, setItems] = useState<Item[]>([]);
    const [msg, setMsg] = useState<string>("");

    useEffect(() => {
        (async () => {
            const { data } = await supabase.auth.getSession();
            const session = data.session;
            if (!session) return;
            setUserId(session.user.id);

            const profile = await ensureProfile(session.user.id);
            setCoins(profile.coins ?? 0);

            const { data: it } = await supabase
                .from("shop_items")
                .select("sku,title,description,price_coins")
                .eq("is_active", true)
                .order("created_at", { ascending: true });

            if (it) setItems(it as any);
        })();
    }, []);

    async function buy(sku: string) {
        setMsg("");
        try {
            await buyShopItem(userId, sku);
            const profile = await ensureProfile(userId);
            setCoins(profile.coins ?? 0);
            setMsg("Purchased!");
        } catch (e: any) {
            setMsg(e?.message || "Failed");
        }
    }

    return (
        <div className="glass p-6">
            <div className="h1">Reward Shop</div>
            <div className="small" style={{ marginTop: 6 }}>
                Coins: <b>{coins}</b>
            </div>

            {msg && <div className="card p-5" style={{ marginTop: 14 }}>{msg}</div>}

            <div className="grid cols-2" style={{ marginTop: 14 }}>
                {items.map((it) => (
                    <div key={it.sku} className="card p-5">
                        <div className="h2">{it.title}</div>
                        <div className="small" style={{ marginTop: 6 }}>{it.description || ""}</div>
                        <div className="small" style={{ marginTop: 10 }}>Price: <b>{it.price_coins}</b> coins</div>
                        <button className="btn btn-primary" style={{ marginTop: 12 }} onClick={() => buy(it.sku)}>
                            Buy
                        </button>
                    </div>
                ))}
            </div>
        </div>
    );
}
