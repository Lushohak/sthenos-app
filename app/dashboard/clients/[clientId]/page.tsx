import { PendingLink as Link } from "@/components/ui/pending-link";
import { notFound } from "next/navigation";
import { ManageActivityAssignments } from "@/components/activities/manage-activity-assignments";
import { ActivityCompletedToast } from "@/components/activities/activity-completed-toast";
import { ArchiveClient } from "@/components/clients/archive-client";
import {
  ClientProgressDialog,
  ClientTrainingAssignmentDialog,
  ClientTrainingLogDialog,
  type LoggableActivityAssignment
} from "@/components/clients/client-workspace-actions";
import { ClientInviteStatus } from "@/components/clients/client-invite-status";
import { ClientWorkspaceNav } from "@/components/clients/client-workspace-nav";
import { DeleteClientAccount } from "@/components/clients/delete-client-account";
import { ManageRoutineAssignments } from "@/components/clients/manage-routine-assignments";
import { PageHeader } from "@/components/dashboard/page-header";
import { StatCard } from "@/components/dashboard/stat-card";
import { TraineeInviteForm } from "@/components/forms/trainee-invite-form";
import {
  ActivityResultsChart,
  BodyProgressChart,
  TrainingTrendChart
} from "@/components/progress/analytics-charts";
import { ProgressRangeSelector } from "@/components/progress/progress-range-selector";
import { TrainingSchedule } from "@/components/schedule/training-schedule";
import { LinkButton } from "@/components/ui/button";
import { Table, Td, Th } from "@/components/ui/table";
import {
  ACTIVITY_METRIC_KEYS,
  activityMetricValuesFromLog,
  formatActivityMetricResult,
  parseActivityTargets,
  summarizeActivityLogs,
  type ActivityMetricKey
} from "@/lib/activities";
import { getUserOrRedirect } from "@/lib/auth";
import {
  clientWorkspaceHref,
  parseClientWorkspaceTab
} from "@/lib/client-workspace";
import { calculateAge, formatClientGender } from "@/lib/client-profile";
import type { ScheduledLogOption } from "@/lib/client-roster";
import {
  createTrainingBuckets,
  filterActivityMetricPoints,
  filterBodyProgressPoints,
  parseProgressRange,
  progressRangeLabel,
  type ActivityMetricPoint,
  type BodyProgressPoint,
  type TrainingLogPoint
} from "@/lib/progress-analytics";
import { formatDate } from "@/lib/utils";
import { loadTrainingSchedule } from "@/lib/training-schedule-data";
import { todayInTimezone } from "@/lib/training-schedule";
import type { Database } from "@/types/database";

type Routine = Database["public"]["Tables"]["workout_routines"]["Row"];
type ActivityTemplate = Database["public"]["Tables"]["activities"]["Row"];
type ClientRoutine = Database["public"]["Tables"]["client_routines"]["Row"];
type ClientActivity = Database["public"]["Tables"]["client_activities"]["Row"];
type WorkoutLog = Database["public"]["Tables"]["workout_logs"]["Row"];
type ActivityLog = Database["public"]["Tables"]["activity_logs"]["Row"];
type ProgressEntry = Database["public"]["Tables"]["body_progress_entries"]["Row"];

type RoutineRelation = Pick<Routine, "id" | "name" | "archived_at">;
type ActivityRelation = Pick<ActivityTemplate, "id" | "name" | "archived_at" | "tracked_metrics" | "required_metrics" | "default_targets">;
type RoutineAssignment = ClientRoutine & { workout_routines: RoutineRelation | RoutineRelation[] | null };
type ActivityAssignment = ClientActivity & { activities: ActivityRelation | ActivityRelation[] | null };
type RelatedWorkoutLog = WorkoutLog & { workout_routines: Pick<Routine, "name"> | Pick<Routine, "name">[] | null };
type RelatedActivityLog = ActivityLog & {
  activities: Pick<ActivityTemplate, "name"> | Pick<ActivityTemplate, "name">[] | null;
  client_activities: Pick<ClientActivity, "targets"> | Pick<ClientActivity, "targets">[] | null;
};

type PageProps = {
  params: Promise<{ clientId: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function firstValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function relation<T>(value: T | T[] | null | undefined) {
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

function trainingHistoryItems(logs: RelatedWorkoutLog[], activityLogs: RelatedActivityLog[]) {
  return [
    ...logs.map((log) => ({
      id: log.id,
      type: "Workout",
      date: log.trained_on,
      name: relation(log.workout_routines)?.name ?? "Workout",
      results: log.duration_minutes ? `${log.duration_minutes} min` : "Completed",
      notes: log.notes
    })),
    ...activityLogs.map((log) => {
      const values = activityMetricValuesFromLog(log);
      const targets = parseActivityTargets(relation(log.client_activities)?.targets ?? null);
      return {
        id: log.id,
        type: "Activity",
        date: log.performed_on,
        name: relation(log.activities)?.name ?? "Activity",
        results: ACTIVITY_METRIC_KEYS.flatMap((key) =>
          values[key] === undefined ? [] : [formatActivityMetricResult(key, values[key]!, targets)]
        ).join(" · ") || "Completed",
        notes: log.notes
      };
    })
  ].sort((a, b) => b.date.localeCompare(a.date));
}

export default async function ClientProfilePage({ params, searchParams }: PageProps) {
  const { clientId } = await params;
  const resolvedSearchParams = await searchParams;
  const activeTab = parseClientWorkspaceTab(resolvedSearchParams?.tab);
  const inviteStatus = firstValue(resolvedSearchParams?.invite);
  const activityCompleted = firstValue(resolvedSearchParams?.activityCompleted);
  const requestedScheduleDate = firstValue(resolvedSearchParams?.date);
  const range = parseProgressRange(resolvedSearchParams?.range, "6m");
  const rangeLabel = progressRangeLabel(range);
  const { supabase, user } = await getUserOrRedirect();
  const today = new Date().toISOString().slice(0, 10);
  const thirtyDaysAgoDate = new Date();
  thirtyDaysAgoDate.setDate(thirtyDaysAgoDate.getDate() - 30);
  const thirtyDaysAgo = thirtyDaysAgoDate.toISOString().slice(0, 10);

  const { data: client, error: clientError } = await supabase
    .from("clients")
    .select("*")
    .eq("coach_id", user.id)
    .eq("id", clientId)
    .single();

  if (clientError || !client) notFound();

  let routines: Routine[] = [];
  let routineAssignments: RoutineAssignment[] = [];
  let activities: ActivityTemplate[] = [];
  let activityAssignments: ActivityAssignment[] = [];
  let workoutLogs: RelatedWorkoutLog[] = [];
  let activityLogs: RelatedActivityLog[] = [];
  let progressEntries: ProgressEntry[] = [];
  let accountAssignmentCount = 0;
  let scheduleData: Awaited<ReturnType<typeof loadTrainingSchedule>> | null = null;
  let scheduledLogSessions: ScheduledLogOption[] = [];
  let scheduleHistory: Array<{ id: string; title: string; scheduled_on: string; status: "skipped" | "missed"; skip_reason: string | null }> = [];

  if (activeTab === "schedule") {
    const focusDate = requestedScheduleDate && /^\d{4}-\d{2}-\d{2}$/.test(requestedScheduleDate)
      ? requestedScheduleDate
      : today;
    scheduleData = await loadTrainingSchedule(supabase, clientId, focusDate);
  }

  if (activeTab === "training") {
    const [routineResult, routineAssignmentResult, activityResult, activityAssignmentResult] = await Promise.all([
      supabase.from("workout_routines").select("*").eq("coach_id", user.id).eq("status", "published").is("archived_at", null).order("name"),
      supabase.from("client_routines").select("*, workout_routines(id, name, archived_at)").eq("coach_id", user.id).eq("client_id", clientId).in("status", ["active", "paused"]).order("assigned_at", { ascending: false }),
      supabase.from("activities").select("*").eq("coach_id", user.id).is("archived_at", null).order("name"),
      supabase.from("client_activities").select("*, activities(id, name, archived_at, tracked_metrics, required_metrics, default_targets)").eq("coach_id", user.id).eq("client_id", clientId).in("status", ["active", "paused"]).order("assigned_at", { ascending: false })
    ]);
    if (routineResult.error) throw new Error(routineResult.error.message);
    if (routineAssignmentResult.error) throw new Error(routineAssignmentResult.error.message);
    if (activityResult.error) throw new Error(activityResult.error.message);
    if (activityAssignmentResult.error) throw new Error(activityAssignmentResult.error.message);
    routines = routineResult.data ?? [];
    routineAssignments = (routineAssignmentResult.data ?? []) as unknown as RoutineAssignment[];
    activities = activityResult.data ?? [];
    activityAssignments = (activityAssignmentResult.data ?? []) as unknown as ActivityAssignment[];
  }

  if (activeTab === "overview") {
    const [routineAssignmentResult, activityAssignmentResult, workoutResult, activityLogResult, progressResult] = await Promise.all([
      supabase.from("client_routines").select("status").eq("coach_id", user.id).eq("client_id", clientId).in("status", ["active", "paused"]),
      supabase.from("client_activities").select("status").eq("coach_id", user.id).eq("client_id", clientId).in("status", ["active", "paused"]),
      supabase.from("workout_logs").select("*, workout_routines(name)").eq("coach_id", user.id).eq("client_id", clientId).gte("trained_on", thirtyDaysAgo).order("trained_on", { ascending: false }),
      supabase.from("activity_logs").select("*, activities(name), client_activities(targets)").eq("coach_id", user.id).eq("client_id", clientId).gte("performed_on", thirtyDaysAgo).order("performed_on", { ascending: false }),
      supabase.from("body_progress_entries").select("*").eq("coach_id", user.id).eq("client_id", clientId).order("recorded_on", { ascending: false }).limit(1)
    ]);
    routineAssignments = (routineAssignmentResult.data ?? []) as unknown as RoutineAssignment[];
    activityAssignments = (activityAssignmentResult.data ?? []) as unknown as ActivityAssignment[];
    workoutLogs = (workoutResult.data ?? []) as unknown as RelatedWorkoutLog[];
    activityLogs = (activityLogResult.data ?? []) as unknown as RelatedActivityLog[];
    progressEntries = progressResult.data ?? [];
  }

  if (activeTab === "progress") {
    const [workoutResult, activityLogResult, progressResult] = await Promise.all([
      supabase.from("workout_logs").select("*").eq("coach_id", user.id).eq("client_id", clientId).order("trained_on", { ascending: false }),
      supabase.from("activity_logs").select("*, activities(name), client_activities(targets)").eq("coach_id", user.id).eq("client_id", clientId).order("performed_on", { ascending: false }),
      supabase.from("body_progress_entries").select("*").eq("coach_id", user.id).eq("client_id", clientId).order("recorded_on", { ascending: false })
    ]);
    workoutLogs = (workoutResult.data ?? []) as unknown as RelatedWorkoutLog[];
    activityLogs = (activityLogResult.data ?? []) as unknown as RelatedActivityLog[];
    progressEntries = progressResult.data ?? [];
  }

  if (activeTab === "history") {
    await supabase.rpc("refresh_training_schedule_occurrences");
    const [routineAssignmentResult, activityAssignmentResult, workoutResult, activityLogResult, scheduleResult] = await Promise.all([
      supabase.from("client_routines").select("*, workout_routines(id, name, archived_at)").eq("coach_id", user.id).eq("client_id", clientId).order("assigned_at", { ascending: false }),
      supabase.from("client_activities").select("*, activities(id, name, archived_at, tracked_metrics, required_metrics, default_targets)").eq("coach_id", user.id).eq("client_id", clientId).eq("status", "active").order("assigned_at", { ascending: false }),
      supabase.from("workout_logs").select("*, workout_routines(name)").eq("coach_id", user.id).eq("client_id", clientId).order("trained_on", { ascending: false }),
      supabase.from("activity_logs").select("*, activities(name), client_activities(targets)").eq("coach_id", user.id).eq("client_id", clientId).order("performed_on", { ascending: false }),
      supabase.from("training_schedule_occurrences").select("id, kind, scheduled_on, title, status, skip_reason, routine_assignment_id, activity_assignment_id").eq("client_id", clientId).lte("scheduled_on", today).in("status", ["planned", "missed", "skipped"]).order("scheduled_on", { ascending: false }).limit(50)
    ]);
    routineAssignments = (routineAssignmentResult.data ?? []) as unknown as RoutineAssignment[];
    activityAssignments = (activityAssignmentResult.data ?? []) as unknown as ActivityAssignment[];
    workoutLogs = (workoutResult.data ?? []) as unknown as RelatedWorkoutLog[];
    activityLogs = (activityLogResult.data ?? []) as unknown as RelatedActivityLog[];
    scheduledLogSessions = (scheduleResult.data ?? []).filter((item) => item.status === "planned" || item.status === "missed").map((item) => ({ id: item.id, kind: item.kind, scheduledOn: item.scheduled_on, title: item.title, routineAssignmentId: item.routine_assignment_id, activityAssignmentId: item.activity_assignment_id }));
    scheduleHistory = (scheduleResult.data ?? []).filter((item): item is typeof item & { status: "skipped" | "missed" } => item.status === "skipped" || item.status === "missed").map((item) => ({ id: item.id, title: item.title, scheduled_on: item.scheduled_on, status: item.status, skip_reason: item.skip_reason }));
  }

  if (activeTab === "account") {
    const [routineCountResult, activityCountResult] = await Promise.all([
      supabase.from("client_routines").select("id", { count: "exact", head: true }).eq("coach_id", user.id).eq("client_id", clientId),
      supabase.from("client_activities").select("id", { count: "exact", head: true }).eq("coach_id", user.id).eq("client_id", clientId)
    ]);
    accountAssignmentCount = (routineCountResult.count ?? 0) + (activityCountResult.count ?? 0);
  }

  const activeRoutineAssignments = routineAssignments.filter((assignment) => assignment.status === "active");
  const pausedRoutineAssignments = routineAssignments.filter((assignment) => assignment.status === "paused");
  const activeActivityAssignments = activityAssignments.filter((assignment) => assignment.status === "active");
  const pausedActivityAssignments = activityAssignments.filter((assignment) => assignment.status === "paused");
  const assignedRoutineIds = routineAssignments.map((assignment) => assignment.routine_id);
  const assignedActivityIds = activityAssignments.map((assignment) => assignment.activity_id);

  const manageableRoutines = routineAssignments.flatMap((assignment) => {
    const routine = relation(assignment.workout_routines);
    return routine ? [{ id: assignment.id, routineName: routine.name, status: assignment.status as "active" | "paused", routineArchived: Boolean(routine.archived_at), notes: assignment.notes }] : [];
  });
  const manageableActivities = activityAssignments.flatMap((assignment) => {
    const activity = relation(assignment.activities);
    return activity ? [{ id: assignment.id, activityName: activity.name, status: assignment.status as "active" | "paused", activityArchived: Boolean(activity.archived_at), notes: assignment.notes }] : [];
  });
  const normalizedRoutineAssignments = routineAssignments.map((assignment) => {
    const routine = relation(assignment.workout_routines);
    return routine ? { id: assignment.id, routineId: routine.id, routineName: routine.name } : null;
  }).filter((assignment): assignment is NonNullable<typeof assignment> => assignment !== null);
  const loggableActivities: LoggableActivityAssignment[] = activeActivityAssignments.flatMap((assignment) => {
    const activity = relation(assignment.activities);
    return activity ? [{
      id: assignment.id,
      activityName: activity.name,
      trackedMetrics: assignment.tracked_metrics as ActivityMetricKey[],
      requiredMetrics: assignment.required_metrics as ActivityMetricKey[],
      targets: assignment.targets
    }] : [];
  });
  const history = [
    ...trainingHistoryItems(workoutLogs, activityLogs),
    ...scheduleHistory.map((item) => ({ id: item.id, type: "Scheduled", date: item.scheduled_on, name: item.title, results: item.status === "missed" ? "Missed" : "Skipped", notes: item.skip_reason }))
  ].sort((a, b) => b.date.localeCompare(a.date));

  const trainingLogs: TrainingLogPoint[] = [
    ...workoutLogs.map((log) => ({ clientId: client.id, date: log.trained_on, type: "workout" as const })),
    ...activityLogs.map((log) => ({ clientId: client.id, date: log.performed_on, type: "activity" as const }))
  ];
  const trainingBuckets = createTrainingBuckets(trainingLogs, range, today);
  const bodyPoints = filterBodyProgressPoints(progressEntries.map<BodyProgressPoint>((entry) => ({
    date: entry.recorded_on,
    body_weight: Number(entry.body_weight),
    body_fat_percentage: entry.body_fat_percentage === null ? null : Number(entry.body_fat_percentage),
    muscle_mass_percentage: entry.muscle_mass_percentage === null ? null : Number(entry.muscle_mass_percentage),
    waist: entry.waist === null ? null : Number(entry.waist),
    chest: entry.chest === null ? null : Number(entry.chest),
    arms: entry.arms === null ? null : Number(entry.arms),
    legs: entry.legs === null ? null : Number(entry.legs)
  })), range, today);
  const activityMetricPoints = filterActivityMetricPoints(activityLogs.map<ActivityMetricPoint>((log) => ({
    id: log.id,
    activityId: log.activity_id,
    activityName: relation(log.activities)?.name ?? "Activity",
    date: log.performed_on,
    values: activityMetricValuesFromLog(log),
    targets: parseActivityTargets(relation(log.client_activities)?.targets ?? null)
  })), range, today);

  const trainingDialog = client.status !== "archived" ? (
    <ClientTrainingAssignmentDialog
      clientId={client.id}
      clientName={client.name}
      routines={routines}
      assignedRoutineIds={assignedRoutineIds}
      activities={activities}
      assignedActivityIds={assignedActivityIds}
      triggerLabel="Assign training"
    />
  ) : null;
  const editHref = `/dashboard/clients/${client.id}/edit?returnTo=${encodeURIComponent(clientWorkspaceHref(client.id, activeTab))}`;
  const headerAction = activeTab === "training"
    ? trainingDialog
    : activeTab === "schedule"
      ? null
    : activeTab === "progress" && client.status !== "archived"
      ? <ClientProgressDialog clientId={client.id} clientName={client.name} today={today} triggerLabel="Add measurement" />
      : activeTab === "history" && client.status !== "archived"
        ? <ClientTrainingLogDialog clientId={client.id} clientName={client.name} routineAssignments={normalizedRoutineAssignments} activityAssignments={loggableActivities} scheduledSessions={scheduledLogSessions} today={today} triggerLabel="Log training" />
        : <LinkButton href={editHref}>Edit client</LinkButton>;

  return (
    <>
      {activityCompleted ? <ActivityCompletedToast activityName={activityCompleted} /> : null}
      <PageHeader
        title={client.name}
        description={`${client.goal ?? "No goal set yet."} · ${client.status.charAt(0).toUpperCase()}${client.status.slice(1)}`}
        action={headerAction}
      />
      <ClientWorkspaceNav clientId={client.id} activeTab={activeTab} />

      {activeTab === "training" ? (
        <section aria-labelledby="training-plan-heading" className="grid gap-6">
          <div>
            <h2 id="training-plan-heading" className="text-xl font-semibold">Training plan</h2>
            <p className="mt-1 text-sm text-muted-foreground">Manage what appears in this trainee&apos;s active Routine and Activity lists.</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Active routines" value={activeRoutineAssignments.length} />
            <StatCard label="Paused routines" value={pausedRoutineAssignments.length} />
            <StatCard label="Active Activities" value={activeActivityAssignments.length} />
            <StatCard label="Paused Activities" value={pausedActivityAssignments.length} />
          </div>
          {client.status === "archived" ? (
            <div className="rounded-xl border border-info/30 bg-info/5 p-4 text-sm text-muted-foreground">Restore this client before changing assignments. Existing assignments remain visible below.</div>
          ) : null}
          <ManageRoutineAssignments
            clientId={client.id}
            clientName={client.name}
            assignments={manageableRoutines}
            action={client.status !== "archived" ? (
              <ClientTrainingAssignmentDialog clientId={client.id} clientName={client.name} routines={routines} assignedRoutineIds={assignedRoutineIds} activities={activities} assignedActivityIds={assignedActivityIds} initialMode="routine" triggerLabel="Assign routines" triggerVariant="secondary" triggerClassName="h-8 px-3" />
            ) : null}
          />
          <ManageActivityAssignments
            clientId={client.id}
            clientName={client.name}
            assignments={manageableActivities}
            action={client.status !== "archived" ? (
              <ClientTrainingAssignmentDialog clientId={client.id} clientName={client.name} routines={routines} assignedRoutineIds={assignedRoutineIds} activities={activities} assignedActivityIds={assignedActivityIds} initialMode="activity" triggerLabel="Assign Activity" triggerVariant="secondary" triggerClassName="h-8 px-3" />
            ) : null}
          />
        </section>
      ) : null}

      {activeTab === "schedule" && scheduleData ? (
        <TrainingSchedule
          client={{
            id: client.id,
            name: client.name,
            coachId: client.coach_id,
            status: client.status,
            timezone: client.timezone,
            timezoneConfirmedAt: client.timezone_confirmed_at,
            remindersEnabled: client.email_workout_reminders_enabled
          }}
          viewer={{
            id: user.id,
            role: "coach",
            coachName: typeof user.user_metadata.full_name === "string" ? user.user_metadata.full_name : "Coach"
          }}
          occurrences={scheduleData.occurrences}
          routines={scheduleData.routines}
          activities={scheduleData.activities}
          initialDate={requestedScheduleDate && /^\d{4}-\d{2}-\d{2}$/.test(requestedScheduleDate) ? requestedScheduleDate : today}
          localToday={todayInTimezone(client.timezone ?? "UTC")}
        />
      ) : null}

      {activeTab === "overview" ? (
        <section aria-labelledby="overview-heading" className="grid gap-6">
          <div>
            <h2 id="overview-heading" className="text-xl font-semibold">Overview</h2>
            <p className="mt-1 text-sm text-muted-foreground">A concise snapshot of the trainee&apos;s profile and recent coaching activity.</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Active routines" value={activeRoutineAssignments.length} detail="Current workout assignments" />
            <StatCard label="Active Activities" value={activeActivityAssignments.length} detail="Current Activity assignments" />
            <StatCard label="Training days" value={new Set(trainingLogs.map((log) => log.date)).size} detail="Last 30 days" />
            <StatCard label="Latest body weight" value={progressEntries[0] ? `${progressEntries[0].body_weight} kg` : "—"} detail={progressEntries[0] ? formatDate(progressEntries[0].recorded_on) : "No measurements yet"} />
          </div>
          <div className="grid gap-6 xl:grid-cols-[minmax(16rem,0.8fr)_minmax(0,1.2fr)]">
            <div className="rounded-xl border bg-card p-5 shadow-soft">
              <div className="flex items-center justify-between gap-3"><h3 className="font-semibold">Profile</h3><Link href={clientWorkspaceHref(client.id, "account")} className="text-sm font-medium text-info hover:text-info/80">View account</Link></div>
              <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2 xl:grid-cols-1">
                <div><dt className="text-muted-foreground">Email</dt><dd>{client.email ?? "Not set"}</dd></div>
                <div><dt className="text-muted-foreground">Age</dt><dd>{calculateAge(client.date_of_birth, client.age) ?? "Not set"}</dd></div>
                <div><dt className="text-muted-foreground">Goal</dt><dd>{client.goal ?? "Not set"}</dd></div>
                <div><dt className="text-muted-foreground">Status</dt><dd className="capitalize">{client.status}</dd></div>
              </dl>
            </div>
            <div className="rounded-xl border bg-card p-5 shadow-soft">
              <div className="flex items-center justify-between gap-3"><h3 className="font-semibold">Recent training</h3><Link href={clientWorkspaceHref(client.id, "history")} className="text-sm font-medium text-info hover:text-info/80">View history</Link></div>
              <div className="mt-4 grid gap-2">
                {history.slice(0, 5).map((item) => (
                  <div key={`${item.type}-${item.id}`} className="flex items-start justify-between gap-3 rounded-lg border bg-background-secondary p-3 text-sm">
                    <div><p className="font-medium">{item.name}</p><p className="text-xs text-muted-foreground">{item.type} · {item.results}</p></div>
                    <time className="shrink-0 text-xs text-muted-foreground">{formatDate(item.date)}</time>
                  </div>
                ))}
                {!history.length ? <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">No training completed in the last 30 days.</p> : null}
              </div>
            </div>
          </div>
          <div>
            <h3 className="mb-3 font-semibold">Activity insights · Last 30 days</h3>
            {(() => {
              const insights = summarizeActivityLogs(activityLogs);
              return <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
                <StatCard label="Activities" value={insights.completions} />
                {insights.durationMinutes ? <StatCard label="Duration" value={`${insights.durationMinutes} min`} /> : null}
                {insights.distanceKm ? <StatCard label="Distance" value={`${insights.distanceKm.toFixed(2)} km`} /> : null}
                {insights.elevationGainM ? <StatCard label="Elevation" value={`${insights.elevationGainM.toFixed(0)} m`} /> : null}
                {insights.caloriesBurned ? <StatCard label="Est. calories" value={`${insights.caloriesBurned} kcal`} /> : null}
                {insights.averageIntensity !== null ? <StatCard label="Average intensity" value={`${insights.averageIntensity.toFixed(1)}/10`} /> : null}
              </div>;
            })()}
          </div>
        </section>
      ) : null}

      {activeTab === "progress" ? (
        <section aria-labelledby="progress-heading" className="grid gap-6">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div><h2 id="progress-heading" className="text-xl font-semibold">Progress</h2><p className="mt-1 text-sm text-muted-foreground">Training and measurement trends · {rangeLabel}</p></div>
            <ProgressRangeSelector value={range} />
          </div>
          {client.status === "archived" ? <div className="rounded-xl border border-info/30 bg-info/5 p-4 text-sm text-muted-foreground">Progress remains available, but new measurements cannot be added while this client is archived.</div> : null}
          <div className="grid gap-6 xl:grid-cols-2">
            <TrainingTrendChart buckets={trainingBuckets} variant="days" title="Training consistency" description="Unique training days in each period; session counts remain available in History." />
            <BodyProgressChart points={bodyPoints} />
            <div className="xl:col-span-2"><ActivityResultsChart points={activityMetricPoints} /></div>
          </div>
          <div className="rounded-xl border bg-card p-4 shadow-soft sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="font-semibold">Measurement history</h3><p className="mt-1 text-sm text-muted-foreground">Body entries shared by the coach and trainee.</p></div>{client.status !== "archived" ? <ClientProgressDialog clientId={client.id} clientName={client.name} today={today} triggerLabel="Add measurement" triggerVariant="secondary" /> : null}</div>
            <div className="mt-4"><Table><thead><tr><Th>Date</Th><Th>Weight</Th><Th>Body fat</Th><Th>Muscle mass</Th><Th>Waist</Th><Th>Added by</Th></tr></thead><tbody>
              {progressEntries.map((entry) => <tr key={entry.id}><Td>{formatDate(entry.recorded_on)}</Td><Td>{entry.body_weight} kg</Td><Td>{entry.body_fat_percentage !== null ? `${entry.body_fat_percentage}%` : "Not set"}</Td><Td>{entry.muscle_mass_percentage !== null ? `${entry.muscle_mass_percentage}%` : "Not set"}</Td><Td>{entry.waist !== null ? `${entry.waist} cm` : "Not set"}</Td><Td>{entry.recorded_by === client.client_user_id ? "Trainee" : entry.recorded_by ? "Coach" : "Unknown"}</Td></tr>)}
              {!progressEntries.length ? <tr><Td colSpan={6}>No progress entries yet.</Td></tr> : null}
            </tbody></Table></div>
          </div>
        </section>
      ) : null}

      {activeTab === "history" ? (
        <section aria-labelledby="history-heading" className="grid gap-6">
          <div><h2 id="history-heading" className="text-xl font-semibold">Training history</h2><p className="mt-1 text-sm text-muted-foreground">Completed Routines and Activities in one chronological record.</p></div>
          {client.status === "archived" ? <div className="rounded-xl border border-info/30 bg-info/5 p-4 text-sm text-muted-foreground">History remains available, but new training cannot be logged while this client is archived.</div> : null}
          <div className="rounded-xl border bg-card p-4 shadow-soft sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-3"><h3 className="font-semibold">Sessions</h3>{client.status !== "archived" ? <ClientTrainingLogDialog clientId={client.id} clientName={client.name} routineAssignments={normalizedRoutineAssignments} activityAssignments={loggableActivities} scheduledSessions={scheduledLogSessions} today={today} triggerLabel="Log training" triggerVariant="secondary" /> : null}</div>
            <div className="mt-4"><Table><thead><tr><Th>Date</Th><Th>Type</Th><Th>Session</Th><Th>Results</Th><Th>Notes</Th></tr></thead><tbody>
              {history.slice(0, 10).map((item) => <tr key={`${item.type}-${item.id}`}><Td>{formatDate(item.date)}</Td><Td>{item.type}</Td><Td>{item.name}</Td><Td>{item.results}</Td><Td>{item.notes ?? "No notes"}</Td></tr>)}
              {!history.length ? <tr><Td colSpan={5}>No completed training yet.</Td></tr> : null}
            </tbody></Table></div>
          </div>
        </section>
      ) : null}

      {activeTab === "account" ? (
        <section aria-labelledby="account-heading" className="grid gap-6">
          <div><h2 id="account-heading" className="text-xl font-semibold">Account</h2><p className="mt-1 text-sm text-muted-foreground">Manage profile details, portal access, and client status.</p></div>
          <ClientInviteStatus status={inviteStatus} />
          {client.status !== "archived" ? <TraineeInviteForm clientId={client.id} clientUserId={client.client_user_id} email={client.email} invitedAt={client.invited_at} acceptedAt={client.invitation_accepted_at} /> : <div className="rounded-xl border border-info/30 bg-info/5 p-4 text-sm text-muted-foreground">Restore this client before sending account invitations.</div>}
          <div className="rounded-xl border bg-card p-5 shadow-soft">
            <div className="flex flex-wrap items-center justify-between gap-3"><h3 className="font-semibold">Profile details</h3><LinkButton href={editHref} variant="secondary">Edit client</LinkButton></div>
            <dl className="mt-5 grid gap-4 text-sm sm:grid-cols-2 xl:grid-cols-3">
              <div><dt className="text-muted-foreground">Email</dt><dd>{client.email ?? "Not set"}</dd></div>
              <div><dt className="text-muted-foreground">Age</dt><dd>{calculateAge(client.date_of_birth, client.age) ?? "Not set"}</dd></div>
              <div><dt className="text-muted-foreground">Date of birth</dt><dd>{client.date_of_birth ? formatDate(client.date_of_birth) : "Not set"}</dd></div>
              <div><dt className="text-muted-foreground">Gender</dt><dd>{formatClientGender(client.gender)}</dd></div>
              <div><dt className="text-muted-foreground">Height</dt><dd>{client.height_cm !== null ? `${client.height_cm} cm` : "Not set"}</dd></div>
              <div><dt className="text-muted-foreground">Status</dt><dd className="capitalize">{client.status}</dd></div>
              <div className="sm:col-span-2 xl:col-span-3"><dt className="text-muted-foreground">Notes</dt><dd>{client.notes ?? "No notes"}</dd></div>
            </dl>
          </div>
          <ArchiveClient clientId={client.id} clientName={client.name} isArchived={client.status === "archived"} assignmentCount={accountAssignmentCount} />
          <DeleteClientAccount clientId={client.id} clientName={client.name} hasLoginAccount={Boolean(client.client_user_id)} />
        </section>
      ) : null}
    </>
  );
}
