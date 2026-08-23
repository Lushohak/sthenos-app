"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  ACTIVITY_METRIC_KEYS,
  readActivityMetricValue,
  type ActivityMetricKey
} from "@/lib/activities";
import { createClient } from "@/lib/supabase/server";
import {
  addDateOnlyDays,
  isoWeekday,
  isValidTimezone,
  todayInTimezone,
  type ScheduleEditScope,
  type TrainingScheduleActionState,
  type TrainingScheduleKind
} from "@/lib/training-schedule";

function optionalString(formData: FormData, key: string) {
  const value = String(formData.get(key) ?? "").trim();
  return value || null;
}

function optionalNumber(formData: FormData, key: string) {
  const value = String(formData.get(key) ?? "").trim();
  return value ? Number(value) : null;
}

function scheduleError(message: string): TrainingScheduleActionState {
  return { status: "error", message };
}

function revalidateSchedule(clientId: string) {
  revalidatePath("/trainee/schedule");
  revalidatePath("/trainee");
  revalidatePath(`/dashboard/clients/${clientId}`);
  revalidatePath("/dashboard/clients");
  revalidatePath("/dashboard");
}

async function getScheduleActor(clientId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const { data: client, error } = await supabase
    .from("clients")
    .select("id, coach_id, client_user_id, status, timezone, timezone_confirmed_at, email_workout_reminders_enabled")
    .eq("id", clientId)
    .maybeSingle();
  if (error || !client || (client.coach_id !== user.id && client.client_user_id !== user.id)) {
    return null;
  }
  return { supabase, user, client };
}

async function scheduleContent(
  actor: NonNullable<Awaited<ReturnType<typeof getScheduleActor>>>,
  kind: TrainingScheduleKind,
  assignmentId: string | null,
  openTitle: string | null
) {
  if (kind === "routine" && assignmentId) {
    const { data } = await actor.supabase
      .from("client_routines")
      .select("id, workout_routines(name)")
      .eq("id", assignmentId)
      .eq("client_id", actor.client.id)
      .eq("coach_id", actor.client.coach_id)
      .eq("status", "active")
      .maybeSingle();
    const routine = Array.isArray(data?.workout_routines) ? data.workout_routines[0] : data?.workout_routines;
    if (!data || !routine) return null;
    return { title: routine.name, routineAssignmentId: data.id, activityAssignmentId: null };
  }
  if (kind === "activity" && assignmentId) {
    const { data } = await actor.supabase
      .from("client_activities")
      .select("id, activities(name)")
      .eq("id", assignmentId)
      .eq("client_id", actor.client.id)
      .eq("coach_id", actor.client.coach_id)
      .eq("status", "active")
      .maybeSingle();
    const activity = Array.isArray(data?.activities) ? data.activities[0] : data?.activities;
    if (!data || !activity) return null;
    return { title: activity.name, routineAssignmentId: null, activityAssignmentId: data.id };
  }
  if (kind === "open" && openTitle && openTitle.length <= 120) {
    return { title: openTitle, routineAssignmentId: null, activityAssignmentId: null };
  }
  return null;
}

export async function updateTrainingSchedulePreferencesAction(
  clientId: string,
  _previousState: TrainingScheduleActionState,
  formData: FormData
): Promise<TrainingScheduleActionState> {
  const actor = await getScheduleActor(clientId);
  if (!actor || actor.client.status === "archived") return scheduleError("This schedule is read-only.");
  const timezone = String(formData.get("timezone") ?? "").trim();
  if (!isValidTimezone(timezone)) return scheduleError("Choose a valid timezone.");

  const { error } = await actor.supabase.rpc("update_training_schedule_preferences", {
    target_client_id: clientId,
    target_timezone: timezone,
    target_reminders_enabled: formData.get("reminders_enabled") === "on"
  });
  if (error) return scheduleError(error.message);
  revalidateSchedule(clientId);
  return { status: "success", message: "Schedule preferences saved." };
}

export async function createTrainingScheduleAction(
  clientId: string,
  _previousState: TrainingScheduleActionState,
  formData: FormData
): Promise<TrainingScheduleActionState> {
  const actor = await getScheduleActor(clientId);
  if (!actor || actor.client.status === "archived") return scheduleError("This schedule is read-only.");
  if (!actor.client.timezone || !actor.client.timezone_confirmed_at) {
    return scheduleError("Confirm the trainee timezone before adding training.");
  }

  const scheduledOn = String(formData.get("scheduled_on") ?? "");
  const localTime = String(formData.get("local_time") ?? "");
  const kind = String(formData.get("kind") ?? "") as TrainingScheduleKind;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(scheduledOn) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(localTime)) {
    return scheduleError("Choose a valid date and time.");
  }
  if (scheduledOn < todayInTimezone(actor.client.timezone)) {
    return scheduleError("New sessions must be scheduled for today or later.");
  }
  if (!(["routine", "activity", "open"] as string[]).includes(kind)) {
    return scheduleError("Choose a training type.");
  }

  const content = await scheduleContent(
    actor,
    kind,
    optionalString(formData, "assignment_id"),
    optionalString(formData, "open_title")
  );
  if (!content) return scheduleError("Choose an active assignment or enter an open workout title.");

  const repeats = formData.get("repeat_weekly") === "on";
  const { error } = await actor.supabase.from("training_schedule_series").insert({
    coach_id: actor.client.coach_id,
    client_id: clientId,
    weekday: isoWeekday(scheduledOn),
    local_time: localTime,
    kind,
    routine_assignment_id: content.routineAssignmentId,
    activity_assignment_id: content.activityAssignmentId,
    open_title: kind === "open" ? content.title : null,
    notes: optionalString(formData, "notes"),
    reminder_enabled: formData.get("reminder_enabled") === "on",
    starts_on: scheduledOn,
    ends_on: repeats ? null : scheduledOn,
    created_by: actor.user.id,
    updated_by: actor.user.id
  });
  if (error) return scheduleError(error.message);
  revalidateSchedule(clientId);
  return { status: "success", message: repeats ? "Weekly training added." : "Training session added." };
}

export async function updateTrainingScheduleAction(
  clientId: string,
  occurrenceId: string,
  _previousState: TrainingScheduleActionState,
  formData: FormData
): Promise<TrainingScheduleActionState> {
  const actor = await getScheduleActor(clientId);
  if (!actor || actor.client.status === "archived" || !actor.client.timezone) return scheduleError("This schedule is read-only.");
  const { data: occurrence } = await actor.supabase
    .from("training_schedule_occurrences")
    .select("*, training_schedule_series(*)")
    .eq("id", occurrenceId)
    .eq("client_id", clientId)
    .maybeSingle();
  if (!occurrence || !["planned", "missed"].includes(occurrence.status)) return scheduleError("This session can no longer be edited.");

  const scheduledOn = String(formData.get("scheduled_on") ?? occurrence.scheduled_on);
  const localTime = String(formData.get("local_time") ?? occurrence.local_time).slice(0, 5);
  const kind = String(formData.get("kind") ?? occurrence.kind) as TrainingScheduleKind;
  const scope = formData.get("scope") === "future" ? "future" : "single" as ScheduleEditScope;
  const content = await scheduleContent(actor, kind, optionalString(formData, "assignment_id"), optionalString(formData, "open_title"));
  if (!content) return scheduleError("Choose an active assignment or enter an open workout title.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(scheduledOn) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(localTime)) return scheduleError("Choose a valid date and time.");

  const { data: scheduledAt, error: timeError } = await actor.supabase.rpc("resolve_training_schedule_time", {
    target_date: scheduledOn,
    target_time: localTime,
    target_timezone: actor.client.timezone
  });
  if (timeError || !scheduledAt) return scheduleError("We could not resolve that time in the trainee timezone.");
  const notes = optionalString(formData, "notes");
  const reminderEnabled = formData.get("reminder_enabled") === "on";

  if (scope === "single") {
    const { error } = await actor.supabase.from("training_schedule_occurrences").update({
      scheduled_on: scheduledOn,
      scheduled_at: scheduledAt,
      local_time: localTime,
      timezone: actor.client.timezone,
      kind,
      routine_assignment_id: content.routineAssignmentId,
      activity_assignment_id: content.activityAssignmentId,
      title: content.title,
      notes,
      reminder_enabled: reminderEnabled,
      updated_by: actor.user.id
    }).eq("id", occurrenceId).eq("client_id", clientId);
    if (error) return scheduleError(error.message);
  } else {
    const series = Array.isArray(occurrence.training_schedule_series)
      ? occurrence.training_schedule_series[0]
      : occurrence.training_schedule_series;
    if (!series) return scheduleError("The recurring schedule could not be found.");
    const oldEndsOn = series.ends_on;
    const replacementEnd = occurrence.scheduled_on <= series.starts_on
      ? occurrence.scheduled_on
      : addDateOnlyDays(occurrence.scheduled_on, -1);
    const { error: closeError } = await actor.supabase.from("training_schedule_series").update({
      ends_on: replacementEnd,
      updated_by: actor.user.id
    }).eq("id", series.id);
    if (closeError) return scheduleError(closeError.message);
    await actor.supabase.from("training_schedule_occurrences").update({
      status: "cancelled",
      updated_by: actor.user.id
    }).eq("series_id", series.id).gte("scheduled_on", occurrence.scheduled_on).in("status", ["planned", "missed"]);
    const { error: replacementError } = await actor.supabase.from("training_schedule_series").insert({
      coach_id: actor.client.coach_id,
      client_id: clientId,
      weekday: isoWeekday(scheduledOn),
      local_time: localTime,
      kind,
      routine_assignment_id: content.routineAssignmentId,
      activity_assignment_id: content.activityAssignmentId,
      open_title: kind === "open" ? content.title : null,
      notes,
      reminder_enabled: reminderEnabled,
      starts_on: scheduledOn,
      ends_on: oldEndsOn,
      created_by: actor.user.id,
      updated_by: actor.user.id
    });
    if (replacementError) return scheduleError(replacementError.message);
  }

  revalidateSchedule(clientId);
  return { status: "success", message: scope === "future" ? "This and future sessions were updated." : "Session updated." };
}

export async function setTrainingScheduleStatusAction(
  clientId: string,
  occurrenceId: string,
  nextStatus: "skipped" | "planned" | "cancelled",
  _previousState: TrainingScheduleActionState,
  formData: FormData
): Promise<TrainingScheduleActionState> {
  const actor = await getScheduleActor(clientId);
  if (!actor || actor.client.status === "archived") return scheduleError("This schedule is read-only.");
  const { data: occurrence } = await actor.supabase.from("training_schedule_occurrences")
    .select("id, series_id, scheduled_on, status, training_schedule_series(starts_on)")
    .eq("id", occurrenceId).eq("client_id", clientId).maybeSingle();
  if (!occurrence || occurrence.status === "completed") return scheduleError("This session can no longer be changed.");
  const scope = formData.get("scope") === "future" ? "future" : "single";

  if (nextStatus === "cancelled" && scope === "future") {
    const relation = Array.isArray(occurrence.training_schedule_series) ? occurrence.training_schedule_series[0] : occurrence.training_schedule_series;
    const endDate = relation && occurrence.scheduled_on > relation.starts_on
      ? addDateOnlyDays(occurrence.scheduled_on, -1)
      : occurrence.scheduled_on;
    const { error } = await actor.supabase.from("training_schedule_series")
      .update({ ends_on: endDate, updated_by: actor.user.id }).eq("id", occurrence.series_id);
    if (error) return scheduleError(error.message);
    await actor.supabase.from("training_schedule_occurrences").update({ status: "cancelled", updated_by: actor.user.id })
      .eq("series_id", occurrence.series_id).gte("scheduled_on", occurrence.scheduled_on).in("status", ["planned", "missed", "skipped"]);
  } else {
    const skipReason = nextStatus === "skipped" ? optionalString(formData, "skip_reason") : null;
    const status = nextStatus === "planned" && actor.client.timezone && occurrence.scheduled_on < todayInTimezone(actor.client.timezone)
      ? "missed"
      : nextStatus;
    const { error } = await actor.supabase.from("training_schedule_occurrences").update({
      status,
      skip_reason: skipReason,
      updated_by: actor.user.id
    }).eq("id", occurrenceId).eq("client_id", clientId);
    if (error) return scheduleError(error.message);
  }
  revalidateSchedule(clientId);
  return { status: "success", message: nextStatus === "skipped" ? "Session skipped." : nextStatus === "cancelled" ? "Session removed." : "Session restored." };
}

export async function completeScheduledWorkoutAction(
  clientId: string,
  occurrenceId: string,
  _previousState: TrainingScheduleActionState,
  formData: FormData
): Promise<TrainingScheduleActionState> {
  const actor = await getScheduleActor(clientId);
  if (!actor) return scheduleError("Scheduled session not found.");
  const duration = optionalNumber(formData, "duration_minutes");
  if (duration !== null && (!Number.isInteger(duration) || duration < 1 || duration > 1440)) return scheduleError("Duration must be between 1 and 1,440 minutes.");
  const { error } = await actor.supabase.rpc("complete_scheduled_workout", {
    target_occurrence_id: occurrenceId,
    target_duration_minutes: duration,
    target_notes: optionalString(formData, "notes")
  });
  if (error) return scheduleError(error.message);
  revalidateSchedule(clientId);
  return { status: "success", message: "Workout completed and added to training history." };
}

export async function completeScheduledActivityAction(
  clientId: string,
  occurrenceId: string,
  _previousState: TrainingScheduleActionState,
  formData: FormData
): Promise<TrainingScheduleActionState> {
  const actor = await getScheduleActor(clientId);
  if (!actor) return scheduleError("Scheduled session not found.");
  const { data: occurrence } = await actor.supabase.from("training_schedule_occurrences")
    .select("activity_assignment_id, client_activities(tracked_metrics, required_metrics)")
    .eq("id", occurrenceId).eq("client_id", clientId).maybeSingle();
  const assignment = Array.isArray(occurrence?.client_activities) ? occurrence.client_activities[0] : occurrence?.client_activities;
  if (!occurrence?.activity_assignment_id || !assignment) return scheduleError("This Activity assignment is unavailable.");

  try {
    const tracked = assignment.tracked_metrics as ActivityMetricKey[];
    const required = assignment.required_metrics as ActivityMetricKey[];
    const values = ACTIVITY_METRIC_KEYS.reduce<Partial<Record<ActivityMetricKey, number | null>>>((result, key) => {
      if (tracked.includes(key)) result[key] = readActivityMetricValue(formData, key, key);
      return result;
    }, {});
    const missing = required.find((key) => values[key] === null);
    if (missing) return scheduleError(`${missing.replaceAll("_", " ")} is required.`);
    const { error } = await actor.supabase.rpc("complete_scheduled_activity", {
      target_occurrence_id: occurrenceId,
      target_duration_minutes: values.duration_minutes ?? null,
      target_distance_km: values.distance_km ?? null,
      target_elevation_gain_m: values.elevation_gain_m ?? null,
      target_calories_burned: values.calories_burned ?? null,
      target_perceived_intensity: values.perceived_intensity ?? null,
      target_notes: optionalString(formData, "notes")
    });
    if (error) throw new Error(error.message);
  } catch (error) {
    return scheduleError(error instanceof Error ? error.message : "Unable to save Activity.");
  }
  revalidateSchedule(clientId);
  return { status: "success", message: "Activity completed and added to training history." };
}
