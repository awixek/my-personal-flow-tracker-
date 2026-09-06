import type { SupabaseClient } from "@supabase/supabase-js";

function addDays(iso: string, days: number): string {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function weekStartIso(iso: string): string {
  const d = new Date(iso + "T00:00:00Z");
  return addDays(iso, -d.getUTCDay()); // preceding Sunday
}

export interface CatchUpTarget {
  id: string;
  shortfallDate: string;
  shortfallSeconds: number;
  resolvedSeconds: number;
  activeStartedAt: string | null;
}

async function getDayTotals(
  supabase: SupabaseClient,
  userId: string,
  dateIso: string
): Promise<{ planned: number; completed: number }> {
  const { data: mainTasks } = await supabase
    .from("main_tasks")
    .select("id, planned_seconds")
    .eq("user_id", userId)
    .eq("task_date", dateIso);

  if (!mainTasks || mainTasks.length === 0) return { planned: 0, completed: 0 };

  const planned = mainTasks.reduce((s, m) => s + m.planned_seconds, 0);

  const { data: subTasks } = await supabase
    .from("sub_tasks")
    .select("completed_seconds")
    .eq("user_id", userId)
    .in(
      "main_task_id",
      mainTasks.map((m) => m.id)
    );

  const completed = (subTasks ?? []).reduce((s, st) => s + st.completed_seconds, 0);
  return { planned, completed };
}

/**
 * Runs the weekly catch-up bookkeeping (§9 of the blueprint):
 *  1. Any unresolved shortfall from a week before the current one is
 *     permanently locked.
 *  2. Every past day within the current week (that has no catch_up_log
 *     row yet) gets checked: if it fell short of its own planned time,
 *     a shortfall row is recorded.
 *  3. Returns the oldest still-open shortfall for this week (FIFO), or
 *     null if there's nothing to catch up on.
 * Cheap to call on every dashboard load — it only ever looks at the
 * current week's date range (at most 7 days), never the full history.
 */
export async function ensureCatchUpState(
  supabase: SupabaseClient,
  userId: string,
  roadmapStartDateIso: string,
  todayIso: string
): Promise<CatchUpTarget | null> {
  const currentWeekStart = weekStartIso(todayIso);

  await supabase
    .from("catch_up_log")
    .update({ locked: true })
    .eq("user_id", userId)
    .lt("week_start_date", currentWeekStart)
    .eq("locked", false);

  const backfillFrom =
    roadmapStartDateIso > currentWeekStart ? roadmapStartDateIso : currentWeekStart;

  let cursor = backfillFrom;
  while (cursor < todayIso) {
    const { data: existingRow } = await supabase
      .from("catch_up_log")
      .select("id")
      .eq("user_id", userId)
      .eq("shortfall_date", cursor)
      .maybeSingle();

    if (!existingRow) {
      const totals = await getDayTotals(supabase, userId, cursor);
      const shortfall = totals.planned - totals.completed;
      if (totals.planned > 0 && shortfall > 0) {
        await supabase.from("catch_up_log").insert({
          user_id: userId,
          shortfall_date: cursor,
          shortfall_seconds: Math.round(shortfall),
          week_start_date: currentWeekStart,
          resolved_seconds: 0,
          locked: false,
        });
      }
    }
    cursor = addDays(cursor, 1);
  }

  const { data: rows } = await supabase
    .from("catch_up_log")
    .select("id, shortfall_date, shortfall_seconds, resolved_seconds, active_started_at")
    .eq("user_id", userId)
    .eq("week_start_date", currentWeekStart)
    .eq("locked", false)
    .order("shortfall_date", { ascending: true });

  const target = (rows ?? []).find((r) => r.resolved_seconds < r.shortfall_seconds);
  if (!target) return null;

  return {
    id: target.id,
    shortfallDate: target.shortfall_date,
    shortfallSeconds: target.shortfall_seconds,
    resolvedSeconds: target.resolved_seconds,
    activeStartedAt: target.active_started_at,
  };
}
