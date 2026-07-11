import { ExternalLink } from "lucide-react";
import { PageHeader } from "@/components/dashboard/page-header";
import { StatCard } from "@/components/dashboard/stat-card";
import { ExerciseThumb } from "@/components/exercises/exercise-thumb";
import { Table, Td, Th } from "@/components/ui/table";
import { getTraineeOrRedirect } from "@/lib/trainee";
import { formatDate } from "@/lib/utils";

export default async function TraineeDashboardPage() {
  const { supabase, client } = await getTraineeOrRedirect();

  const [{ data: assignments }, { data: logs }, { data: progress }] = await Promise.all([
    supabase
      .from("client_routines")
      .select(
        "id, status, assigned_at, notes, workout_routines(id, name, description, routine_type, default_cycles, routine_exercises(position, cycle_number, repeat_count, sets, reps, load_type, target_weight, rest_seconds, notes, exercises(name, category, description, difficulty, thumbnail_url, video_url, equipment)))"
      )
      .eq("client_id", client.id)
      .order("assigned_at", { ascending: false }),
    supabase
      .from("workout_logs")
      .select("id, trained_on, notes, workout_routines(name)")
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
        <StatCard label="Active routines" value={assignments?.filter((item) => item.status === "active").length ?? 0} />
        <StatCard label="Completed sessions" value={logs?.length ?? 0} detail="Recent logged sessions" />
        <StatCard
          label="Latest weight"
          value={latestProgress ? `${latestProgress.body_weight} kg` : "No data"}
          detail={latestProgress ? formatDate(latestProgress.recorded_on) : "Ask your coach to add an entry"}
        />
      </section>
      <section className="mt-8">
        <h2 className="mb-3 text-lg font-semibold">Assigned routines</h2>
        <div className="grid gap-4">
          {assignments?.map((assignment) => {
            const routine = Array.isArray(assignment.workout_routines)
              ? assignment.workout_routines[0]
              : assignment.workout_routines;
            const routineExercises = routine?.routine_exercises ?? [];

            return (
              <article key={assignment.id} className="rounded-md border bg-white p-4 shadow-soft">
                <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <h3 className="font-semibold">{routine?.name ?? "Routine"}</h3>
                    <p className="text-sm text-muted-foreground">{routine?.description ?? "No description"}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {routine?.routine_type === "individual"
                        ? "Exercise-specific repeats"
                        : `${routine?.default_cycles ?? 3} cycle routine`}
                    </p>
                  </div>
                  <span className="text-sm capitalize text-muted-foreground">{assignment.status}</span>
                </div>
                <Table className="mt-4">
                  <thead>
                    <tr>
                      <Th>Exercise</Th>
                      <Th>Cycle</Th>
                      <Th>Demo</Th>
                      <Th>{routine?.routine_type === "individual" ? "Repeats" : "Cycles"}</Th>
                      <Th>Sets</Th>
                      <Th>Reps</Th>
                      <Th>Weight</Th>
                      <Th>Rest</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {routineExercises.map((item) => {
                      const exercise = Array.isArray(item.exercises) ? item.exercises[0] : item.exercises;
                      return (
                        <tr key={`${assignment.id}-${item.position}`}>
                          <Td>
                            <div className="flex min-w-60 items-center gap-3">
                              <ExerciseThumb src={exercise?.thumbnail_url} alt={exercise?.name ?? "Exercise"} className="h-14 w-20" />
                              <div>
                                <p className="font-medium">{exercise?.name ?? "Exercise"}</p>
                                <p className="text-xs text-muted-foreground">
                                  Difficulty {exercise?.difficulty ?? "?"} · {exercise?.equipment ?? "No equipment"}
                                </p>
                                {exercise?.description ? (
                                  <p className="mt-1 max-w-sm text-xs text-muted-foreground">{exercise.description}</p>
                                ) : null}
                              </div>
                            </div>
                          </Td>
                          <Td>{item.cycle_number}</Td>
                          <Td>
                            {exercise?.video_url ? (
                              <a className="inline-flex items-center gap-1 text-primary" href={exercise.video_url} target="_blank" rel="noreferrer">
                                Video <ExternalLink className="h-3 w-3" aria-hidden="true" />
                              </a>
                            ) : (
                              "None"
                            )}
                          </Td>
                          <Td>{item.repeat_count}</Td>
                          <Td>{item.sets}</Td>
                          <Td>{item.reps}</Td>
                          <Td>{item.load_type === "bodyweight" ? "Bodyweight" : item.target_weight ? `${item.target_weight} kg` : "Not set"}</Td>
                          <Td>{item.rest_seconds ? `${item.rest_seconds}s` : "Not set"}</Td>
                        </tr>
                      );
                    })}
                    {!routineExercises.length ? (
                      <tr>
                        <Td colSpan={8}>No exercises have been added yet.</Td>
                      </tr>
                    ) : null}
                  </tbody>
                </Table>
              </article>
            );
          })}
          {!assignments?.length ? (
            <div className="rounded-md border bg-white p-4 text-sm text-muted-foreground shadow-soft">
              No routines assigned yet.
            </div>
          ) : null}
        </div>
      </section>
      <section className="mt-8 grid gap-6 lg:grid-cols-2">
        <div>
          <h2 className="mb-3 text-lg font-semibold">Completed workouts</h2>
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
                const routine = Array.isArray(log.workout_routines) ? log.workout_routines[0] : log.workout_routines;
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
        <div>
          <h2 className="mb-3 text-lg font-semibold">Body progress</h2>
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
      </section>
    </>
  );
}
