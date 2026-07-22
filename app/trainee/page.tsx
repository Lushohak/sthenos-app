import {
  CalendarDays,
  ChevronDown,
  Clock3,
  Dumbbell,
  ExternalLink,
  ListChecks,
  PlayCircle
} from "lucide-react";
import { PageHeader } from "@/components/dashboard/page-header";
import { StatCard } from "@/components/dashboard/stat-card";
import { ExerciseThumb } from "@/components/exercises/exercise-thumb";
import { CompleteWorkoutForm } from "@/components/trainee/complete-workout-form";
import { Table, Td, Th } from "@/components/ui/table";
import { getTraineeOrRedirect } from "@/lib/trainee";
import { formatDate } from "@/lib/utils";

export default async function TraineeDashboardPage() {
  const { supabase, client } = await getTraineeOrRedirect();
  const today = new Date().toISOString().slice(0, 10);

  const [
    { data: assignments },
    { data: logs, count: completedSessionCount },
    { data: progress }
  ] = await Promise.all([
    supabase
      .from("client_routines")
      .select(
        "id, status, assigned_at, notes, workout_routines(id, name, description, routine_type, default_cycles, routine_exercises(position, reps, rest_seconds, notes, exercises(name, category, difficulty, thumbnail_url, video_url, equipment)))"
      )
      .eq("client_id", client.id)
      .order("assigned_at", { ascending: false }),
    supabase
      .from("workout_logs")
      .select("id, trained_on, notes, workout_routines(name)", { count: "exact" })
      .eq("client_id", client.id)
      .order("trained_on", { ascending: false })
      .limit(8),
    supabase
      .from("body_progress_entries")
      .select("*")
      .eq("client_id", client.id)
      .order("recorded_on", { ascending: false })
      .limit(8)
  ]);

  const latestProgress = progress?.[0];
  const orderedAssignments = [...(assignments ?? [])].sort((a, b) => {
    if (a.status === b.status) return 0;
    if (a.status === "active") return -1;
    if (b.status === "active") return 1;
    return 0;
  });
  const activeRoutineCount = orderedAssignments.filter((item) => item.status === "active").length;

  return (
    <>
      <PageHeader
        title={`Welcome, ${client.name}`}
        description={client.goal ?? "Your coach has not set a goal yet."}
      />
      {!client.invitation_accepted_at ? (
        <div className="mb-4 rounded-md border border-primary/25 bg-white px-4 py-3 text-sm text-primary shadow-soft">
          Finish account setup when you are ready to keep your login secure.
        </div>
      ) : null}
      <section className="grid gap-4 md:grid-cols-3">
        <StatCard label="Active routines" value={activeRoutineCount} />
        <StatCard
          label="Completed sessions"
          value={completedSessionCount ?? 0}
          detail="All logged workouts"
        />
        <StatCard
          label="Latest weight"
          value={latestProgress ? `${latestProgress.body_weight} kg` : "No data"}
          detail={latestProgress ? formatDate(latestProgress.recorded_on) : "Ask your coach to add an entry"}
        />
      </section>

      <section className="mt-8">
        <div className="mb-4">
          <h2 className="text-xl font-semibold">Your routines</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Choose today&apos;s routine, follow the exercise order, then record the completed workout.
          </p>
        </div>
        <div className="grid gap-5">
          {orderedAssignments.map((assignment) => {
            const routine = Array.isArray(assignment.workout_routines)
              ? assignment.workout_routines[0]
              : assignment.workout_routines;
            const routineExercises = [...(routine?.routine_exercises ?? [])].sort(
              (a, b) => a.position - b.position
            );
            const isActive = assignment.status === "active";

            return (
              <details
                key={assignment.id}
                name="assigned-routines"
                className="group overflow-hidden rounded-xl border bg-white shadow-soft"
              >
                <summary className="cursor-pointer list-none p-4 outline-none transition hover:bg-muted/30 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary group-open:border-b sm:p-5 [&::-webkit-details-marker]:hidden">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-lg font-semibold">{routine?.name ?? "Routine"}</h3>
                        <span
                          className={
                            isActive
                              ? "rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary"
                              : "rounded-full bg-muted px-2.5 py-1 text-xs font-medium capitalize text-muted-foreground"
                          }
                        >
                          {assignment.status}
                        </span>
                      </div>
                      <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
                        {routine?.description ?? "Follow the exercises below in order."}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1.5">
                        <ListChecks className="h-3.5 w-3.5" aria-hidden="true" />
                        {routineExercises.length} {routineExercises.length === 1 ? "exercise" : "exercises"}
                      </span>
                      {routine?.routine_type === "circuit" ? (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1.5">
                          <Dumbbell className="h-3.5 w-3.5" aria-hidden="true" />
                          {routine.default_cycles} cycles
                        </span>
                      ) : null}
                      <span className="ml-auto inline-flex h-9 w-9 items-center justify-center rounded-full border bg-white text-foreground transition group-open:rotate-180 sm:ml-1">
                        <ChevronDown className="h-4 w-4" aria-hidden="true" />
                        <span className="sr-only">Toggle routine details</span>
                      </span>
                    </div>
                  </div>
                  {assignment.notes ? (
                    <div className="mt-4 rounded-lg bg-muted/60 px-3 py-2 text-sm">
                      <span className="font-medium">Coach note:</span> {assignment.notes}
                    </div>
                  ) : null}
                </summary>

                <div className="p-4 sm:p-5">
                  <h4 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                    Workout plan
                  </h4>
                  <ol className="grid gap-3">
                    {routineExercises.map((item, index) => {
                      const exercise = Array.isArray(item.exercises)
                        ? item.exercises[0]
                        : item.exercises;

                      return (
                        <li
                          key={`${assignment.id}-${item.position}`}
                          className="grid gap-3 rounded-lg border p-3 sm:grid-cols-[2rem_6rem_minmax(0,1fr)_auto] sm:items-center sm:gap-4"
                        >
                          <span className="hidden h-8 w-8 items-center justify-center rounded-full bg-muted text-sm font-semibold text-muted-foreground sm:flex">
                            {index + 1}
                          </span>
                          <ExerciseThumb
                            src={exercise?.thumbnail_url}
                            alt={exercise?.name ?? "Exercise"}
                            className="h-36 w-full sm:h-16 sm:w-24"
                          />
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground sm:hidden">
                                {index + 1}
                              </span>
                              <p className="font-medium">{exercise?.name ?? "Exercise"}</p>
                            </div>
                            <p className="mt-1 text-xs text-muted-foreground">
                              {[exercise?.category, exercise?.equipment]
                                .filter(Boolean)
                                .join(" · ") || "No equipment details"}
                            </p>
                            {item.notes ? (
                              <p className="mt-2 text-sm text-muted-foreground">{item.notes}</p>
                            ) : null}
                          </div>
                          <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center">
                            <div className="rounded-md bg-muted/60 px-3 py-2 text-center">
                              <p className="text-[0.65rem] font-semibold uppercase tracking-wide text-muted-foreground">Reps</p>
                              <p className="mt-0.5 text-sm font-semibold">{item.reps}</p>
                            </div>
                            <div className="rounded-md bg-muted/60 px-3 py-2 text-center">
                              <p className="flex items-center justify-center gap-1 text-[0.65rem] font-semibold uppercase tracking-wide text-muted-foreground">
                                <Clock3 className="h-3 w-3" aria-hidden="true" /> Rest
                              </p>
                              <p className="mt-0.5 text-sm font-semibold">
                                {item.rest_seconds ? `${item.rest_seconds}s` : "—"}
                              </p>
                            </div>
                            {exercise?.video_url ? (
                              <a
                                className="col-span-2 inline-flex h-10 items-center justify-center gap-2 rounded-md border px-3 text-sm font-medium text-primary transition hover:bg-muted sm:col-span-1"
                                href={exercise.video_url}
                                target="_blank"
                                rel="noreferrer"
                              >
                                <PlayCircle className="h-4 w-4" aria-hidden="true" />
                                Demo
                                <ExternalLink className="h-3 w-3" aria-hidden="true" />
                              </a>
                            ) : null}
                          </div>
                        </li>
                      );
                    })}
                    {!routineExercises.length ? (
                      <li className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                        Your coach has not added exercises to this routine yet.
                      </li>
                    ) : null}
                  </ol>
                </div>

                {isActive && routine ? (
                  <div className="border-t bg-muted/20 p-4 sm:p-5">
                    <CompleteWorkoutForm
                      routineId={routine.id}
                      routineName={routine.name}
                      today={today}
                    />
                  </div>
                ) : null}
              </details>
            );
          })}
          {!orderedAssignments.length ? (
            <div className="rounded-xl border border-dashed bg-white p-8 text-center shadow-soft">
              <Dumbbell className="mx-auto h-8 w-8 text-muted-foreground" aria-hidden="true" />
              <p className="mt-3 font-medium">No routines assigned yet</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Your coach will add your workout plan here.
              </p>
            </div>
          ) : null}
        </div>
      </section>

      <section className="mt-8 grid gap-6 lg:grid-cols-2">
        <div className="min-w-0">
          <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold">
            <CalendarDays className="h-5 w-5 text-primary" aria-hidden="true" />
            Completed workouts
          </h2>
          <div className="grid gap-3 md:hidden">
            {logs?.map((log) => {
              const routine = Array.isArray(log.workout_routines)
                ? log.workout_routines[0]
                : log.workout_routines;
              return (
                <article key={log.id} className="rounded-lg border bg-white p-4 shadow-soft">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-semibold">{routine?.name ?? "Workout"}</p>
                      <p className="mt-1 text-sm text-muted-foreground">{formatDate(log.trained_on)}</p>
                    </div>
                    <span className="shrink-0 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
                      Completed
                    </span>
                  </div>
                  {log.notes ? (
                    <p className="mt-3 border-t pt-3 text-sm text-muted-foreground">{log.notes}</p>
                  ) : null}
                </article>
              );
            })}
            {!logs?.length ? (
              <div className="rounded-lg border border-dashed bg-white p-6 text-center text-sm text-muted-foreground shadow-soft">
                No completed workouts logged yet.
              </div>
            ) : null}
          </div>
          <div className="hidden md:block">
            <Table>
              <thead>
                <tr>
                  <Th>Date</Th>
                  <Th>Routine</Th>
                  <Th>Notes</Th>
                </tr>
              </thead>
              <tbody>
                {logs?.map((log) => {
                  const routine = Array.isArray(log.workout_routines)
                    ? log.workout_routines[0]
                    : log.workout_routines;
                  return (
                    <tr key={log.id}>
                      <Td>{formatDate(log.trained_on)}</Td>
                      <Td>{routine?.name ?? "None"}</Td>
                      <Td>{log.notes ?? "No notes"}</Td>
                    </tr>
                  );
                })}
                {!logs?.length ? (
                  <tr>
                    <Td colSpan={3}>No completed workouts logged yet.</Td>
                  </tr>
                ) : null}
              </tbody>
            </Table>
          </div>
        </div>
        <div className="min-w-0">
          <h2 className="mb-3 text-lg font-semibold">Body progress</h2>
          <div className="grid gap-3 md:hidden">
            {progress?.map((entry) => (
              <article key={entry.id} className="rounded-lg border bg-white p-4 shadow-soft">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Recorded on
                    </p>
                    <p className="mt-1 text-sm font-medium">{formatDate(entry.recorded_on)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Weight
                    </p>
                    <p className="mt-1 text-lg font-semibold">{entry.body_weight} kg</p>
                  </div>
                </div>
                <dl className="mt-4 grid grid-cols-2 gap-3 border-t pt-3">
                  <div className="rounded-md bg-muted/60 p-3">
                    <dt className="text-xs font-medium text-muted-foreground">Body fat</dt>
                    <dd className="mt-1 font-semibold">
                      {entry.body_fat_percentage ? `${entry.body_fat_percentage}%` : "Not set"}
                    </dd>
                  </div>
                  <div className="rounded-md bg-muted/60 p-3">
                    <dt className="text-xs font-medium text-muted-foreground">Waist</dt>
                    <dd className="mt-1 font-semibold">{entry.waist ?? "Not set"}</dd>
                  </div>
                </dl>
              </article>
            ))}
            {!progress?.length ? (
              <div className="rounded-lg border border-dashed bg-white p-6 text-center text-sm text-muted-foreground shadow-soft">
                No body progress entries yet.
              </div>
            ) : null}
          </div>
          <div className="hidden md:block">
            <Table>
              <thead>
                <tr>
                  <Th>Date</Th>
                  <Th>Weight</Th>
                  <Th>Body fat</Th>
                  <Th>Waist</Th>
                </tr>
              </thead>
              <tbody>
                {progress?.map((entry) => (
                  <tr key={entry.id}>
                    <Td>{formatDate(entry.recorded_on)}</Td>
                    <Td>{entry.body_weight} kg</Td>
                    <Td>{entry.body_fat_percentage ? `${entry.body_fat_percentage}%` : "Not set"}</Td>
                    <Td>{entry.waist ?? "Not set"}</Td>
                  </tr>
                ))}
                {!progress?.length ? (
                  <tr>
                    <Td colSpan={4}>No body progress entries yet.</Td>
                  </tr>
                ) : null}
              </tbody>
            </Table>
          </div>
        </div>
      </section>
    </>
  );
}
