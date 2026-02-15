'use client';

import React, { useEffect, useMemo, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

type QuizSet = {
    id: string;
    name: string;
    description: string | null;
    created_at: string;
    is_active: boolean;
};

type KanjiRow = {
    id: string;       // kanji char
    level: string;    // N5, etc
    meaning: string;
    onyomi: string;
    kunyomi: string;
};

function cn(...xs: Array<string | false | null | undefined>) {
    return xs.filter(Boolean).join(' ');
}

function pickRandom<T>(arr: T[]): T {
    return arr[Math.floor(Math.random() * arr.length)];
}

function shuffle<T>(arr: T[]) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

// Internal component using searchParams
function QuizContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const setId = searchParams.get('set') || '';

    const [sessionEmail, setSessionEmail] = useState<string>('');

    // selector state
    const [sets, setSets] = useState<QuizSet[]>([]);
    const [loadingSets, setLoadingSets] = useState(true);
    const [newSetName, setNewSetName] = useState('N5 Starter');
    const [newSetDesc, setNewSetDesc] = useState('Kanji dasar untuk latihan awal (N5).');
    const [busy, setBusy] = useState<string>('');

    // quiz state
    const [pool, setPool] = useState<KanjiRow[]>([]);
    const [loadingQuiz, setLoadingQuiz] = useState(false);
    const [idx, setIdx] = useState(0);
    const [correctCount, setCorrectCount] = useState(0);
    const [wrongCount, setWrongCount] = useState(0);
    const [picked, setPicked] = useState<string | null>(null);
    const [feedback, setFeedback] = useState<'idle' | 'correct' | 'wrong'>('idle');

    const current = pool[idx] || null;

    const question = useMemo(() => {
        if (!current) return null;
        // Mode: "Meaning -> pilih Kanji"
        const correct = current;
        const wrongs = shuffle(pool.filter(k => k.id !== correct.id)).slice(0, 3);
        const options = shuffle([correct, ...wrongs]);
        return { correct, options };
    }, [current, pool]);

    // ---------- STYLE HELPERS ----------
    const Shell = ({ children }: { children: React.ReactNode }) => (
        <div className="min-h-[calc(100vh-0px)] w-full px-4 py-10 md:py-14">
            <div className="mx-auto w-full max-w-4xl">{children}</div>
        </div>
    );

    // ---------- AUTH SESSION ----------
    useEffect(() => {
        let mounted = true;
        (async () => {
            const { data } = await supabase.auth.getSession();
            const email = data.session?.user?.email ?? '';
            if (mounted) setSessionEmail(email);
        })();

        const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
            setSessionEmail(session?.user?.email ?? '');
        });

        return () => {
            mounted = false;
            sub.subscription.unsubscribe();
        };
    }, []);

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
        if (!setId) loadSets();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [setId]);

    // ---------- CREATE SET ----------
    async function createSet() {
        if (!newSetName.trim()) return;
        setBusy('create');
        const { data, error } = await supabase
            .from('quiz_sets')
            .insert({
                name: newSetName.trim(),
                description: newSetDesc.trim() || null,
                owner_id: null, // biar trigger isi auth.uid()
                is_active: true,
            })
            .select('id,name,description,created_at,is_active')
            .single();

        if (error) {
            console.error(error);
            alert(error.message);
            setBusy('');
            return;
        }

        setBusy('');
        await loadSets();

        // auto masuk set baru
        if (data?.id) {
            router.push(`/quiz?set=${data.id}`);
        }
    }

    // ---------- BULK ADD N5 ----------
    async function addAllN5ToSet(targetSetId: string) {
        setBusy(`bulk:${targetSetId}`);
        try {
            // ambil semua N5 dari kanji master
            const { data: kanjiN5, error: e1 } = await supabase
                .from('kanji')
                .select('id')
                .eq('level', 'N5');

            if (e1) throw e1;

            const rows = (kanjiN5 ?? []).map((k: { id: string }) => ({
                set_id: targetSetId,
                kanji_id: k.id,
            }));

            if (rows.length === 0) {
                alert('Tidak ada data N5 di tabel kanji.');
                setBusy('');
                return;
            }

            // upsert biar aman (kalau sudah ada, tidak duplikat)
            const { error: e2 } = await supabase
                .from('quiz_set_items')
                .upsert(rows, { onConflict: 'set_id,kanji_id' });

            if (e2) throw e2;

            alert(`Berhasil menambahkan ${rows.length} kanji N5 ke set.`);
        } catch (err) {
            console.error(err);
            const msg = err instanceof Error ? err.message : 'Gagal bulk add N5';
            alert(msg);
        } finally {
            setBusy('');
        }
    }

    // ---------- LOAD QUIZ BY SET ----------
    async function loadQuizBySet(targetSetId: string) {
        setLoadingQuiz(true);
        setPicked(null);
        setFeedback('idle');
        setIdx(0);
        setCorrectCount(0);
        setWrongCount(0);

        // ambil kanji_id dari set
        const { data: items, error: e1 } = await supabase
            .from('quiz_set_items')
            .select('kanji_id')
            .eq('set_id', targetSetId);

        if (e1) {
            console.error(e1);
            alert(e1.message);
            setLoadingQuiz(false);
            return;
        }

        const ids = (items ?? []).map((x: any) => x.kanji_id);

        if (ids.length < 4) {
            setPool([]);
            setLoadingQuiz(false);
            alert('Set ini belum punya minimal 4 kanji. Tambahkan kanji dulu ya.');
            return;
        }

        // ambil detail kanji
        const { data: kanjiRows, error: e2 } = await supabase
            .from('kanji')
            .select('id,level,meaning,onyomi,kunyomi')
            .in('id', ids);

        if (e2) {
            console.error(e2);
            alert(e2.message);
            setLoadingQuiz(false);
            return;
        }

        const list = (kanjiRows ?? []) as KanjiRow[];
        setPool(shuffle(list));
        setLoadingQuiz(false);
    }

    useEffect(() => {
        if (!setId) return;
        loadQuizBySet(setId);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [setId]);

    // ---------- QUIZ ACTIONS ----------
    function answer(chosenId: string) {
        if (!question || picked) return;
        setPicked(chosenId);
        const isCorrect = chosenId === question.correct.id;
        setFeedback(isCorrect ? 'correct' : 'wrong');
        if (isCorrect) setCorrectCount(v => v + 1);
        else setWrongCount(v => v + 1);

        // next after short delay
        window.setTimeout(() => {
            setPicked(null);
            setFeedback('idle');
            setIdx(v => {
                const next = v + 1;
                if (next >= pool.length) return v; // stop
                return next;
            });
        }, 550);
    }

    const done = pool.length > 0 && idx >= pool.length - 1 && picked !== null;

    // ---------- UI ----------
    // NOTE: jika kamu sudah guard via layout/AuthGuard, bagian ini bisa dihapus.
    // Tapi aman: kalau belum login, arahkan ke /login
    useEffect(() => {
        if (sessionEmail === '') {
            // kita tidak langsung redirect di first paint untuk menghindari flicker
            // tapi kalau benar2 tidak ada session -> ke login
            supabase.auth.getSession().then(({ data }) => {
                if (!data.session) router.replace('/login');
            });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [sessionEmail]);

    // ====== SELECTOR VIEW (no set param) ======
    if (!setId) {
        return (
            <Shell>
                <div className="rounded-[28px] border border-white/10 bg-white/5 p-6 md:p-8 shadow-[0_30px_120px_rgba(0,0,0,0.45)] backdrop-blur-xl">
                    <div className="flex flex-col gap-2">
                        <div className="text-sm text-white/60">Kanji Laopu • Quiz Sets</div>
                        <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">
                            Pilih set quiz
                        </h1>
                        <p className="text-white/60">
                            Kamu bisa punya banyak quiz sekaligus: N5, N4, tema, daily mix, dll.
                        </p>
                    </div>

                    <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur">
                            <div className="font-semibold">Buat set baru</div>
                            <div className="mt-3 space-y-3">
                                <div>
                                    <label className="text-xs text-white/60">Nama set</label>
                                    <input
                                        value={newSetName}
                                        onChange={(e) => setNewSetName(e.target.value)}
                                        className="mt-1 w-full rounded-xl bg-black/25 border border-white/10 px-4 py-3 text-white outline-none focus:border-fuchsia-400/60"
                                        placeholder="Misal: N5 Starter"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs text-white/60">Deskripsi</label>
                                    <input
                                        value={newSetDesc}
                                        onChange={(e) => setNewSetDesc(e.target.value)}
                                        className="mt-1 w-full rounded-xl bg-black/25 border border-white/10 px-4 py-3 text-white outline-none focus:border-fuchsia-400/60"
                                        placeholder="Misal: Kanji N5 untuk pemula"
                                    />
                                </div>

                                <button
                                    onClick={createSet}
                                    disabled={busy === 'create'}
                                    className={cn(
                                        "w-full rounded-xl px-4 py-3 font-medium transition",
                                        "bg-gradient-to-r from-fuchsia-500 to-pink-500 text-white",
                                        "hover:brightness-110 active:brightness-95",
                                        busy === 'create' && "opacity-60 cursor-not-allowed"
                                    )}
                                >
                                    {busy === 'create' ? 'Creating…' : 'Create & Start'}
                                </button>
                            </div>

                            <div className="mt-4 text-xs text-white/50">
                                Tips: setelah buat set, kamu bisa klik “Add all N5” untuk isi cepat.
                            </div>
                        </div>

                        <div className="rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur">
                            <div className="flex items-center justify-between">
                                <div className="font-semibold">Set milikmu</div>
                                <button
                                    onClick={loadSets}
                                    className="text-xs text-white/70 hover:text-white"
                                >
                                    Refresh
                                </button>
                            </div>

                            <div className="mt-3 space-y-3">
                                {loadingSets ? (
                                    <div className="text-white/60 text-sm">Loading sets…</div>
                                ) : sets.length === 0 ? (
                                    <div className="text-white/60 text-sm">
                                        Belum ada set. Buat dulu di sebelah kiri.
                                    </div>
                                ) : (
                                    sets.map((s) => (
                                        <div
                                            key={s.id}
                                            className="rounded-xl border border-white/10 bg-black/20 p-4"
                                        >
                                            <div className="flex items-start justify-between gap-3">
                                                <div>
                                                    <div className="font-medium">{s.name}</div>
                                                    <div className="text-xs text-white/60">
                                                        {s.description || '—'}
                                                    </div>
                                                </div>

                                                <button
                                                    onClick={() => router.push(`/quiz?set=${s.id}`)}
                                                    className="shrink-0 rounded-lg bg-white/10 px-3 py-2 text-sm hover:bg-white/15"
                                                >
                                                    Start
                                                </button>
                                            </div>

                                            <div className="mt-3 flex flex-wrap gap-2">
                                                <button
                                                    onClick={() => addAllN5ToSet(s.id)}
                                                    disabled={busy === `bulk:${s.id}`}
                                                    className={cn(
                                                        "rounded-lg px-3 py-2 text-xs border border-white/10 bg-white/5 hover:bg-white/10",
                                                        busy === `bulk:${s.id}` && "opacity-60 cursor-not-allowed"
                                                    )}
                                                >
                                                    {busy === `bulk:${s.id}` ? 'Adding N5…' : 'Add all N5'}
                                                </button>

                                                <button
                                                    onClick={() => router.push(`/quiz?set=${s.id}`)}
                                                    className="rounded-lg px-3 py-2 text-xs bg-fuchsia-500/20 border border-fuchsia-400/30 hover:bg-fuchsia-500/25"
                                                >
                                                    Open quiz
                                                </button>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="mt-6 flex items-center justify-center">
                        <button
                            onClick={() => router.push('/')}
                            className="text-sm text-white/70 hover:text-white"
                        >
                            ← Back to Home
                        </button>
                    </div>
                </div>
            </Shell>
        );
    }

    // ====== QUIZ VIEW (has set param) ======
    return (
        <Shell>
            <div className="rounded-[28px] border border-white/10 bg-white/5 p-6 md:p-8 shadow-[0_30px_120px_rgba(0,0,0,0.45)] backdrop-blur-xl">
                <div className="flex items-center justify-between gap-3">
                    <div>
                        <div className="text-xs text-white/60">Kanji Laopu • Quiz</div>
                        <div className="text-lg md:text-xl font-semibold">Multiple Choice</div>
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => router.push('/quiz')}
                            className="rounded-xl bg-white/10 px-4 py-2 text-sm hover:bg-white/15"
                        >
                            ← Change set
                        </button>
                        <button
                            onClick={() => router.push('/')}
                            className="rounded-xl bg-white/10 px-4 py-2 text-sm hover:bg-white/15"
                        >
                            Main menu
                        </button>
                    </div>
                </div>

                <div className="mt-5">
                    <div className="flex items-center justify-between text-xs text-white/60">
                        <span>Progress</span>
                        <span>
                            {pool.length === 0 ? '0/0' : `${Math.min(idx + 1, pool.length)}/${pool.length}`}
                        </span>
                    </div>
                    <div className="mt-2 h-2 rounded-full bg-white/10 overflow-hidden">
                        <div
                            className="h-2 rounded-full bg-gradient-to-r from-fuchsia-500 to-pink-500 transition-all"
                            style={{
                                width:
                                    pool.length === 0
                                        ? '0%'
                                        : `${Math.min(((idx + 1) / pool.length) * 100, 100)}%`,
                            }}
                        />
                    </div>
                </div>

                <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="md:col-span-2 rounded-2xl border border-white/10 bg-black/20 p-6">
                        {loadingQuiz ? (
                            <div className="text-white/70">Loading quiz…</div>
                        ) : pool.length === 0 ? (
                            <div className="text-white/70">
                                Set ini belum punya data atau kurang dari 4 kanji.
                                <div className="mt-3">
                                    <button
                                        onClick={() => router.push('/quiz')}
                                        className="rounded-xl bg-white/10 px-4 py-2 text-sm hover:bg-white/15"
                                    >
                                        Kembali pilih set
                                    </button>
                                </div>
                            </div>
                        ) : !question ? (
                            <div className="text-white/70">Menyiapkan soal…</div>
                        ) : (
                            <>
                                <div className="text-xs tracking-[0.2em] text-white/50">
                                    MEANING
                                </div>
                                <div className="mt-2 text-4xl md:text-5xl font-semibold">
                                    {question.correct.meaning}
                                </div>
                                <div className="mt-2 text-sm text-white/60">
                                    Pilih kanji yang benar.
                                </div>

                                <div className="mt-6 grid grid-cols-2 gap-3">
                                    {question.options.map((k) => {
                                        const isChosen = picked === k.id;
                                        const isCorrect = question.correct.id === k.id;

                                        const stateClass =
                                            picked === null
                                                ? 'bg-white/5 hover:bg-white/10 border-white/10'
                                                : isChosen && isCorrect
                                                    ? 'bg-emerald-500/15 border-emerald-400/40'
                                                    : isChosen && !isCorrect
                                                        ? 'bg-rose-500/15 border-rose-400/40'
                                                        : isCorrect
                                                            ? 'bg-emerald-500/10 border-emerald-400/25'
                                                            : 'bg-white/5 border-white/10 opacity-70';

                                        return (
                                            <button
                                                key={k.id}
                                                onClick={() => answer(k.id)}
                                                disabled={picked !== null}
                                                className={cn(
                                                    "rounded-2xl border p-6 md:p-7 text-center transition",
                                                    stateClass
                                                )}
                                            >
                                                <div className="text-4xl md:text-5xl font-medium">
                                                    {k.id}
                                                </div>
                                                <div className="mt-2 text-xs text-white/55">
                                                    {k.level}
                                                </div>
                                            </button>
                                        );
                                    })}
                                </div>

                                <div className="mt-6 flex items-center justify-between text-sm text-white/70">
                                    <div>
                                        ✅ {correctCount} &nbsp; • &nbsp; ❌ {wrongCount}
                                    </div>

                                    <div className={cn(
                                        "transition",
                                        feedback === 'idle' && "opacity-0",
                                        feedback !== 'idle' && "opacity-100"
                                    )}>
                                        {feedback === 'correct' ? 'Nice! 🎉' : feedback === 'wrong' ? 'Oops 😅' : ''}
                                    </div>
                                </div>

                                {done && (
                                    <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-5">
                                        <div className="font-semibold">Selesai 🎯</div>
                                        <div className="mt-1 text-white/70 text-sm">
                                            Skor: {correctCount} benar, {wrongCount} salah.
                                        </div>
                                        <div className="mt-4 flex gap-2">
                                            <button
                                                onClick={() => loadQuizBySet(setId)}
                                                className="rounded-xl bg-gradient-to-r from-fuchsia-500 to-pink-500 px-4 py-2 text-sm font-medium"
                                            >
                                                Try again
                                            </button>
                                            <button
                                                onClick={() => router.push('/quiz')}
                                                className="rounded-xl bg-white/10 px-4 py-2 text-sm hover:bg-white/15"
                                            >
                                                Change set
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </>
                        )}
                    </div>

                    <div className="rounded-2xl border border-white/10 bg-black/20 p-6">
                        <div className="text-sm font-semibold">Quiz Info</div>
                        <div className="mt-3 space-y-2 text-sm text-white/70">
                            <div className="flex items-center justify-between">
                                <span>Mode</span>
                                <span className="text-white/90">Meaning → Kanji</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span>Items</span>
                                <span className="text-white/90">{pool.length}</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span>User</span>
                                <span className="text-white/90">{sessionEmail || '—'}</span>
                            </div>
                        </div>

                        <div className="mt-6 rounded-xl border border-white/10 bg-white/5 p-4 text-xs text-white/60">
                            Next: kita bisa tambah “Typing mode”, “Timer”, dan “Quiz by Level” tinggal bikin set baru.
                        </div>
                    </div>
                </div>
            </div>
        </Shell>
    );
}

// Export default wrapping content in Suspense
export default function QuizPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen w-full flex items-center justify-center text-white/50">
                Loading quiz...
            </div>
        }>
            <QuizContent />
        </Suspense>
    );
}
