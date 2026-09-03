"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { playVictoryBeep } from "@/lib/audio";
import type { DbMainTask, DbSubTask } from "@/lib/roadmap/generate-today";

interface OpenSessionInfo {
  subTaskId: string;
  startedAt: string;
}

interface Props {
  initialMainTasks: DbMainTask[];
  initialOpenSession: OpenSessionInfo | null;
}

// Find each Main Task's current sub-task: the first one in sequence
// order that isn't completed yet. Sub-tasks are strictly linear, so
// this is the only one that's ever eligible to run.
function currentSubTask(mt: DbMainTask): DbSubTask | null {
  return mt.sub_tasks.find((st) => st.status !== "completed") ?? null;
}

function fmtClock(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n: number) => n.toString().padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${pad(m)}:${pad(sec)}`;
}

export default function DashboardClient({
  initialMainTasks,
  initialOpenSession,
}: Props) {
  const supabase = useMemo(() => createClient(), []);

  const [mainTasks, setMainTasks] = useState<DbMainTask[]>(initialMainTasks);
  const [activeSubTaskId, setActiveSubTaskId] = useState<string | null>(
    initialOpenSession?.subTaskId ?? null
  );
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessionStartedAt, setSessionStartedAt] = useState<Date | null>(
    initialOpenSession ? new Date(initialOpenSession.startedAt) : null
  );
  const [tick, setTick] = useState(0); // forces a re-render every second
  const [breakNotice, setBreakNotice] = useState<string | null>(null);
  const busyRef = useRef(false); // guards against double-fires on auto-advance

  // Recover the open session's row id (needed to close it later).
  useEffect(() => {
    if (!initialOpenSession) return;
    (async () => {
      const { data } = await supabase
        .from("timer_sessions")
        .select("id")
        .eq("sub_task_id", initialOpenSession.subTaskId)
        .is("ended_at", null)
        .order("started_at", { ascending: false })
        .limit(1)
        .single();
      if (data) setSessionId(data.id);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The 1-second heartbeat that drives every live percentage on screen.
  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  function liveElapsedFor(st: DbSubTask): number {
    let elapsed = st.completed_seconds;
    if (st.id === activeSubTaskId && sessionStartedAt) {
      elapsed += (Date.now() - sessionStartedAt.getTime()) / 1000;
    }
    return elapsed;
  }

  function findMainTaskOf(subTaskId: string): DbMainTask | null {
    return mainTasks.find((mt) => mt.sub_tasks.some((s) => s.id === subTaskId)) ?? null;
  }

  async function closeSession(atSeconds: number) {
    if (!sessionId || !activeSubTaskId) return;
    const startedAt = sessionStartedAt ?? new Date();
    const endedAt = new Date(startedAt.getTime() + atSeconds * 1000);
    await supabase
      .from("timer_sessions")
      .update({ ended_at: endedAt.toISOString() })
      .eq("id", sessionId);
  }

  async function persistSubTaskProgress(
    subTaskId: string,
    completedSeconds: number,
    status: DbSubTask["status"]
  ) {
    await supabase
      .from("sub_tasks")
      .update({
        completed_seconds: completedSeconds,
        status,
        completed_at: status === "completed" ? new Date().toISOString() : null,
      })
      .eq("id", subTaskId);
  }

  function updateLocalSubTask(subTaskId: string, patch: Partial<DbSubTask>) {
    setMainTasks((prev) =>
      prev.map((mt) => ({
        ...mt,
        sub_tasks: mt.sub_tasks.map((st) =>
          st.id === subTaskId ? { ...st, ...patch } : st
        ),
      }))
    );
  }

  async function handlePause() {
    if (!activeSubTaskId) return;
    const mt = findMainTaskOf(activeSubTaskId);
    const st = mt?.sub_tasks.find((s) => s.id === activeSubTaskId);
    if (!st) return;

    const elapsed = liveElapsedFor(st);
    await closeSession(elapsed - st.completed_seconds);
    await persistSubTaskProgress(st.id, elapsed, "pending");
    updateLocalSubTask(st.id, { completed_seconds: elapsed, status: "pending" });

    setActiveSubTaskId(null);
    setSessionId(null);
    setSessionStartedAt(null);
  }

  async function handleStart(subTaskId: string) {
    if (busyRef.current) return;
    // Only one timer runs at a time — pause whatever's running first.
    if (activeSubTaskId && activeSubTaskId !== subTaskId) {
      await handlePause();
    }

    const startedAt = new Date();
    const { data } = await supabase
      .from("timer_sessions")
      .insert({ user_id: (await supabase.auth.getUser()).data.user?.id, sub_task_id: subTaskId, started_at: startedAt.toISOString() })
      .select()
      .single();

    await supabase.from("sub_tasks").update({ status: "active" }).eq("id", subTaskId);
    updateLocalSubTask(subTaskId, { status: "active" });

    setActiveSubTaskId(subTaskId);
    setSessionId(data?.id ?? null);
    setSessionStartedAt(startedAt);
    setBreakNotice(null);
  }

  // Auto-advance: when the active sub-task's live elapsed time reaches
  // its planned duration, close it out, play the cue, and — if there's
  // a next sub-task in this Main Task — start it immediately.
  useEffect(() => {
    if (!activeSubTaskId || busyRef.current) return;
    const mt = findMainTaskOf(activeSubTaskId);
    const st = mt?.sub_tasks.find((s) => s.id === activeSubTaskId);
    if (!mt || !st) return;

    const elapsed = liveElapsedFor(st);
    if (elapsed < st.planned_seconds) return;

    busyRef.current = true;
    (async () => {
      await closeSession(st.planned_seconds - st.completed_seconds);
      await persistSubTaskProgress(st.id, st.planned_seconds, "completed");
      updateLocalSubTask(st.id, {
        completed_seconds: st.planned_seconds,
        status: "completed",
      });
      playVictoryBeep();

      // Clear the just-closed session's state BEFORE looking for a next
      // sub-task. handleStart() only re-pauses whatever activeSubTaskId
      // currently points to — if we leave it pointing at the sub-task we
      // just completed, handleStart would try to close that same session
      // a second time and could revert it back to "pending".
      setActiveSubTaskId(null);
      setSessionId(null);
      setSessionStartedAt(null);

      const next = mt.sub_tasks
        .filter((s) => s.id !== st.id)
        .find((s) => s.sequence > st.sequence && s.status !== "completed");

      if (next) {
        setBreakNotice("Take a break? or let it continue");
        await handleStart(next.id);
      }
      busyRef.current = false;
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick, activeSubTaskId]);

  // ---- Derived numbers for rendering ----
  const dayTotals = mainTasks.reduce(
    (acc, mt) => {
      const planned = mt.sub_tasks.reduce((s, st) => s + st.planned_seconds, 0);
      const done = mt.sub_tasks.reduce((s, st) => s + liveElapsedFor(st), 0);
      return { planned: acc.planned + planned, done: acc.done + done };
    },
    { planned: 0, done: 0 }
  );
  const dayPercent =
    dayTotals.planned > 0
      ? Math.min(100, Math.round((dayTotals.done / dayTotals.planned) * 100))
      : 0;

  const activeSt =
    activeSubTaskId != null
      ? mainTasks.flatMap((m) => m.sub_tasks).find((s) => s.id === activeSubTaskId)
      : null;

  return (
    <div>
      {/* Persistent top notification bar — Start/Pause + live % of active task */}
      <div className="timer-bar">
        <div className="timer-bar-daily">
          <div className="mini-vessel">
            <div className="mini-vessel-fill" style={{ height: `${dayPercent}%` }} />
          </div>
          <span>{dayPercent}% today</span>
        </div>

        {activeSt ? (
          <div className="timer-bar-active">
            <span className="timer-bar-title">{activeSt.title}</span>
            <span className="timer-bar-clock">
              {fmtClock(liveElapsedFor(activeSt))} / {fmtClock(activeSt.planned_seconds)}
            </span>
            <button className="timer-bar-btn" onClick={handlePause}>
              Pause
            </button>
          </div>
        ) : (
          <span className="timer-bar-idle">No task running</span>
        )}
      </div>

      {breakNotice && (
        <div className="break-notice">
          {breakNotice}
          <span style={{ display: "flex", gap: 8 }}>
            <button
              onClick={async () => {
                await handlePause();
                setBreakNotice(null);
              }}
            >
              Take a break
            </button>
            <button onClick={() => setBreakNotice(null)}>
              Let it continue
            </button>
          </span>
        </div>
      )}

      <div className="task-grid">
        {mainTasks.map((mt) => {
          const planned = mt.sub_tasks.reduce((s, st) => s + st.planned_seconds, 0);
          const done = mt.sub_tasks.reduce((s, st) => s + liveElapsedFor(st), 0);
          const pct = planned > 0 ? Math.min(100, Math.round((done / planned) * 100)) : 0;
          const complete = pct >= 100;
          const current = currentSubTask(mt);

          return (
            <div
              key={mt.id}
              className={`main-task-box${complete ? " main-task-box--complete" : ""}`}
              style={{ flexGrow: Math.max(mt.time_share, 0.05) }}
            >
              <div className="main-task-head">
                <h3>{mt.title}</h3>
                <span className="main-task-pct">{pct}%</span>
              </div>

              <div className="main-task-line">
                <div className="main-task-line-fill" style={{ width: `${pct}%` }} />
              </div>

              <ul className="sub-task-list">
                {mt.sub_tasks.map((st) => {
                  const isCurrent = current?.id === st.id;
                  const isActive = st.id === activeSubTaskId;
                  return (
                    <li
                      key={st.id}
                      className={`sub-task${
                        st.status === "completed" ? " sub-task--done" : ""
                      }${isActive ? " sub-task--active" : ""}`}
                    >
                      <span>{st.title}</span>
                      <span className="sub-task-right">
                        {st.status === "completed" ? (
                          "done"
                        ) : isCurrent ? (
                          isActive ? (
                            <span className="sub-task-live">
                              {fmtClock(liveElapsedFor(st))}
                            </span>
                          ) : (
                            <button
                              className="sub-task-start"
                              onClick={() => handleStart(st.id)}
                            >
                              Start
                            </button>
                          )
                        ) : (
                          <span className="sub-task-locked">queued</span>
                        )}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </div>
    </div>
  );
}
