-- ============================================================
-- Core Architect — Phase 1 Schema
-- Run this in Supabase SQL Editor (Project → SQL Editor → New query)
-- ============================================================

-- ------------------------------------------------------------
-- 1. PROFILES
-- Mirrors auth.users (Supabase auth handles email+password).
-- One row per user, auto-created on signup via trigger below.
-- ------------------------------------------------------------
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  roadmap_start_date date,          -- first date the heatmap should render boxes from
  created_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- 2. MAIN_TASKS
-- One row per Main Task per calendar day.
-- "source_key" lets a roadmap file map its own task IDs onto rows.
-- ------------------------------------------------------------
create table if not exists main_tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  task_date date not null,
  source_key text not null,          -- stable id from the roadmap file, e.g. "dsa", "iitm-ds"
  title text not null,
  planned_seconds integer not null,  -- total planned duration for this Main Task
  time_share numeric not null default 0, -- this task's share of the day's total planned time (0-1)
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  unique (user_id, task_date, source_key)
);

-- ------------------------------------------------------------
-- 3. SUB_TASKS
-- Ordered, linear children of a Main Task.
-- ------------------------------------------------------------
create table if not exists sub_tasks (
  id uuid primary key default gen_random_uuid(),
  main_task_id uuid not null references main_tasks(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  source_key text not null,          -- stable id from the roadmap file, e.g. "lecture", "practice"
  title text not null,
  planned_seconds integer not null,
  sequence integer not null,         -- linear order within the Main Task, 0-based
  completed_seconds integer not null default 0,
  status text not null default 'pending' check (status in ('pending','active','completed')),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (main_task_id, source_key)
);

-- ------------------------------------------------------------
-- 4. TIMER_SESSIONS
-- Every Start→Pause/Stop interval is one row. Live progress is
-- derived by summing durations + any currently-open (ended_at
-- is null) session.
-- ------------------------------------------------------------
create table if not exists timer_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  sub_task_id uuid not null references sub_tasks(id) on delete cascade,
  started_at timestamptz not null default now(),
  ended_at timestamptz               -- null while the timer is actively running
);

-- ------------------------------------------------------------
-- 5. CATCH_UP_LOG
-- Tracks shortfalls and whether/when they were made up, to
-- enforce the FIFO-within-week rule and the weekly lock.
-- ------------------------------------------------------------
create table if not exists catch_up_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  shortfall_date date not null,       -- the day that fell short
  shortfall_seconds integer not null,
  week_start_date date not null,      -- the Sunday that starts that week's column
  resolved_seconds integer not null default 0,
  locked boolean not null default false, -- true once the week rolls over unresolved
  created_at timestamptz not null default now()
);

-- ============================================================
-- Auto-create a profile row whenever a new auth user signs up
-- ============================================================
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email);
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ============================================================
-- Row Level Security — every user can only see/edit their own rows
-- ============================================================
alter table profiles enable row level security;
alter table main_tasks enable row level security;
alter table sub_tasks enable row level security;
alter table timer_sessions enable row level security;
alter table catch_up_log enable row level security;

create policy "own profile" on profiles
  for all using (auth.uid() = id) with check (auth.uid() = id);

create policy "own main_tasks" on main_tasks
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own sub_tasks" on sub_tasks
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own timer_sessions" on timer_sessions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own catch_up_log" on catch_up_log
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
