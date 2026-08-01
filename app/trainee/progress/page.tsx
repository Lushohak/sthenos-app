import { Activity, Scale, TrendingUp } from "lucide-react";
import { PageHeader } from "@/components/dashboard/page-header";
import { StatCard } from "@/components/dashboard/stat-card";
import { Table, Td, Th } from "@/components/ui/table";
import { getTraineeOrRedirect } from "@/lib/trainee";
import { formatDate } from "@/lib/utils";

export default async function TraineeProgressPage() {
  const { supabase, client } = await getTraineeOrRedirect();
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const [
    { count: completedSessionCount, error: sessionCountError },
    { count: recentSessionCount, error: recentCountError },
    { data: logs, error: logsError },
    { data: progress, error: progressError }
  ] = await Promise.all([
    supabase
      .from("workout_logs")
      .select("id", { count: "exact", head: true })
      .eq("client_id", client.id),
    supabase
      .from("workout_logs")
      .select("id", { count: "exact", head: true })
      .eq("client_id", client.id)
      .gte("trained_on", thirtyDaysAgo.toISOString().slice(0, 10)),
    supabase
      .from("workout_logs")
      .select("id, trained_on, notes, workout_routines(name)")
      .eq("client_id", client.id)
      .order("trained_on", { ascending: false })
      .limit(20),
    supabase
      .from("body_progress_entries")
      .select("*")
      .eq("client_id", client.id)
      .order("recorded_on", { ascending: false })
  ]);

  if (sessionCountError || recentCountError || logsError || progressError) {
    throw new Error("Unable to load trainee progress.");
  }

  const latestProgress = progress?.[0];
  const firstProgress = progress?.at(-1);
  const weightChange =
    latestProgress && firstProgress
      ? Number(latestProgress.body_weight) - Number(firstProgress.body_weight)
      : null;
  const weightChangeLabel =
    weightChange === null
      ? "Not enough data"
      : `${weightChange > 0 ? "+" : ""}${weightChange.toFixed(1)} kg`;

  return (
    <>
      <PageHeader
        title="Your progress"
        description="Review your completed workouts and body measurements over time."
      />

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Completed sessions"
          value={completedSessionCount ?? 0}
          detail="All logged workouts"
        />
        <StatCard
          label="Last 30 days"
          value={recentSessionCount ?? 0}
          detail="Completed workouts"
        />
        <StatCard
          label="Latest weight"
          value={latestProgress ? `${latestProgress.body_weight} kg` : "No data"}
          detail={latestProgress ? formatDate(latestProgress.recorded_on) : "No measurements yet"}
        />
        <StatCard
          label="Weight change"
          value={weightChangeLabel}
          detail={firstProgress ? `Since ${formatDate(firstProgress.recorded_on)}` : "From your first entry"}
        />
      </section>

      <section className="mt-8">
        <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold">
          <Scale className="h-5 w-5 text-primary" aria-hidden="true" />
          Body progress
        </h2>
        <div className="grid gap-3 md:hidden">
          {progress?.map((entry) => (
            <article key={entry.id} className="rounded-lg border bg-card p-4 shadow-soft">
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
                    {entry.body_fat_percentage !== null
                      ? `${entry.body_fat_percentage}%`
                      : "Not set"}
                  </dd>
                </div>
                <div className="rounded-md bg-muted/60 p-3">
                  <dt className="text-xs font-medium text-muted-foreground">Waist</dt>
                  <dd className="mt-1 font-semibold">
                    {entry.waist !== null ? `${entry.waist} cm` : "Not set"}
                  </dd>
                </div>
              </dl>
              {entry.notes ? (
                <p className="mt-3 border-t pt-3 text-sm text-muted-foreground">{entry.notes}</p>
              ) : null}
            </article>
          ))}
          {!progress?.length ? (
            <div className="rounded-lg border border-dashed bg-card p-6 text-center text-sm text-muted-foreground shadow-soft">
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
                <Th>Notes</Th>
              </tr>
            </thead>
            <tbody>
              {progress?.map((entry) => (
                <tr key={entry.id}>
                  <Td>{formatDate(entry.recorded_on)}</Td>
                  <Td>{entry.body_weight} kg</Td>
                  <Td>
                    {entry.body_fat_percentage !== null
                      ? `${entry.body_fat_percentage}%`
                      : "Not set"}
                  </Td>
                  <Td>{entry.waist !== null ? `${entry.waist} cm` : "Not set"}</Td>
                  <Td>{entry.notes ?? "No notes"}</Td>
                </tr>
              ))}
              {!progress?.length ? (
                <tr>
                  <Td colSpan={5}>No body progress entries yet.</Td>
                </tr>
              ) : null}
            </tbody>
          </Table>
        </div>
      </section>

      <section className="mt-8">
        <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold">
          <Activity className="h-5 w-5 text-primary" aria-hidden="true" />
          Workout history
        </h2>
        <div className="grid gap-3 md:hidden">
          {logs?.map((log) => {
            const routine = Array.isArray(log.workout_routines)
              ? log.workout_routines[0]
              : log.workout_routines;

            return (
              <article key={log.id} className="rounded-lg border bg-card p-4 shadow-soft">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{routine?.name ?? "Workout"}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{formatDate(log.trained_on)}</p>
                  </div>
                  <TrendingUp className="h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
                </div>
                {log.notes ? (
                  <p className="mt-3 border-t pt-3 text-sm text-muted-foreground">{log.notes}</p>
                ) : null}
              </article>
            );
          })}
          {!logs?.length ? (
            <div className="rounded-lg border border-dashed bg-card p-6 text-center text-sm text-muted-foreground shadow-soft">
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
                    <Td>{routine?.name ?? "Workout"}</Td>
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
      </section>
    </>
  );
}
