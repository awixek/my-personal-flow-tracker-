export type DayKey = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";

export interface RoadmapSubTaskDef {
  source_key: string;
  title: string;
  sequence: number;
  planned_minutes: number;
  active_only_if?:
    | "exam_week"
    | "phase.weekly_contest_active"
    | "ds_month6"
    | "phase_gte_2";
  difficulty_from_phase?: boolean;
  focus_from_phase?: boolean;
}

export interface RoadmapMainTaskDef {
  source_key: string;
  title: string;
  schedule_type: "daily" | "weekly_pattern" | "date_map";
  sub_tasks?: RoadmapSubTaskDef[]; // used when schedule_type === "daily"
  weekly_schedule?: Partial<Record<DayKey, RoadmapSubTaskDef[]>>; // used when weekly_pattern
  date_schedule?: Record<string, RoadmapSubTaskDef[]>; // used when date_map — keyed by ISO yyyy-mm-dd
  day_sits_out_if_empty?: boolean;
  starts_on?: string; // ISO yyyy-mm-dd — this Main Task doesn't exist before this date
  notes?: string;
}

export interface RoadmapPhase {
  phase: number;
  duration_label: string;
  iitm_level: string;
  dsa_focus: string;
  dsa_difficulty: string;
  ds_focus: string;
  milestone: string;
  weekly_contest_active: boolean;
}

export interface RoadmapConfig {
  roadmap_name: string;
  description: string;
  version: string;
  phase_reference_start?: string; // ISO yyyy-mm-dd — phase/months-elapsed math anchors here, not profiles.roadmap_start_date
  phases: RoadmapPhase[];
  main_tasks: RoadmapMainTaskDef[];
}

// A single resolved sub-task instance, ready to insert as a DB row.
export interface ResolvedSubTask {
  source_key: string;
  title: string;
  sequence: number;
  planned_seconds: number;
}

// A single resolved Main Task instance for one calendar day.
export interface ResolvedMainTask {
  source_key: string;
  title: string;
  planned_seconds: number;
  time_share: number;
  sub_tasks: ResolvedSubTask[];
}
