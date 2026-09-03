import type { SupabaseClient } from "@supabase/supabase-js";
import roadmapData from "./roadmap.json";
import { dayKeyFor, monthsElapsed, resolvePhase } from "./phase";
import type {
  RoadmapConfig,
  ResolvedMainTask,
  ResolvedSubTask,
} from "./types";

const roadmap = roadmapData as unknown as RoadmapConfig;

function todayDateOnly(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * Expands roadmap.json into today's Main Tasks + Sub-tasks for one user,
 * following the rules in the roadmap file:
 *  - "daily" main tasks use the same sub_tasks every day
 *  - "weekly_pattern" main tasks look up today's day-of-week
 *  - sub-tasks gated by active_only_if are dropped unless their
 *    condition holds (exam_week is not wired up yet -> always false;
 *    phase.weekly_contest_active comes from the resolved phase)
 *  - a main task with day_sits_out_if_empty and zero resolved sub-tasks
 *    that day is skipped entirely (no box, doesn't count toward the
 *    day's planned time)
 *  - time_share is computed as this task's planned seconds / the day's
 *    total planned seconds across all included main tasks
 */
function resolveToday(startDate: Date, today: Date): ResolvedMainTask[] {
  const dayKey = dayKeyFor(today);
  const monthsIn = monthsElapsed(startDate, today);
  const phase = resolvePhase(roadmap, monthsIn);

  const included: { source_key: string; title: string; subs: ResolvedSubTask[] }[] = [];

  for (const mainTask of roadmap.main_tasks) {
    const defs =
      mainTask.schedule_type === "daily"
        ? mainTask.sub_tasks ?? []
        : mainTask.weekly_schedule?.[dayKey] ?? [];

    const activeDefs = defs.filter((d) => {
      if (!d.active_only_if) return true;
      if (d.active_only_if === "exam_week") return false; // not wired up yet
      if (d.active_only_if === "phase.weekly_contest_active") {
        return phase.weekly_contest_active;
      }
      return true;
    });

    if (activeDefs.length === 0 && mainTask.day_sits_out_if_empty) {
      continue; // sits out entirely, per the roadmap's own rule
    }
    if (activeDefs.length === 0) continue; // nothing to schedule regardless

    const subs: ResolvedSubTask[] = activeDefs.map((d) => ({
      source_key: d.source_key,
      title: d.title,
      sequence: d.sequence,
      planned_seconds: d.planned_minutes * 60,
    }));

    included.push({ source_key: mainTask.source_key, title: mainTask.title, subs });
  }

  const totalPlanned = included.reduce(
    (sum, t) => sum + t.subs.reduce((s, st) => s + st.planned_seconds, 0),
    0
  );

  return included.map((t) => {
    const plannedSeconds = t.subs.reduce((s, st) => s + st.planned_seconds, 0);
    return {
      source_key: t.source_key,
      title: t.title,
      planned_seconds: plannedSeconds,
      time_share: totalPlanned > 0 ? plannedSeconds / totalPlanned : 0,
      sub_tasks: t.subs,
    };
  });
}

export interface DbSubTask {
  id: string;
  source_key: string;
  title: string;
  sequence: number;
  planned_seconds: number;
  completed_seconds: number;
  status: "pending" | "active" | "completed";
}

export interface DbMainTask {
  id: string;
  source_key: string;
  title: string;
  planned_seconds: number;
  time_share: number;
  sort_order: number;
  sub_tasks: DbSubTask[];
}

/**
 * Idempotent: if today's rows already exist for this user, just returns
 * them. Otherwise generates and inserts them first. Never overwrites an
 * existing row's progress.
 */
export async function ensureTodayTasks(
  supabase: SupabaseClient,
  userId: string
): Promise<DbMainTask[]> {
  const today = todayDateOnly();
  const taskDate = isoDate(today);

  // Make sure roadmap_start_date is set (first-ever dashboard load).
  const { data: profile } = await supabase
    .from("profiles")
    .select("roadmap_start_date")
    .eq("id", userId)
    .single();

  let startDate = today;
  if (profile?.roadmap_start_date) {
    startDate = new Date(profile.roadmap_start_date + "T00:00:00Z");
  } else {
    await supabase
      .from("profiles")
      .update({ roadmap_start_date: taskDate })
      .eq("id", userId);
  }

  const existing = await fetchTasksForDate(supabase, userId, taskDate);
  if (existing.length > 0) return existing;

  const resolved = resolveToday(startDate, today);

  for (let i = 0; i < resolved.length; i++) {
    const mt = resolved[i];
    const { data: mainTaskRow, error: mtError } = await supabase
      .from("main_tasks")
      .insert({
        user_id: userId,
        task_date: taskDate,
        source_key: mt.source_key,
        title: mt.title,
        planned_seconds: mt.planned_seconds,
        time_share: mt.time_share,
        sort_order: i,
      })
      .select()
      .single();

    if (mtError || !mainTaskRow) continue;

    const subRows = mt.sub_tasks.map((st) => ({
      main_task_id: mainTaskRow.id,
      user_id: userId,
      source_key: st.source_key,
      title: st.title,
      planned_seconds: st.planned_seconds,
      sequence: st.sequence,
    }));

    if (subRows.length > 0) {
      await supabase.from("sub_tasks").insert(subRows);
    }
  }

  return fetchTasksForDate(supabase, userId, taskDate);
}

export async function fetchTasksForDate(
  supabase: SupabaseClient,
  userId: string,
  taskDate: string
): Promise<DbMainTask[]> {
  const { data: mainTasks } = await supabase
    .from("main_tasks")
    .select("*")
    .eq("user_id", userId)
    .eq("task_date", taskDate)
    .order("sort_order", { ascending: true });

  if (!mainTasks || mainTasks.length === 0) return [];

  const { data: subTasks } = await supabase
    .from("sub_tasks")
    .select("*")
    .eq("user_id", userId)
    .in(
      "main_task_id",
      mainTasks.map((m) => m.id)
    )
    .order("sequence", { ascending: true });

  return mainTasks.map((mt) => ({
    ...mt,
    sub_tasks: (subTasks ?? []).filter((st) => st.main_task_id === mt.id),
  }));
}
