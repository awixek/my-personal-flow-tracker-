-- ============================================================
-- Core Architect — Phase 4 migration
-- Run this in Supabase SQL Editor AFTER the original schema.sql.
-- Adds: exam-week toggle, and everything the catch-up rule needs.
-- ============================================================

-- Manual exam-week toggle (per user). When on, the IITM Coursework
-- Main Task's quiz-prep sub-task is included for every day generated
-- while it stays on. Toggling only affects days generated from now on
-- — it never rewrites a day whose rows already exist.
alter table profiles
  add column if not exists exam_week boolean not null default false;

-- Support a live, resumable "make-up" timer directly on a catch_up_log
-- row (no need for a separate timer_sessions row per catch-up session).
alter table catch_up_log
  add column if not exists active_started_at timestamptz;

-- Prevents the daily shortfall-backfill step from ever creating two rows
-- for the same missed day.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'catch_up_log_user_date_unique'
  ) then
    alter table catch_up_log
      add constraint catch_up_log_user_date_unique unique (user_id, shortfall_date);
  end if;
end $$;
