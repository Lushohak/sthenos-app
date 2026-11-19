import { PendingLink as Link } from "@/components/ui/pending-link";
import { Activity, CalendarClock } from "lucide-react";
import { PageHeader } from "@/components/dashboard/page-header";
import { StatCard } from "@/components/dashboard/stat-card";
import {
  RosterActivityChart,
  TrainingTrendChart
} from "@/components/progress/analytics-charts";
import { ProgressRangeSelector } from "@/components/progress/progress-range-selector";
import { Table, Td, Th } from "@/components/ui/table";
import { getUserOrRedirect } from "@/lib/auth";
import {
  createCoachClientSummaries,
  createTrainingBuckets,
  getProgressRangeStart,
  parseProgressRange,
  progressRangeLabel,
  type TrainingLogPoint
} from "@/lib/progress-analytics";
import { formatDate } from "@/lib/utils";

type PageProps = {
  searchParams?: Promise<{ range?: string | string[] }>;
};

export default async function ProgressPage({ searchParams }: PageProps) {
  const { supabase, user } = await getUserOrRedirect();
  const params = await searchParams;
  const range = parseProgressRange(params?.range, "12w");
  const rangeLabel = progressRangeLabel(range);
  const today = new Date().toISOString().slice(0, 10);
  const rangeStart = getProgressRangeStart(range, today);
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const activityTableStart = thirtyDaysAgo.toISOString().slice(0, 10);
  const [
    { data: clients, error: clientsError },
    { data: entries, error: progressError },
    { data: workoutLogs, error: workoutError },
    { data: activityLogs, error: activityError }
  ] = await Promise.all([
    supabase
      .from("clients")
      .select("id, name, status, created_at")
      .eq("coach_id", user.id)
      .order("name"),
    supabase
      .from("body_progress_entries")
      .select("*, clients(id, name)")
      .eq("coach_id", user.id)
      .order("recorded_on", { ascending: false }),
    supabase
      .from("workout_logs")
      .select("client_id, trained_on")
      .eq("coach_id", user.id),
    supabase
      .from("activity_logs")
      .select("client_id, performed_on, duration_minutes, distance_km, elevation_gain_m, calories_burned, perceived_intensity")
      .eq("coach_id", user.id)
  ]);

  const error = clientsError ?? progressError ?? workoutError ?? activityError;
  if (error) throw new Error(error.message);

  const trainingLogs: TrainingLogPoint[] = [
    ...(workoutLogs ?? []).map((log) => ({
      clientId: log.client_id,
      date: log.trained_on,
      type: "workout" as const
    })),
    ...(activityLogs ?? []).map((log) => ({
      clientId: log.client_id,
      date: log.performed_on,
      type: "activity" as const
    }))
  ];
  const buckets = createTrainingBuckets(trainingLogs, range, today);
  const clientSummaries = createCoachClientSummaries(
    clients ?? [],
    trainingLogs,
    (entries ?? []).map((entry) => ({ clientId: entry.client_id, date: entry.recorded_on })),
    range,
    today
  );
  const attentionClients = clientSummaries.filter(
    (client) => client.trainingNeedsAttention || client.bodyNeedsAttention
  );
  const visibleActivityLogs = (activityLogs ?? []).filter(
    (log) => log.performed_on <= today && log.performed_on >= activityTableStart
  );
  const clientById = new Map((clients ?? []).map((client) => [client.id, client]));
  const activityByClient = new Map<string, {
    id: string;
    name: string;
    completions: number;
    duration: number;
    distance: number;
    elevation: number;
    calories: number;
    intensityTotal: number;
    intensityCount: number;
  }>();

  for (const log of visibleActivityLogs) {
    const client = clientById.get(log.client_id);
    if (!client || client.status === "archived") continue;
    const current = activityByClient.get(log.client_id) ?? {
      id: client.id,
      name: client.name,
      completions: 0,
      duration: 0,
      distance: 0,
      elevation: 0,
      calories: 0,
      intensityTotal: 0,
      intensityCount: 0
    };
    current.completions += 1;
    current.duration += Number(log.duration_minutes ?? 0);
    current.distance += Number(log.distance_km ?? 0);
    current.elevation += Number(log.elevation_gain_m ?? 0);
    current.calories += Number(log.calories_burned ?? 0);
    if (log.perceived_intensity !== null) {
      current.intensityTotal += Number(log.perceived_intensity);
      current.intensityCount += 1;
    }
    activityByClient.set(log.client_id, current);
  }

  const activitySummaries = [...activityByClient.values()].sort(
    (a, b) => b.completions - a.completions
  );
  const showDuration = activitySummaries.some((summary) => summary.duration > 0);
  const showDistance = activitySummaries.some((summary) => summary.distance > 0);
  const showElevation = activitySummaries.some((summary) => summary.elevation > 0);
  const showCalories = activitySummaries.some((summary) => summary.calories > 0);
  const showIntensity = activitySummaries.some((summary) => summary.intensityCount > 0);
  const activityColumnCount = 2 + [showDuration, showDistance, showElevation, showCalories, showIntensity].filter(Boolean).length;
  const visibleEntries = (entries ?? []).filter(
    (entry) => entry.recorded_on <= today && (!rangeStart || entry.recorded_on >= rangeStart)
  );
  const totalSessions = trainingLogs.filter(
    (log) => log.date <= today && (!rangeStart || log.date >= rangeStart)
  ).length;

  return (
    <>
      <PageHeader
        title="Progress"
        description="Spot training patterns, follow-up opportunities, and individual progress."
      />

      <div className="mb-6">
        <ProgressRangeSelector value={range} />
      </div>

      <section className="mb-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Active clients" value={clientSummaries.length} />
        <StatCard label={`Sessions · ${rangeLabel}`} value={totalSessions} detail="Workouts and Activities" />
        <StatCard label="Clients who trained" value={clientSummaries.filter((client) => client.trainingDays > 0).length} detail={`During ${rangeLabel.toLowerCase()}`} />
        <StatCard label="Needs attention" value={attentionClients.length} detail="Neutral follow-up signals" />
      </section>

      <section className="mb-8 rounded-xl border bg-card p-4 shadow-soft sm:p-5" aria-labelledby="needs-attention-title">
        <div className="flex items-start gap-3">
          <CalendarClock className="mt-0.5 h-5 w-5 text-primary" aria-hidden="true" />
          <div>
            <h2 id="needs-attention-title" className="font-semibold">Needs attention</h2>
            <p className="mt-1 text-sm text-muted-foreground">Active clients with no training in 7 days or no body update in 30 days. New clients receive the same grace period.</p>
          </div>
        </div>
        {attentionClients.length ? (
          <ul className="mt-4 grid gap-3 lg:grid-cols-2">
            {attentionClients.map((client) => (
              <li key={client.id} className="rounded-lg border bg-background-secondary p-4">
                <Link href={`/dashboard/clients/${client.id}`} className="font-semibold text-info hover:text-info/80">{client.name}</Link>
                <ul className="mt-2 grid gap-1 text-sm text-muted-foreground">
                  {client.trainingNeedsAttention ? <li>No training logged in the last 7 days{client.lastTrainingDate ? ` · Last: ${formatDate(client.lastTrainingDate)}` : ""}</li> : null}
                  {client.bodyNeedsAttention ? <li>No body update in the last 30 days{client.lastBodyProgressDate ? ` · Last: ${formatDate(client.lastBodyProgressDate)}` : ""}</li> : null}
                </ul>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-4 rounded-lg border border-dashed p-4 text-sm text-muted-foreground">No follow-up signals right now.</p>
        )}
      </section>

      <section className="mb-8 grid gap-6 xl:grid-cols-2">
        <TrainingTrendChart
          buckets={buckets}
          title="Completed training"
          description={`Workouts and Activities completed across the roster · ${rangeLabel}`}
        />
        <RosterActivityChart clients={clientSummaries} rangeLabel={rangeLabel} />
      </section>

      <section className="mb-8">
        <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold"><Activity className="h-5 w-5 text-primary" aria-hidden="true" />Activity summary · Last 30 days</h2>
        <Table>
          <thead><tr><Th>Client</Th><Th>Activities</Th>{showDuration ? <Th>Duration</Th> : null}{showDistance ? <Th>Distance</Th> : null}{showElevation ? <Th>Elevation</Th> : null}{showCalories ? <Th>Est. calories</Th> : null}{showIntensity ? <Th>Average intensity</Th> : null}</tr></thead>
          <tbody>
            {activitySummaries.map((summary) => (
              <tr key={summary.id}>
                <Td><Link className="font-medium text-info hover:text-info/80" href={`/dashboard/clients/${summary.id}`}>{summary.name}</Link></Td>
                <Td>{summary.completions}</Td>
                {showDuration ? <Td>{summary.duration ? `${summary.duration} min` : "Not recorded"}</Td> : null}
                {showDistance ? <Td>{summary.distance ? `${summary.distance.toFixed(2)} km` : "Not recorded"}</Td> : null}
                {showElevation ? <Td>{summary.elevation ? `${summary.elevation.toFixed(0)} m` : "Not recorded"}</Td> : null}
                {showCalories ? <Td>{summary.calories ? `${summary.calories} kcal` : "Not recorded"}</Td> : null}
                {showIntensity ? <Td>{summary.intensityCount ? `${(summary.intensityTotal / summary.intensityCount).toFixed(1)}/10` : "Not recorded"}</Td> : null}
              </tr>
            ))}
            {!activitySummaries.length ? <tr><Td colSpan={activityColumnCount}>No Activities completed in the last 30 days.</Td></tr> : null}
          </tbody>
        </Table>
      </section>

      <section>
        <h2 className="mb-1 text-lg font-semibold">Body composition history</h2>
        <p className="mb-3 text-sm text-muted-foreground">Detailed entries · {rangeLabel}</p>
        <Table>
          <thead><tr><Th>Client</Th><Th>Date</Th><Th>Weight</Th><Th>Body fat</Th><Th>Muscle mass</Th><Th>Waist</Th><Th>Chest</Th><Th>Arms</Th><Th>Legs</Th></tr></thead>
          <tbody>
            {visibleEntries.map((entry) => {
              const client = Array.isArray(entry.clients) ? entry.clients[0] : entry.clients;
              return (
                <tr key={entry.id}>
                  <Td>{client ? <Link className="font-medium text-info hover:text-info/80" href={`/dashboard/clients/${client.id}`}>{client.name}</Link> : "Unknown"}</Td>
                  <Td>{formatDate(entry.recorded_on)}</Td>
                  <Td>{entry.body_weight} kg</Td>
                  <Td>{entry.body_fat_percentage !== null ? `${entry.body_fat_percentage}%` : "Not set"}</Td>
                  <Td>{entry.muscle_mass_percentage !== null ? `${entry.muscle_mass_percentage}%` : "Not set"}</Td>
                  <Td>{entry.waist !== null ? `${entry.waist} cm` : "Not set"}</Td>
                  <Td>{entry.chest !== null ? `${entry.chest} cm` : "Not set"}</Td>
                  <Td>{entry.arms !== null ? `${entry.arms} cm` : "Not set"}</Td>
                  <Td>{entry.legs !== null ? `${entry.legs} cm` : "Not set"}</Td>
                </tr>
              );
            })}
            {!visibleEntries.length ? <tr><Td colSpan={9}>No progress entries in this date range.</Td></tr> : null}
          </tbody>
        </Table>
      </section>
    </>
  );
}
