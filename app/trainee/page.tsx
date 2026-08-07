import {
  CalendarDays,
  Clock3,
  Dumbbell,
  ExternalLink,
  Footprints,
  ListChecks,
  PlayCircle
} from "lucide-react";
import { ActivityThumbnail } from "@/components/activities/activity-thumbnail";
import { ActivityMetrics } from "@/components/activities/activity-metrics";
import { ActivityCompletedToast } from "@/components/activities/activity-completed-toast";
import { PageHeader } from "@/components/dashboard/page-header";
import { StatCard } from "@/components/dashboard/stat-card";
import { ExerciseThumb } from "@/components/exercises/exercise-thumb";
import { ActivityActions } from "@/components/trainee/activity-actions";
import { WorkoutRoutineActions } from "@/components/trainee/workout-routine-actions";
import { Table, Td, Th } from "@/components/ui/table";
import {
  ACTIVITY_METRIC_KEYS,
  activityMetricValuesFromLog,
  formatActivityMetricResult,
  parseActivityTargets
} from "@/lib/activities";
import { getTraineeOrRedirect } from "@/lib/trainee";
import { formatDate } from "@/lib/utils";
import type { RoutinePdfData } from "@/types/routine-pdf";

type PageProps = {
  searchParams?: Promise<{ activityCompleted?: string }>;
};

export default async function TraineeDashboardPage({ searchParams }: PageProps) {
  const activityCompleted = (await searchParams)?.activityCompleted;
  const { supabase, client } = await getTraineeOrRedirect();
  const [
    { data: routineAssignments },
    { data: activityAssignments },
    { data: workoutLogs, count: workoutCount },
    { data: activityLogs, count: activityCount },
    { data: progress }
  ] = await Promise.all([
    supabase
      .from("client_routines")
      .select("id, status, assigned_at, notes, workout_routines(id, name, description, routine_type, default_cycles, routine_exercises(position, sets, reps, rest_seconds, notes, exercises(name, category, difficulty, thumbnail_url, video_url, equipment)))")
      .eq("client_id", client.id)
      .eq("status", "active")
      .order("assigned_at", { ascending: false }),
    supabase
      .from("client_activities")
      .select("id, status, assigned_at, notes, assignment_mode, planned_for, tracked_metrics, required_metrics, targets, activities(id, name, description, thumbnail_url)")
      .eq("client_id", client.id)
      .eq("status", "active")
      .order("planned_for", { ascending: true, nullsFirst: false }),
    supabase
      .from("workout_logs")
      .select("id, trained_on, created_at, notes, duration_minutes, workout_routines(name)", { count: "exact" })
      .eq("client_id", client.id)
      .order("trained_on", { ascending: false })
      .limit(8),
    supabase
      .from("activity_logs")
      .select("id, performed_on, created_at, notes, duration_minutes, distance_km, elevation_gain_m, calories_burned, perceived_intensity, activities(name), client_activities(targets)", { count: "exact" })
      .eq("client_id", client.id)
      .order("performed_on", { ascending: false })
      .limit(8),
    supabase
      .from("body_progress_entries")
      .select("*")
      .eq("client_id", client.id)
      .order("recorded_on", { ascending: false })
      .limit(8)
  ]);

  const latestProgress = progress?.[0];
  const today = new Date().toISOString().slice(0, 10);
  const history = [
    ...(workoutLogs ?? []).map((log) => {
      const routine = Array.isArray(log.workout_routines) ? log.workout_routines[0] : log.workout_routines;
      return {
        id: log.id,
        type: "Workout" as const,
        date: log.trained_on,
        createdAt: log.created_at,
        name: routine?.name ?? "Workout",
        notes: log.notes,
        results: log.duration_minutes ? `${log.duration_minutes} min` : "Completed"
      };
    }),
    ...(activityLogs ?? []).map((log) => {
      const activity = Array.isArray(log.activities) ? log.activities[0] : log.activities;
      const values = activityMetricValuesFromLog(log);
      const assignment = Array.isArray(log.client_activities) ? log.client_activities[0] : log.client_activities;
      const targets = parseActivityTargets(assignment?.targets ?? null);
      return {
        id: log.id,
        type: "Activity" as const,
        date: log.performed_on,
        createdAt: log.created_at,
        name: activity?.name ?? "Activity",
        notes: log.notes,
        results: ACTIVITY_METRIC_KEYS.flatMap((key) =>
          values[key] === undefined ? [] : [formatActivityMetricResult(key, values[key]!, targets)]
        ).join(" · ") || "Completed"
      };
    })
  ]
    .sort((a, b) => `${b.date}-${b.createdAt}`.localeCompare(`${a.date}-${a.createdAt}`))
    .slice(0, 8);

  return (
    <>
      {activityCompleted ? <ActivityCompletedToast activityName={activityCompleted} /> : null}
      <PageHeader title={`Welcome, ${client.name}`} description={client.goal ?? "Your coach has not set a goal yet."} />
      {!client.invitation_accepted_at ? (
        <div className="mb-4 rounded-md border border-info/40 bg-info/5 px-4 py-3 text-sm text-info shadow-soft">Finish account setup when you are ready to keep your login secure.</div>
      ) : null}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Active routines" value={routineAssignments?.length ?? 0} />
        <StatCard label="Active Activities" value={activityAssignments?.length ?? 0} />
        <StatCard label="Completed sessions" value={(workoutCount ?? 0) + (activityCount ?? 0)} detail="Workouts and Activities" />
        <StatCard label="Latest weight" value={latestProgress ? `${latestProgress.body_weight} kg` : "No data"} detail={latestProgress ? formatDate(latestProgress.recorded_on) : "Ask your coach to add an entry"} />
      </section>

      <section className="mt-8">
        <div className="mb-4">
          <h2 className="text-xl font-semibold">Your Activities</h2>
          <p className="mt-1 text-sm text-muted-foreground">Log measurable training outside an exercise-based Routine.</p>
        </div>
        <div className="grid gap-5 lg:grid-cols-2">
          {(activityAssignments ?? []).map((assignment) => {
            const activity = Array.isArray(assignment.activities) ? assignment.activities[0] : assignment.activities;
            if (!activity) return null;
            const targets = parseActivityTargets(assignment.targets);
            return (
              <article key={assignment.id} className="overflow-hidden rounded-xl border bg-card shadow-soft">
                <div className="p-4 sm:p-5">
                  <ActivityThumbnail src={activity.thumbnail_url} alt={`${activity.name} reference`} className="mb-4 max-h-60 w-full" />
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className="text-lg font-semibold">{activity.name}</h3>
                      <p className="mt-1 text-sm text-muted-foreground">{activity.description ?? "Record this Activity when completed."}</p>
                    </div>
                    <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
                      {assignment.assignment_mode === "one_time" ? "One-time" : "Repeatable"}
                    </span>
                  </div>
                  {assignment.planned_for ? (
                    <p className="mt-3 flex items-center gap-2 text-sm font-medium"><CalendarDays className="h-4 w-4 text-primary" aria-hidden="true" />Planned for {formatDate(assignment.planned_for)}</p>
                  ) : null}
                  {assignment.notes ? <div className="mt-4 rounded-lg bg-muted/60 px-3 py-2 text-sm"><span className="font-medium">Coach note:</span> {assignment.notes}</div> : null}
                  <ActivityMetrics className="mt-4" trackedMetrics={assignment.tracked_metrics} requiredMetrics={assignment.required_metrics} targets={targets} />
                </div>
                <ActivityActions assignmentId={assignment.id} activityName={activity.name} trackedMetrics={assignment.tracked_metrics} requiredMetrics={assignment.required_metrics} targets={targets} today={today} />
              </article>
            );
          })}
          {!activityAssignments?.length ? (
            <div className="rounded-xl border border-dashed bg-card p-8 text-center shadow-soft lg:col-span-2">
              <Footprints className="mx-auto h-8 w-8 text-muted-foreground" aria-hidden="true" />
              <p className="mt-3 font-medium">No Activities assigned</p>
              <p className="mt-1 text-sm text-muted-foreground">Measurable Activities assigned by your coach will appear here.</p>
            </div>
          ) : null}
        </div>
      </section>

      <section className="mt-8">
        <div className="mb-4">
          <h2 className="text-xl font-semibold">Your routines</h2>
          <p className="mt-1 text-sm text-muted-foreground">Preview or begin an exercise-based workout.</p>
        </div>
        <div className="grid gap-5">
          {(routineAssignments ?? []).map((assignment) => {
            const routine = Array.isArray(assignment.workout_routines) ? assignment.workout_routines[0] : assignment.workout_routines;
            const exercises = [...(routine?.routine_exercises ?? [])].sort((a, b) => a.position - b.position);
            const pdfRoutine: RoutinePdfData | undefined = routine ? {
              traineeName: client.name,
              routineName: routine.name,
              routineDescription: routine.description,
              assignmentNotes: assignment.notes,
              routineType: routine.routine_type,
              defaultCycles: routine.default_cycles,
              exercises: exercises.flatMap((item) => {
                const exercise = Array.isArray(item.exercises) ? item.exercises[0] : item.exercises;
                return exercise ? [{ name: exercise.name, category: exercise.category, equipment: exercise.equipment, thumbnailUrl: exercise.thumbnail_url, sets: item.sets, reps: item.reps, restSeconds: item.rest_seconds, notes: item.notes }] : [];
              })
            } : undefined;

            return (
              <article key={assignment.id} className="overflow-hidden rounded-xl border bg-card shadow-soft">
                <div className="p-4 sm:p-5">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <h3 className="text-lg font-semibold">{routine?.name ?? "Routine"}</h3>
                      <p className="mt-2 max-w-3xl text-sm text-muted-foreground">{routine?.description ?? "Follow the exercises below in order."}</p>
                    </div>
                    <div className="flex shrink-0 flex-wrap gap-2 text-xs text-muted-foreground">
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1.5"><ListChecks className="h-3.5 w-3.5" aria-hidden="true" />{exercises.length} {exercises.length === 1 ? "exercise" : "exercises"}</span>
                      {routine?.routine_type === "circuit" ? <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1.5"><Dumbbell className="h-3.5 w-3.5" aria-hidden="true" />{routine.default_cycles} cycles</span> : null}
                    </div>
                  </div>
                  {assignment.notes ? <div className="mt-4 rounded-lg bg-muted/60 px-3 py-2 text-sm"><span className="font-medium">Coach note:</span> {assignment.notes}</div> : null}
                </div>
                <WorkoutRoutineActions assignmentId={assignment.id} canBegin={Boolean(routine) && exercises.length > 0} pdfRoutine={pdfRoutine}>
                  <div className="p-4 sm:p-5">
                    <h4 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Workout plan</h4>
                    <ol className="grid gap-3">
                      {exercises.map((item, index) => {
                        const exercise = Array.isArray(item.exercises) ? item.exercises[0] : item.exercises;
                        return (
                          <li key={`${assignment.id}-${item.position}`} className="grid gap-3 rounded-lg border p-3 sm:grid-cols-[2rem_6rem_minmax(0,1fr)_auto] sm:items-center sm:gap-4">
                            <span className="hidden h-8 w-8 items-center justify-center rounded-full bg-muted text-sm font-semibold text-muted-foreground sm:flex">{index + 1}</span>
                            <ExerciseThumb src={exercise?.thumbnail_url} alt={exercise?.name ?? "Exercise"} className="h-36 w-full sm:h-16 sm:w-24" />
                            <div className="min-w-0">
                              <p className="font-medium">{exercise?.name ?? "Exercise"}</p>
                              <p className="mt-1 text-xs text-muted-foreground">{[exercise?.category, exercise?.equipment].filter(Boolean).join(" · ") || "No equipment details"}</p>
                              {item.notes ? <p className="mt-2 text-sm text-muted-foreground">{item.notes}</p> : null}
                            </div>
                            <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center">
                              {routine?.routine_type === "gym" ? <div className="rounded-md bg-muted/60 px-3 py-2 text-center"><p className="text-[0.65rem] font-semibold uppercase text-muted-foreground">Sets</p><p className="text-sm font-semibold">{item.sets}</p></div> : null}
                              <div className="rounded-md bg-muted/60 px-3 py-2 text-center"><p className="text-[0.65rem] font-semibold uppercase text-muted-foreground">Reps</p><p className="text-sm font-semibold">{item.reps}</p></div>
                              <div className="rounded-md bg-muted/60 px-3 py-2 text-center"><p className="flex items-center gap-1 text-[0.65rem] font-semibold uppercase text-muted-foreground"><Clock3 className="h-3 w-3" aria-hidden="true" />Rest</p><p className="text-sm font-semibold">{item.rest_seconds ? `${item.rest_seconds}s` : "—"}</p></div>
                              {exercise?.video_url ? <a className="col-span-2 inline-flex h-10 items-center justify-center gap-2 rounded-md border px-3 text-sm font-medium text-primary hover:bg-muted" href={exercise.video_url} target="_blank" rel="noreferrer"><PlayCircle className="h-4 w-4" aria-hidden="true" />Demo<ExternalLink className="h-3 w-3" aria-hidden="true" /></a> : null}
                            </div>
                          </li>
                        );
                      })}
                      {!exercises.length ? <li className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">Your coach has not added exercises to this routine yet.</li> : null}
                    </ol>
                  </div>
                </WorkoutRoutineActions>
              </article>
            );
          })}
          {!routineAssignments?.length ? <div className="rounded-xl border border-dashed bg-card p-8 text-center shadow-soft"><Dumbbell className="mx-auto h-8 w-8 text-muted-foreground" aria-hidden="true" /><p className="mt-3 font-medium">No routines assigned yet</p><p className="mt-1 text-sm text-muted-foreground">Your coach will add exercise-based workouts here.</p></div> : null}
        </div>
      </section>

      <section className="mt-8 grid gap-6 lg:grid-cols-2">
        <div className="min-w-0">
          <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold"><CalendarDays className="h-5 w-5 text-primary" aria-hidden="true" />Recent training</h2>
          <Table>
            <thead><tr><Th>Date</Th><Th>Type</Th><Th>Session</Th><Th>Results</Th></tr></thead>
            <tbody>
              {history.map((item) => <tr key={`${item.type}-${item.id}`}><Td>{formatDate(item.date)}</Td><Td>{item.type}</Td><Td><span className="font-medium">{item.name}</span>{item.notes ? <p className="mt-1 text-xs text-muted-foreground">{item.notes}</p> : null}</Td><Td>{item.results}</Td></tr>)}
              {!history.length ? <tr><Td colSpan={4}>No completed training logged yet.</Td></tr> : null}
            </tbody>
          </Table>
        </div>
        <div className="min-w-0">
          <h2 className="mb-3 text-lg font-semibold">Body progress</h2>
          <Table>
            <thead><tr><Th>Date</Th><Th>Weight</Th><Th>Body fat</Th><Th>Waist</Th></tr></thead>
            <tbody>
              {progress?.map((entry) => <tr key={entry.id}><Td>{formatDate(entry.recorded_on)}</Td><Td>{entry.body_weight} kg</Td><Td>{entry.body_fat_percentage !== null ? `${entry.body_fat_percentage}%` : "Not set"}</Td><Td>{entry.waist !== null ? `${entry.waist} cm` : "Not set"}</Td></tr>)}
              {!progress?.length ? <tr><Td colSpan={4}>No body progress entries yet.</Td></tr> : null}
            </tbody>
          </Table>
        </div>
      </section>
    </>
  );
}
