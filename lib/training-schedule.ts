import type { ActivityMetricKey, ActivityTargets } from "@/lib/activities";
import type { Database } from "@/types/database";

export type TrainingScheduleKind = Database["public"]["Enums"]["training_schedule_kind"];
export type TrainingScheduleStatus = Database["public"]["Enums"]["training_schedule_status"];
export type ScheduleEditScope = "single" | "future";

export type ScheduleRoutineOption = {
  assignmentId: string;
  name: string;
  status: "active" | "paused" | "completed";
};

export type ScheduleActivityOption = {
  assignmentId: string;
  name: string;
  status: "active" | "paused" | "completed";
  trackedMetrics: ActivityMetricKey[];
  requiredMetrics: ActivityMetricKey[];
  targets: ActivityTargets;
};

export type TrainingScheduleOccurrence = {
  id: string;
  seriesId: string;
  scheduledOn: string;
  scheduledAt: string;
  localTime: string;
  timezone: string;
  kind: TrainingScheduleKind;
  routineAssignmentId: string | null;
  activityAssignmentId: string | null;
  title: string;
  notes: string | null;
  reminderEnabled: boolean;
  status: TrainingScheduleStatus;
  skipReason: string | null;
  createdBy: string;
  updatedBy: string;
};

export type TrainingScheduleActionState = {
  status: "idle" | "success" | "error";
  message: string;
};

export const initialTrainingScheduleActionState: TrainingScheduleActionState = {
  status: "idle",
  message: ""
};

export function parseDateOnly(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  return new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
}

export function dateOnlyValue(date: Date) {
  return date.toISOString().slice(0, 10);
}

export function addDateOnlyDays(value: string, days: number) {
  const date = parseDateOnly(value);
  if (!date) return value;
  date.setUTCDate(date.getUTCDate() + days);
  return dateOnlyValue(date);
}

export function startOfScheduleWeek(value: string) {
  const date = parseDateOnly(value) ?? new Date();
  const weekday = date.getUTCDay();
  date.setUTCDate(date.getUTCDate() - (weekday === 0 ? 6 : weekday - 1));
  return dateOnlyValue(date);
}

export function isoWeekday(value: string) {
  const weekday = parseDateOnly(value)?.getUTCDay() ?? 1;
  return weekday === 0 ? 7 : weekday;
}

export function todayInTimezone(timezone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

export function isValidTimezone(value: string) {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value }).format();
    return true;
  } catch {
    return false;
  }
}

export function formatScheduleTime(value: string) {
  const match = /^(\d{2}):(\d{2})/.exec(value);
  if (!match) return value;
  const date = new Date(Date.UTC(2000, 0, 1, Number(match[1]), Number(match[2])));
  return new Intl.DateTimeFormat("en", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "UTC"
  }).format(date);
}

export function effectiveScheduleStatus(
  occurrence: Pick<TrainingScheduleOccurrence, "status" | "scheduledOn">,
  localToday: string
): TrainingScheduleStatus {
  return occurrence.status === "planned" && occurrence.scheduledOn < localToday
    ? "missed"
    : occurrence.status;
}
