import { Activity, Scale } from "lucide-react";
import { PageHeader } from "@/components/dashboard/page-header";
import { StatCard } from "@/components/dashboard/stat-card";
import { Table, Td, Th } from "@/components/ui/table";
import {
  ACTIVITY_METRIC_KEYS,
  activityMetricValuesFromLog,
  formatActivityMetricResult,
  parseActivityTargets,
  summarizeActivityLogs
} from "@/lib/activities";
import { getTraineeOrRedirect } from "@/lib/trainee";
import { formatDate } from "@/lib/utils";

export default async function TraineeProgressPage() {
  const { supabase, client } = await getTraineeOrRedirect();
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const since = thirtyDaysAgo.toISOString().slice(0, 10);
  const [
    { count: workoutCount },
    { count: recentWorkoutCount },
    { data: workoutLogs, error: workoutError },
    { count: activityCount },
    { data: activityLogs, error: activityError },
    { data: recentActivityLogs, error: recentActivityError },
    { data: progress, error: progressError }
  ] = await Promise.all([
    supabase.from("workout_logs").select("id", { count: "exact", head: true }).eq("client_id", client.id),
    supabase.from("workout_logs").select("id", { count: "exact", head: true }).eq("client_id", client.id).gte("trained_on", since),
    supabase.from("workout_logs").select("id, trained_on, created_at, notes, duration_minutes, workout_routines(name)").eq("client_id", client.id).order("trained_on", { ascending: false }).limit(20),
    supabase.from("activity_logs").select("id", { count: "exact", head: true }).eq("client_id", client.id),
    supabase.from("activity_logs").select("id, performed_on, created_at, notes, duration_minutes, distance_km, elevation_gain_m, calories_burned, perceived_intensity, activities(name), client_activities(targets)").eq("client_id", client.id).order("performed_on", { ascending: false }).limit(30),
    supabase.from("activity_logs").select("duration_minutes, distance_km, elevation_gain_m, calories_burned, perceived_intensity").eq("client_id", client.id).gte("performed_on", since),
    supabase.from("body_progress_entries").select("*").eq("client_id", client.id).order("recorded_on", { ascending: false })
  ]);
  if (workoutError || activityError || recentActivityError || progressError) throw new Error("Unable to load trainee progress.");

  const insights = summarizeActivityLogs(recentActivityLogs ?? []);
  const recentActivityCount = recentActivityLogs?.length ?? 0;
  const latestProgress = progress?.[0];
  const firstProgress = progress?.at(-1);
  const weightChange = latestProgress && firstProgress ? Number(latestProgress.body_weight) - Number(firstProgress.body_weight) : null;
  const history = [
    ...(workoutLogs ?? []).map((log) => {
      const routine = Array.isArray(log.workout_routines) ? log.workout_routines[0] : log.workout_routines;
      return { id: log.id, type: "Workout", date: log.trained_on, createdAt: log.created_at, name: routine?.name ?? "Workout", notes: log.notes, results: log.duration_minutes ? `${log.duration_minutes} min` : "Completed" };
    }),
    ...(activityLogs ?? []).map((log) => {
      const activity = Array.isArray(log.activities) ? log.activities[0] : log.activities;
      const values = activityMetricValuesFromLog(log);
      const assignment = Array.isArray(log.client_activities) ? log.client_activities[0] : log.client_activities;
      const targets = parseActivityTargets(assignment?.targets ?? null);
      return { id: log.id, type: "Activity", date: log.performed_on, createdAt: log.created_at, name: activity?.name ?? "Activity", notes: log.notes, results: ACTIVITY_METRIC_KEYS.flatMap((key) => values[key] === undefined ? [] : [formatActivityMetricResult(key, values[key]!, targets)]).join(" · ") || "Completed" };
    })
  ].sort((a, b) => `${b.date}-${b.createdAt}`.localeCompare(`${a.date}-${a.createdAt}`)).slice(0, 30);

  return (
    <>
      <PageHeader title="Your progress" description="Review completed training, Activity insights, and body measurements." />
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Completed sessions" value={(workoutCount ?? 0) + (activityCount ?? 0)} detail="Workouts and Activities" />
        <StatCard label="Last 30 days" value={(recentWorkoutCount ?? 0) + recentActivityCount} detail="Completed training" />
        <StatCard label="Latest weight" value={latestProgress ? `${latestProgress.body_weight} kg` : "No data"} detail={latestProgress ? formatDate(latestProgress.recorded_on) : "No measurements yet"} />
        <StatCard label="Weight change" value={weightChange === null ? "Not enough data" : `${weightChange > 0 ? "+" : ""}${weightChange.toFixed(1)} kg`} detail={firstProgress ? `Since ${formatDate(firstProgress.recorded_on)}` : "From your first entry"} />
      </section>

      <section className="mt-8">
        <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold"><Activity className="h-5 w-5 text-primary" aria-hidden="true" />Activity insights · Last 30 days</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          <StatCard label="Activities" value={insights.completions} />
          {insights.durationMinutes ? <StatCard label="Duration" value={`${insights.durationMinutes} min`} /> : null}
          {insights.distanceKm ? <StatCard label="Distance" value={`${insights.distanceKm.toFixed(2)} km`} /> : null}
          {insights.elevationGainM ? <StatCard label="Elevation" value={`${insights.elevationGainM.toFixed(0)} m`} /> : null}
          {insights.caloriesBurned ? <StatCard label="Est. calories" value={`${insights.caloriesBurned} kcal`} /> : null}
          {insights.averageIntensity !== null ? <StatCard label="Average intensity" value={`${insights.averageIntensity.toFixed(1)}/10`} /> : null}
        </div>
      </section>

      <section className="mt-8">
        <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold"><Scale className="h-5 w-5 text-primary" aria-hidden="true" />Body progress</h2>
        <Table>
          <thead><tr><Th>Date</Th><Th>Weight</Th><Th>Body fat</Th><Th>Waist</Th><Th>Notes</Th></tr></thead>
          <tbody>
            {progress?.map((entry) => <tr key={entry.id}><Td>{formatDate(entry.recorded_on)}</Td><Td>{entry.body_weight} kg</Td><Td>{entry.body_fat_percentage !== null ? `${entry.body_fat_percentage}%` : "Not set"}</Td><Td>{entry.waist !== null ? `${entry.waist} cm` : "Not set"}</Td><Td>{entry.notes ?? "No notes"}</Td></tr>)}
            {!progress?.length ? <tr><Td colSpan={5}>No body progress entries yet.</Td></tr> : null}
          </tbody>
        </Table>
      </section>

      <section className="mt-8">
        <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold"><Activity className="h-5 w-5 text-primary" aria-hidden="true" />Training history</h2>
        <Table>
          <thead><tr><Th>Date</Th><Th>Type</Th><Th>Session</Th><Th>Results</Th><Th>Notes</Th></tr></thead>
          <tbody>
            {history.map((item) => <tr key={`${item.type}-${item.id}`}><Td>{formatDate(item.date)}</Td><Td>{item.type}</Td><Td>{item.name}</Td><Td>{item.results}</Td><Td>{item.notes ?? "No notes"}</Td></tr>)}
            {!history.length ? <tr><Td colSpan={5}>No completed training logged yet.</Td></tr> : null}
          </tbody>
        </Table>
      </section>
    </>
  );
}
