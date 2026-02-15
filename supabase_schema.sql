-- =====================================
-- EXTENSIONS
-- =====================================
create extension if not exists "uuid-ossp";

-- =====================================
-- PROFILES (optional)
-- =====================================
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  created_at timestamp default now()
);

-- =====================================
-- SRS CARDS (core system)
-- =====================================
create table if not exists public.srs_cards (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade,

  kanji text not null,
  meaning text,

  interval integer default 1,
  ease numeric default 2.5,
  due_date timestamp default now(),
  last_review timestamp,

  correct_count integer default 0,
  wrong_count integer default 0,

  created_at timestamp default now()
);

-- =====================================
-- REVIEW LOGS
-- =====================================
create table if not exists public.review_logs (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade,
  kanji text,
  is_correct boolean,
  created_at timestamp default now()
);

-- =====================================
-- DAILY PROGRESS
-- =====================================
create table if not exists public.daily_progress (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade,

  date date default current_date,
  total integer default 0,
  correct integer default 0,
  wrong integer default 0
);

-- =====================================
-- USER STATS
-- =====================================
create table if not exists public.user_stats (
  user_id uuid primary key references auth.users(id) on delete cascade,
  streak integer default 0,
  last_review_date date
);

-- =====================================
-- DAILY MISSIONS
-- =====================================
create table if not exists public.daily_missions (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade,

  date date default current_date,
  target integer default 10,
  progress integer default 0,
  completed boolean default false
);

-- =====================================
-- MNEMONICS (optional future feature)
-- =====================================
create table if not exists public.mnemonics (
  id uuid primary key default uuid_generate_v4(),
  kanji text,
  story text
);

-- =====================================
-- ENABLE RLS
-- =====================================
alter table public.profiles enable row level security;
alter table public.srs_cards enable row level security;
alter table public.review_logs enable row level security;
alter table public.daily_progress enable row level security;
alter table public.user_stats enable row level security;
alter table public.daily_missions enable row level security;
alter table public.mnemonics enable row level security;

-- =====================================
-- POLICIES
-- =====================================

-- PROFILES
create policy "profiles own"
on public.profiles
for all
using (auth.uid() = id)
with check (auth.uid() = id);

-- SRS CARDS
create policy "srs own"
on public.srs_cards
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

-- REVIEW LOGS
create policy "review own"
on public.review_logs
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

-- DAILY PROGRESS
create policy "progress own"
on public.daily_progress
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

-- USER STATS
create policy "stats own"
on public.user_stats
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

-- DAILY MISSIONS
create policy "mission own"
on public.daily_missions
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

-- MNEMONICS (public read)
create policy "mnemonic read"
on public.mnemonics
for select
using (true);
