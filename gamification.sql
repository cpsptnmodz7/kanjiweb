create extension if not exists "uuid-ossp";

-- =========================
-- A) XP / Level / Streak / Badges
-- =========================
create table if not exists public.user_profile (
  user_id uuid primary key references auth.users(id) on delete cascade,
  xp int not null default 0,
  level int not null default 1,
  coins int not null default 0,
  streak_count int not null default 0,
  last_active_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.xp_events (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  source text not null, -- 'quiz' | 'review' | 'mission' | 'voice'
  points int not null,
  meta jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.badges (
  code text primary key, -- e.g. 'streak_7', 'xp_1000'
  title text not null,
  description text,
  icon text,
  created_at timestamptz not null default now()
);

create table if not exists public.user_badges (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  badge_code text not null references public.badges(code) on delete cascade,
  earned_at timestamptz not null default now(),
  unique(user_id, badge_code)
);

-- Seed badges (aman di-run berkali-kali)
insert into public.badges(code,title,description,icon) values
('streak_3','Streak 3 Hari','Belajar 3 hari berturut-turut','🔥'),
('streak_7','Streak 7 Hari','Belajar 7 hari berturut-turut','🔥'),
('streak_30','Streak 30 Hari','Belajar 30 hari berturut-turut','🔥'),
('xp_500','XP 500','Kumpulkan 500 XP','✨'),
('xp_2000','XP 2000','Kumpulkan 2000 XP','✨')
on conflict (code) do nothing;

-- =========================
-- B) Daily Missions + Reward Shop
-- =========================
create table if not exists public.daily_missions (
  code text primary key, -- e.g. 'review_10', 'quiz_5', 'save_10k'
  title text not null,
  description text,
  kind text not null, -- 'review' | 'quiz' | 'savings' | 'voice'
  target int not null,
  reward_xp int not null default 0,
  reward_coins int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.daily_mission_progress (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  mission_code text not null references public.daily_missions(code) on delete cascade,
  day date not null,
  progress int not null default 0,
  completed boolean not null default false,
  claimed boolean not null default false,
  updated_at timestamptz not null default now(),
  unique(user_id, mission_code, day)
);

-- Seed missions
insert into public.daily_missions(code,title,description,kind,target,reward_xp,reward_coins) values
('review_10','Review 10 Kanji','Selesaikan 10 review hari ini','review',10,40,15),
('quiz_5','Quiz 5 Soal','Main 5 soal quiz hari ini','quiz',5,30,10),
('save_1','Nabung 1x','Tambah transaksi celengan 1x hari ini','savings',1,20,15),
('voice_1','Join Voice Class','Gabung voice room 1x hari ini','voice',1,25,10)
on conflict (code) do nothing;

create table if not exists public.shop_items (
  sku text primary key, -- e.g. 'theme_neon', 'badge_showcase_1'
  title text not null,
  description text,
  price_coins int not null,
  kind text not null default 'cosmetic',
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.user_purchases (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  sku text not null references public.shop_items(sku) on delete cascade,
  purchased_at timestamptz not null default now(),
  unique(user_id, sku)
);

insert into public.shop_items(sku,title,description,price_coins,kind) values
('theme_neon','Theme Neon Pink','Unlock neon pink glow theme',120,'cosmetic'),
('title_sensei','Title: Sensei','Show title Sensei on profile',200,'cosmetic')
on conflict (sku) do nothing;

-- =========================
-- E) Voice rooms metadata (LiveKit room name)
-- =========================
create table if not exists public.voice_rooms (
  id uuid primary key default uuid_generate_v4(),
  room_name text not null unique, -- livekit room name
  title text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.voice_room_join_logs (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  room_id uuid not null references public.voice_rooms(id) on delete cascade,
  joined_at timestamptz not null default now()
);

-- Seed 2 rooms
insert into public.voice_rooms(room_name,title,is_active) values
('kelas-umum','Kelas Umum',true),
('kelas-n5','Kelas N5',true)
on conflict (room_name) do nothing;

-- =========================
-- RLS
-- =========================
alter table public.user_profile enable row level security;
alter table public.xp_events enable row level security;
alter table public.user_badges enable row level security;
alter table public.daily_mission_progress enable row level security;
alter table public.user_purchases enable row level security;
alter table public.voice_room_join_logs enable row level security;

-- user_profile
drop policy if exists "profile_select_own" on public.user_profile;
create policy "profile_select_own" on public.user_profile
for select to authenticated
using (auth.uid() = user_id);

drop policy if exists "profile_upsert_own" on public.user_profile;
create policy "profile_upsert_own" on public.user_profile
for all to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

-- xp_events
drop policy if exists "xp_select_own" on public.xp_events;
create policy "xp_select_own" on public.xp_events
for select to authenticated
using (auth.uid() = user_id);

drop policy if exists "xp_insert_own" on public.xp_events;
create policy "xp_insert_own" on public.xp_events
for insert to authenticated
with check (auth.uid() = user_id);

-- user_badges
drop policy if exists "user_badges_select_own" on public.user_badges;
create policy "user_badges_select_own" on public.user_badges
for select to authenticated
using (auth.uid() = user_id);

drop policy if exists "user_badges_insert_own" on public.user_badges;
create policy "user_badges_insert_own" on public.user_badges
for insert to authenticated
with check (auth.uid() = user_id);

-- daily_mission_progress
drop policy if exists "dmp_select_own" on public.daily_mission_progress;
create policy "dmp_select_own" on public.daily_mission_progress
for select to authenticated
using (auth.uid() = user_id);

drop policy if exists "dmp_write_own" on public.daily_mission_progress;
create policy "dmp_write_own" on public.daily_mission_progress
for all to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

-- purchases
drop policy if exists "purchases_select_own" on public.user_purchases;
create policy "purchases_select_own" on public.user_purchases
for select to authenticated
using (auth.uid() = user_id);

drop policy if exists "purchases_insert_own" on public.user_purchases;
create policy "purchases_insert_own" on public.user_purchases
for insert to authenticated
with check (auth.uid() = user_id);

-- voice join logs
drop policy if exists "voice_join_insert_own" on public.voice_room_join_logs;
create policy "voice_join_insert_own" on public.voice_room_join_logs
for insert to authenticated
with check (auth.uid() = user_id);

drop policy if exists "voice_join_select_own" on public.voice_room_join_logs;
create policy "voice_join_select_own" on public.voice_room_join_logs
for select to authenticated
using (auth.uid() = user_id);
