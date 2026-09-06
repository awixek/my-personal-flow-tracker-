import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ensureTodayTasks } from "@/lib/roadmap/generate-today";
import { ensureCatchUpState } from "@/lib/roadmap/catchup";
import SignOutButton from "./sign-out-button";
import DashboardClient from "./dashboard-client";

function todayIso(): string {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
    .toISOString()
    .slice(0, 10);
}

export default async function DashboardPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const mainTasks = await ensureTodayTasks(supabase, user.id);

  const { data: profile } = await supabase
    .from("profiles")
    .select("roadmap_start_date, exam_week")
    .eq("id", user.id)
    .single();

  const catchUpTarget = profile?.roadmap_start_date
    ? await ensureCatchUpState(supabase, user.id, profile.roadmap_start_date, todayIso())
    : null;

  // Restore any timer session left running (e.g. page was refreshed).
  const { data: openSessions } = await supabase
    .from("timer_sessions")
    .select("*")
    .eq("user_id", user.id)
    .is("ended_at", null)
    .order("started_at", { ascending: false })
    .limit(1);

  const openSession = openSessions?.[0] ?? null;

  return (
    <div className="dash-shell">
      <div className="dash-top">
        <span className="who">{user.email}</span>
        <div className="dash-top-actions">
          <Link href="/profile" className="profile-link">
            Profile
          </Link>
          <SignOutButton />
        </div>
      </div>
      <DashboardClient
        initialMainTasks={mainTasks}
        initialOpenSession={
          openSession
            ? { subTaskId: openSession.sub_task_id, startedAt: openSession.started_at }
            : null
        }
        userId={user.id}
        initialExamWeek={profile?.exam_week ?? false}
        initialCatchUp={
          catchUpTarget
            ? {
                id: catchUpTarget.id,
                shortfallDate: catchUpTarget.shortfallDate,
                shortfallSeconds: catchUpTarget.shortfallSeconds,
                resolvedSeconds: catchUpTarget.resolvedSeconds,
                activeStartedAt: catchUpTarget.activeStartedAt,
              }
            : null
        }
      />
    </div>
  );
}
