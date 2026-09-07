-- ============================================================
-- OPTIONAL — only run this if you already opened the dashboard
-- today (or any day from today onward) BEFORE this roadmap update
-- was deployed, and want today's tasks to reflect the new plan
-- (Japanese + Qualifier Exam Prep instead of the old IITM tasks).
--
-- This deletes today's (and any future) main_tasks for your account —
-- sub_tasks and timer_sessions under them are removed automatically
-- (cascade). Any progress logged today under the OLD schedule is lost;
-- past days are untouched. Next time you open the dashboard, today's
-- tasks regenerate fresh from the updated roadmap.
--
-- Replace YOUR_USER_ID below with your own id (find it in Supabase:
-- Authentication -> Users -> copy the UUID next to your email).
-- ============================================================

delete from main_tasks
where user_id = 'YOUR_USER_ID'
  and task_date >= current_date;
