export type DayKey = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";

export interface RoadmapSubTaskDef {
  source_key: string;
  title: string;
  sequence: number;
  planned_minutes: number;
  active_only_if?: "exam_week" | "phase.weekly_contest_active";
  difficulty_from_phase?: boolean;
  focus_from_phase?: boolean;
}

export interface RoadmapMainTaskDef {
  source_key: string;
  title: string;
  schedule_type: "daily" | "weekly_pattern";
  sub_tasks?: RoadmapSubTaskDef[]; // used when schedule_type === "daily"
  weekly_schedule?: Partial<Record<DayKey, RoadmapSubTaskDef[]>>; // used when weekly_pattern
  day_sits_out_if_empty?: boolean;
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
