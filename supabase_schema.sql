-- =========================
-- EXTENSIONS
-- =========================
create extension if not exists "uuid-ossp";

-- =========================
-- SAVINGS (Celengan) - multi goal + transaksi + snapshot bulanan
-- =========================
create table if not exists public.savings_goals (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null,
  title text not null,
  monthly_target integer not null default 0,
  currency text not null default 'IDR',
  created_at timestamptz not null default now(),
  is_active boolean not null default true
);

create table if not exists public.savings_transactions (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null,
  goal_id uuid references public.savings_goals(id) on delete cascade,
  amount integer not null, -- + nabung, - ambil
  note text,
  occurred_at timestamptz not null default now()
);

-- cache agregasi bulanan (optional tapi berguna untuk dashboard cepat)
create table if not exists public.savings_monthly_stats (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null,
  goal_id uuid references public.savings_goals(id) on delete cascade,
  y int not null,
  m int not null,
  total_in integer not null default 0,
  total_out integer not null default 0,
  net integer not null default 0,
  created_at timestamptz not null default now(),
  unique(user_id, goal_id, y, m)
);

-- =========================
-- DAILY MISSIONS (gamification)
-- =========================
create table if not exists public.daily_missions (
  id uuid primary key default uuid_generate_v4(),
  title text not null,
  description text,
  kind text not null, -- 'review', 'quiz', 'streak', 'savings'
  target int not null default 1,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.daily_mission_completions (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null,
  mission_id uuid references public.daily_missions(id) on delete cascade not null,
  y int not null,
  m int not null,
  d int not null,
  progress int not null default 0,
  completed boolean not null default false,
  updated_at timestamptz not null default now(),
  unique(user_id, mission_id, y, m, d)
);

-- =========================
-- AI Logs (biar bisa audit / dashboard)
-- =========================
create table if not exists public.ai_logs (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null,
  scope text not null, -- 'budgeting' | 'sensei' | 'other'
  input jsonb,
  output jsonb,
  created_at timestamptz not null default now()
);

-- =========================
-- VOICE CLASS ROOM (LiveKit skeleton)
-- =========================
create table if not exists public.voice_rooms (
  id uuid primary key default uuid_generate_v4(),
  title text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.voice_room_members (
  id uuid primary key default uuid_generate_v4(),
  room_id uuid references public.voice_rooms(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  joined_at timestamptz not null default now(),
  left_at timestamptz,
  unique(room_id, user_id)
);

-- =========================
-- RLS
-- =========================
alter table public.savings_goals enable row level security;
alter table public.savings_transactions enable row level security;
alter table public.savings_monthly_stats enable row level security;
alter table public.daily_mission_completions enable row level security;
alter table public.ai_logs enable row level security;
alter table public.voice_room_members enable row level security;

-- Savings goals
drop policy if exists "savings_goals_select_own" on public.savings_goals;
create policy "savings_goals_select_own"
on public.savings_goals for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "savings_goals_write_own" on public.savings_goals;
create policy "savings_goals_write_own"
on public.savings_goals for all
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

-- Savings transactions
drop policy if exists "savings_tx_select_own" on public.savings_transactions;
create policy "savings_tx_select_own"
on public.savings_transactions for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "savings_tx_write_own" on public.savings_transactions;
create policy "savings_tx_write_own"
on public.savings_transactions for all
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

-- Monthly stats
drop policy if exists "savings_monthly_select_own" on public.savings_monthly_stats;
create policy "savings_monthly_select_own"
on public.savings_monthly_stats for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "savings_monthly_write_own" on public.savings_monthly_stats;
create policy "savings_monthly_write_own"
on public.savings_monthly_stats for all
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

-- Missions completions
drop policy if exists "mission_completion_select_own" on public.daily_mission_completions;
create policy "mission_completion_select_own"
on public.daily_mission_completions for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "mission_completion_write_own" on public.daily_mission_completions;
create policy "mission_completion_write_own"
on public.daily_mission_completions for all
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

-- AI logs
drop policy if exists "ai_logs_select_own" on public.ai_logs;
create policy "ai_logs_select_own"
on public.ai_logs for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "ai_logs_write_own" on public.ai_logs;
create policy "ai_logs_write_own"
on public.ai_logs for insert
to authenticated
with check (auth.uid() = user_id);

-- Voice room members
drop policy if exists "voice_members_select_own" on public.voice_room_members;
create policy "voice_members_select_own"
on public.voice_room_members for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "voice_members_write_own" on public.voice_room_members;
create policy "voice_members_write_own"
on public.voice_room_members for all
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);
