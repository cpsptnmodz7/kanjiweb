'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

type QuizSet = {
    id: string;
    name: string;
    description: string | null;
    created_at: string;
    is_active: boolean;
};

type CsvRow = {
    set_name: string;
    kanji_id: string;
};

function cn(...xs: Array<string | false | null | undefined>) {
    return xs.filter(Boolean).join(' ');
}

function parseCSV(text: string): CsvRow[] {
    // CSV sederhana: header wajib set_name,kanji_id
    // support line kosong, trim, dan koma di tengah (tidak support quoted-comma)
    const lines = text
        .split(/\r?\n/)
        .map(l => l.trim())
        .filter(Boolean);

    if (lines.length < 2) return [];

    const header = lines[0].split(',').map(h => h.trim().toLowerCase());
    const setIdx = header.indexOf('set_name');
    const kanjiIdx = header.indexOf('kanji_id');

    if (setIdx === -1 || kanjiIdx === -1) {
        throw new Error('CSV header harus punya kolom: set_name, kanji_id');
    }

    const rows: CsvRow[] = [];
    for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(',').map(c => c.trim());
        const set_name = cols[setIdx] ?? '';
        const kanji_id = cols[kanjiIdx] ?? '';
        if (!set_name || !kanji_id) continue;
        rows.push({ set_name, kanji_id });
    }
    return rows;
}

export default function BulkImportPage() {
    const router = useRouter();

    const [email, setEmail] = useState('');
    const [sets, setSets] = useState<QuizSet[]>([]);
    const [loadingSets, setLoadingSets] = useState(true);

    const [csvText, setCsvText] = useState<string>(
        `set_name,kanji_id
N5 Starter,今
N5 Starter,日
N5 Starter,人
N5 Starter,時
N5 Time,時
N5 Time,今`
    );

    const [status, setStatus] = useState<string>('');
    const [busy, setBusy] = useState(false);

    // ---------- AUTH ----------
    useEffect(() => {
        let mounted = true;

        (async () => {
            const { data } = await supabase.auth.getSession();
            const session = data.session;
            if (!session) {
                router.replace('/login');
                return;
            }
            if (mounted) setEmail(session.user.email ?? '');
        })();

        const { data: sub } = supabase.auth.onAuthStateChange((_evt, session) => {
            if (!session) router.replace('/login');
            setEmail(session?.user?.email ?? '');
        });

        return () => {
            mounted = false;
            sub.subscription.unsubscribe();
        };
    }, [router]);

    // ---------- LOAD SETS ----------
    async function loadSets() {
        setLoadingSets(true);
        const { data, error } = await supabase
            .from('quiz_sets')
            .select('id,name,description,created_at,is_active')
            .eq('is_active', true)
            .order('created_at', { ascending: false });

        if (error) {
            console.error(error);
            setSets([]);
        } else {
            setSets((data ?? []) as QuizSet[]);
        }
        setLoadingSets(false);
    }

    useEffect(() => {
        loadSets();
    }, []);

    const parsed = useMemo(() => {
        try {
            const rows = parseCSV(csvText);
            const bySet = new Map<string, Set<string>>();
            for (const r of rows) {
                const key = r.set_name.trim();
                const kanji = r.kanji_id.trim();
                if (!bySet.has(key)) bySet.set(key, new Set());
                bySet.get(key)!.add(kanji);
            }
            return {
                ok: true as const,
                rows,
                bySet,
                setCount: bySet.size,
                itemCount: rows.length,
                uniquePairs: Array.from(bySet.values()).reduce((a, s) => a + s.size, 0),
            };
        } catch (e) {
            const msg = e instanceof Error ? e.message : 'CSV parse error';
            return { ok: false as const, error: msg };
        }
    }, [csvText]);

    async function importNow() {
        if (!parsed.ok) {
            setStatus(parsed.error);
            return;
        }
        if (parsed.rows.length === 0) {
            setStatus('CSV kosong / tidak valid.');
            return;
        }

        setBusy(true);
        setStatus('Memproses import…');

        try {
            // 1) refresh set list agar mapping terbaru
            const { data: existingSets, error: e0 } = await supabase
                .from('quiz_sets')
                .select('id,name,is_active')
                .eq('is_active', true);

            if (e0) throw e0;

            const nameToId = new Map<string, string>();
            for (const s of (existingSets ?? []) as any[]) {
                nameToId.set(String(s.name).trim(), String(s.id));
            }

            // 2) create set yang belum ada
            const toCreateNames: string[] = [];
            for (const setName of parsed.bySet.keys()) {
                if (!nameToId.has(setName)) toCreateNames.push(setName);
            }

            if (toCreateNames.length > 0) {
                const createPayload = toCreateNames.map(n => ({
                    name: n,
                    description: 'Imported via CSV',
                    owner_id: null, // trigger isi auth.uid()
                    is_active: true,
                }));

                const { data: created, error: e1 } = await supabase
                    .from('quiz_sets')
                    .insert(createPayload)
                    .select('id,name');

                if (e1) throw e1;

                for (const s of (created ?? []) as any[]) {
                    nameToId.set(String(s.name).trim(), String(s.id));
                }
            }

            // 3) ambil daftar kanji yang memang ada di tabel kanji (biar gak error FK)
            const allKanji = Array.from(parsed.bySet.values())
                .flatMap(s => Array.from(s));
            const uniqueKanji = Array.from(new Set(allKanji));

            const { data: existKanjiRows, error: e2 } = await supabase
                .from('kanji')
                .select('id')
                .in('id', uniqueKanji);

            if (e2) throw e2;

            const existKanji = new Set((existKanjiRows ?? []).map((r: any) => String(r.id)));

            // 4) build rows untuk quiz_set_items
            const itemRows: Array<{ set_id: string; kanji_id: string }> = [];
            const missing: CsvRow[] = [];

            for (const [setName, kanjiSet] of parsed.bySet.entries()) {
                const set_id = nameToId.get(setName);
                if (!set_id) continue;

                for (const kanji_id of kanjiSet) {
                    if (!existKanji.has(kanji_id)) {
                        missing.push({ set_name: setName, kanji_id });
                        continue;
                    }
                    itemRows.push({ set_id, kanji_id });
                }
            }

            if (itemRows.length === 0) {
                setStatus(
                    missing.length
                        ? `Tidak ada yang bisa di-insert. Semua kanji di CSV tidak ditemukan di tabel kanji. Contoh missing: ${missing[0].kanji_id}`
                        : 'Tidak ada item yang bisa diinsert.'
                );
                setBusy(false);
                return;
            }

            // 5) upsert ke quiz_set_items (no duplicate)
            const { error: e3 } = await supabase
                .from('quiz_set_items')
                .upsert(itemRows, { onConflict: 'set_id,kanji_id' });

            if (e3) throw e3;

            await loadSets();

            const msgLines = [
                `✅ Import sukses!`,
                `• Set dari CSV: ${parsed.setCount}`,
                `• Total baris CSV: ${parsed.itemCount}`,
                `• Insert/Upsert pairs: ${itemRows.length}`,
            ];

            if (missing.length) {
                const sample = missing.slice(0, 6).map(m => `${m.set_name}:${m.kanji_id}`).join(', ');
                msgLines.push(`⚠️ ${missing.length} kanji tidak ada di tabel kanji (contoh: ${sample})`);
                msgLines.push(`Tip: tambahkan dulu kanji itu ke tabel public.kanji (master).`);
            }

            setStatus(msgLines.join('\n'));
        } catch (err) {
            console.error(err);
            const msg = err instanceof Error ? err.message : 'Unknown error';
            setStatus(`❌ Gagal import: ${msg}`);
        } finally {
            setBusy(false);
        }
    }

    return (
        <div className="min-h-screen px-4 py-10">
            <div className="mx-auto max-w-5xl">
                <div className="rounded-[28px] border border-white/10 bg-white/5 p-6 md:p-8 shadow-[0_30px_120px_rgba(0,0,0,0.45)] backdrop-blur-xl">
                    <div className="flex flex-col gap-2">
                        <div className="text-sm text-white/60">Kanji Laopu • Bulk Import</div>
                        <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">
                            Import banyak Quiz Set sekaligus
                        </h1>
                        <p className="text-white/60">
                            Upload/paste CSV untuk bikin set + isi kanji. (Minimal 4 kanji per set agar bisa quiz)
                        </p>
                        <div className="text-xs text-white/50">
                            Login: <span className="text-white/70">{email || '—'}</span>
                        </div>
                    </div>

                    <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-4">
                        {/* Left: CSV editor */}
                        <div className="rounded-2xl border border-white/10 bg-black/20 p-5">
                            <div className="flex items-center justify-between gap-2">
                                <div className="font-semibold">CSV Input</div>
                                <button
                                    onClick={() => setCsvText(`set_name,kanji_id\nN5 Starter,今\nN5 Starter,日\nN5 Starter,人\nN5 Starter,時`)}
                                    className="text-xs text-white/70 hover:text-white"
                                >
                                    Reset example
                                </button>
                            </div>

                            <textarea
                                value={csvText}
                                onChange={(e) => setCsvText(e.target.value)}
                                className="mt-3 h-[340px] w-full rounded-xl bg-black/25 border border-white/10 px-4 py-3 text-sm text-white/90 outline-none focus:border-fuchsia-400/60"
                                spellCheck={false}
                            />

                            <div className="mt-3 text-xs text-white/55">
                                Header wajib: <span className="text-white/80">set_name,kanji_id</span>
                            </div>

                            <button
                                onClick={importNow}
                                disabled={busy || !parsed.ok}
                                className={cn(
                                    "mt-4 w-full rounded-xl px-4 py-3 font-medium transition",
                                    "bg-gradient-to-r from-fuchsia-500 to-pink-500 text-white",
                                    "hover:brightness-110 active:brightness-95",
                                    (busy || !parsed.ok) && "opacity-60 cursor-not-allowed"
                                )}
                            >
                                {busy ? 'Importing…' : 'Import ke Database'}
                            </button>

                            {!parsed.ok && (
                                <div className="mt-3 text-xs text-rose-300">
                                    {parsed.error}
                                </div>
                            )}
                        </div>

                        {/* Right: summary & existing sets */}
                        <div className="rounded-2xl border border-white/10 bg-black/20 p-5">
                            <div className="font-semibold">Ringkasan</div>

                            <div className="mt-3 grid grid-cols-3 gap-3">
                                <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                                    <div className="text-xs text-white/55">Sets</div>
                                    <div className="mt-1 text-2xl font-semibold">
                                        {parsed.ok ? parsed.setCount : '—'}
                                    </div>
                                </div>
                                <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                                    <div className="text-xs text-white/55">Rows</div>
                                    <div className="mt-1 text-2xl font-semibold">
                                        {parsed.ok ? parsed.itemCount : '—'}
                                    </div>
                                </div>
                                <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                                    <div className="text-xs text-white/55">Unique</div>
                                    <div className="mt-1 text-2xl font-semibold">
                                        {parsed.ok ? parsed.uniquePairs : '—'}
                                    </div>
                                </div>
                            </div>

                            <div className="mt-4 rounded-xl border border-white/10 bg-white/5 p-4">
                                <div className="text-xs text-white/60">Status</div>
                                <pre className="mt-2 whitespace-pre-wrap text-xs text-white/80">
                                    {status || '—'}
                                </pre>
                            </div>

                            <div className="mt-5 flex items-center justify-between">
                                <div className="font-semibold">Set kamu</div>
                                <button
                                    onClick={loadSets}
                                    className="text-xs text-white/70 hover:text-white"
                                >
                                    Refresh
                                </button>
                            </div>

                            <div className="mt-3 space-y-2">
                                {loadingSets ? (
                                    <div className="text-sm text-white/60">Loading…</div>
                                ) : sets.length === 0 ? (
                                    <div className="text-sm text-white/60">Belum ada set.</div>
                                ) : (
                                    sets.slice(0, 8).map((s) => (
                                        <div
                                            key={s.id}
                                            className="rounded-xl border border-white/10 bg-black/20 p-3 flex items-center justify-between"
                                        >
                                            <div>
                                                <div className="text-sm font-medium">{s.name}</div>
                                                <div className="text-xs text-white/60">
                                                    {s.description || '—'}
                                                </div>
                                            </div>

                                            <button
                                                onClick={() => router.push(`/quiz?set=${s.id}`)}
                                                className="rounded-lg bg-white/10 px-3 py-2 text-xs hover:bg-white/15"
                                            >
                                                Start
                                            </button>
                                        </div>
                                    ))
                                )}
                            </div>

                            <div className="mt-6 flex flex-wrap gap-2 justify-center">
                                <button
                                    onClick={() => router.push('/quiz')}
                                    className="rounded-xl bg-white/10 px-4 py-2 text-sm hover:bg-white/15"
                                >
                                    ← Quiz Sets
                                </button>
                                <button
                                    onClick={() => router.push('/')}
                                    className="rounded-xl bg-white/10 px-4 py-2 text-sm hover:bg-white/15"
                                >
                                    Main Menu
                                </button>
                            </div>
                        </div>
                    </div>

                    <div className="mt-6 text-xs text-white/50">
                        Catatan: Import ini hanya menambahkan item ke set dari kanji yang sudah ada di tabel <span className="text-white/70">public.kanji</span>.
                        Kalau ada “missing kanji”, kamu perlu menambahkannya dulu ke tabel kanji master.
                    </div>
                </div>
            </div>
        </div>
    );
}
