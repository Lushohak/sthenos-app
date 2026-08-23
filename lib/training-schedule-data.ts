import type { SupabaseClient } from "@supabase/supabase-js";
import { parseActivityTargets, type ActivityMetricKey } from "@/lib/activities";
import {
  addDateOnlyDays,
  startOfScheduleWeek,
  type ScheduleActivityOption,
  type ScheduleRoutineOption,
  type TrainingScheduleOccurrence
} from "@/lib/training-schedule";
import type { Database } from "@/types/database";

export async function loadTrainingSchedule(
  supabase: SupabaseClient<Database>,
  clientId: string,
  focusDate: string
) {
  await supabase.rpc("refresh_training_schedule_occurrences");
  const rangeStart = startOfScheduleWeek(focusDate);
  const rangeEnd = addDateOnlyDays(rangeStart, 55);
  const [occurrenceResult, routineResult, activityResult] = await Promise.all([
    supabase
      .from("training_schedule_occurrences")
      .select("*, training_schedule_series(starts_on, ends_on)")
      .eq("client_id", clientId)
      .gte("scheduled_on", rangeStart)
      .lte("scheduled_on", rangeEnd)
      .order("scheduled_on")
      .order("local_time"),
    supabase
      .from("client_routines")
      .select("id, status, workout_routines(name)")
      .eq("client_id", clientId)
      .in("status", ["active", "paused"]),
    supabase
      .from("client_activities")
      .select("id, status, tracked_metrics, required_metrics, targets, activities(name)")
      .eq("client_id", clientId)
      .in("status", ["active", "paused"])
  ]);

  if (occurrenceResult.error) throw new Error(occurrenceResult.error.message);
  if (routineResult.error) throw new Error(routineResult.error.message);
  if (activityResult.error) throw new Error(activityResult.error.message);

  const occurrences = (occurrenceResult.data ?? []).map((item) => {
    const series = Array.isArray(item.training_schedule_series)
      ? item.training_schedule_series[0]
      : item.training_schedule_series;
    return {
      id: item.id,
      seriesId: item.series_id,
      scheduledOn: item.scheduled_on,
      scheduledAt: item.scheduled_at,
      localTime: item.local_time,
      timezone: item.timezone,
      kind: item.kind,
      routineAssignmentId: item.routine_assignment_id,
      activityAssignmentId: item.activity_assignment_id,
      title: item.title,
      notes: item.notes,
      reminderEnabled: item.reminder_enabled,
      status: item.status,
      skipReason: item.skip_reason,
      createdBy: item.created_by,
      updatedBy: item.updated_by,
      isRecurring: Boolean(series && (!series.ends_on || series.ends_on !== series.starts_on))
    } satisfies TrainingScheduleOccurrence & { isRecurring: boolean };
  });

  const routines: ScheduleRoutineOption[] = (routineResult.data ?? []).flatMap((item) => {
    const routine = Array.isArray(item.workout_routines) ? item.workout_routines[0] : item.workout_routines;
    return routine ? [{ assignmentId: item.id, name: routine.name, status: item.status }] : [];
  });
  const activities: ScheduleActivityOption[] = (activityResult.data ?? []).flatMap((item) => {
    const activity = Array.isArray(item.activities) ? item.activities[0] : item.activities;
    return activity ? [{
      assignmentId: item.id,
      name: activity.name,
      status: item.status,
      trackedMetrics: item.tracked_metrics as ActivityMetricKey[],
      requiredMetrics: item.required_metrics as ActivityMetricKey[],
      targets: parseActivityTargets(item.targets)
    }] : [];
  });

  return { occurrences, routines, activities };
}
