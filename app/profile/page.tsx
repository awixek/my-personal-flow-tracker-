import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { buildHeatmapWeeks, type DayTotal } from "@/lib/roadmap/heatmap";

function todayIso(): string {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
    .toISOString()
    .slice(0, 10);
}

function formatDDMMYYYY(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

const DAY_LABELS = ["S", "M", "T", "W", "T", "F", "S"];

export default async function ProfilePage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("roadmap_start_date")
    .eq("id", user.id)
    .single();

  const startDate = profile?.roadmap_start_date ?? todayIso();
  const today = todayIso();

  const { data: mainTasks } = await supabase
    .from("main_tasks")
    .select("id, task_date, planned_seconds")
    .eq("user_id", user.id);

  const { data: subTasks } = await supabase
    .from("sub_tasks")
    .select("main_task_id, completed_seconds")
    .eq("user_id", user.id);

  // main_task_id -> task_date, so a sub_task's completed time can be
  // attributed to the right day.
  const dateByMainTaskId: Record<string, string> = {};
  const totalsByDate: Record<string, DayTotal> = {};

  for (const mt of mainTasks ?? []) {
    dateByMainTaskId[mt.id] = mt.task_date;
    const bucket = (totalsByDate[mt.task_date] ??= { planned: 0, completed: 0 });
    bucket.planned += mt.planned_seconds;
  }

  let totalCompletedSecondsAllTime = 0;
  for (const st of subTasks ?? []) {
    totalCompletedSecondsAllTime += st.completed_seconds;
    const date = dateByMainTaskId[st.main_task_id];
    if (!date) continue;
    const bucket = (totalsByDate[date] ??= { planned: 0, completed: 0 });
    bucket.completed += st.completed_seconds;
  }

  const totalHours = (totalCompletedSecondsAllTime / 3600).toFixed(1);
  const weeks = buildHeatmapWeeks(startDate, today, totalsByDate);

  return (
    <div className="dash-shell">
      <div className="dash-top">
        <span className="who">{user.email}</span>
        <Link href="/dashboard" className="profile-link">
          Back to dashboard
        </Link>
      </div>

      <h1 className="heatmap-header">
        Total progress from {formatDDMMYYYY(startDate)} is {totalHours} hours
      </h1>

      <div className="heatmap-scroll">
        <div className="heatmap-daylabels">
          {DAY_LABELS.map((l, i) => (
            <span key={i} className="heatmap-daylabel">
              {l}
            </span>
          ))}
        </div>
        <div className="heatmap-grid">
          {weeks.map((col, wi) => (
            <div className="heatmap-col" key={wi}>
              {col.map((cell, di) =>
                cell ? (
                  <div
                    key={di}
                    className="heatmap-cell"
                    title={`${cell.date}: ${cell.pct}%`}
                  >
                    <div
                      className="heatmap-cell-fill"
                      style={{ height: `${cell.pct}%` }}
                    />
                  </div>
                ) : (
                  <div key={di} className="heatmap-cell heatmap-cell--blank" />
                )
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
