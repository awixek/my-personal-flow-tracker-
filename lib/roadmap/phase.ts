import type { DayKey, RoadmapConfig, RoadmapPhase } from "./types";

const DAY_KEYS: DayKey[] = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

export function dayKeyFor(date: Date): DayKey {
  return DAY_KEYS[date.getUTCDay()];
}

// Phase boundaries, in months elapsed since roadmap_start_date.
// ASSUMPTION: the brief's phase table has Phase 3 ("Yr 3-4.5") and
// Phase 4 ("Yr 4-4.5") overlapping, since Placement realistically runs
// alongside the tail of the Capstone phase. To keep phase resolution
// unambiguous, Phase 4 is treated as the final 6 months only, and
// Phase 3 as everything before that back to month 36. Adjust here if
// the real term calendar says otherwise.
const PHASE_BOUNDARIES_MONTHS = [
  { phase: 1, startMonth: 0 },
  { phase: 2, startMonth: 18 },
  { phase: 3, startMonth: 36 },
  { phase: 4, startMonth: 48 },
];

export function monthsElapsed(startDate: Date, today: Date): number {
  const msPerMonth = (365.25 / 12) * 24 * 60 * 60 * 1000;
  const diff = today.getTime() - startDate.getTime();
  return Math.max(0, Math.floor(diff / msPerMonth));
}

export function resolvePhase(
  roadmap: RoadmapConfig,
  monthsIn: number
): RoadmapPhase {
  let current = PHASE_BOUNDARIES_MONTHS[0];
  for (const boundary of PHASE_BOUNDARIES_MONTHS) {
    if (monthsIn >= boundary.startMonth) current = boundary;
  }
  const phase = roadmap.phases.find((p) => p.phase === current.phase);
  return phase ?? roadmap.phases[0];
}
