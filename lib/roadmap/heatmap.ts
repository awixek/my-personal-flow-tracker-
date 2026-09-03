export interface DayTotal {
  planned: number;
  completed: number;
}

export interface HeatmapCell {
  date: string; // ISO yyyy-mm-dd
  pct: number; // 0-100
}

export type HeatmapColumn = (HeatmapCell | null)[]; // 7 entries, Sun -> Sat; null = don't render a box

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function addDays(d: Date, days: number): Date {
  const copy = new Date(d.getTime());
  copy.setUTCDate(copy.getUTCDate() + days);
  return copy;
}

/**
 * Builds the GitHub-style grid: one column per week, 7 rows (Sun->Sat).
 * A cell is `null` (no box rendered) for any date before roadmap_start_date
 * or after today, per the blueprint's rule. A date within range that has no
 * recorded activity defaults to 0% (an empty box), not a missing box --
 * only the pre-start/future range gets skipped entirely.
 */
export function buildHeatmapWeeks(
  startDateIso: string,
  todayIso: string,
  totalsByDate: Record<string, DayTotal>
): HeatmapColumn[] {
  const startDate = new Date(startDateIso + "T00:00:00Z");
  const today = new Date(todayIso + "T00:00:00Z");

  const weekStart = addDays(startDate, -startDate.getUTCDay()); // preceding Sunday
  const totalDays = Math.round((today.getTime() - weekStart.getTime()) / 86400000) + 1;
  const numWeeks = Math.ceil(totalDays / 7);

  const weeks: HeatmapColumn[] = [];
  for (let w = 0; w < numWeeks; w++) {
    const col: HeatmapColumn = [];
    for (let d = 0; d < 7; d++) {
      const date = addDays(weekStart, w * 7 + d);
      if (date < startDate || date > today) {
        col.push(null);
        continue;
      }
      const iso = isoDate(date);
      const totals = totalsByDate[iso];
      const pct =
        totals && totals.planned > 0
          ? Math.min(100, Math.round((totals.completed / totals.planned) * 100))
          : 0;
      col.push({ date: iso, pct });
    }
    weeks.push(col);
  }
  return weeks;
}
