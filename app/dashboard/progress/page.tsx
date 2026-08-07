import Link from "next/link";
import { PageHeader } from "@/components/dashboard/page-header";
import { Table, Td, Th } from "@/components/ui/table";
import { getUserOrRedirect } from "@/lib/auth";
import { formatDate } from "@/lib/utils";

export default async function ProgressPage() {
  const { supabase, user } = await getUserOrRedirect();
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const [{ data: entries, error }, { data: activityLogs, error: activityError }] = await Promise.all([
    supabase
      .from("body_progress_entries")
      .select("*, clients(id, name)")
      .eq("coach_id", user.id)
      .order("recorded_on", { ascending: false }),
    supabase
      .from("activity_logs")
      .select("client_id, duration_minutes, distance_km, elevation_gain_m, calories_burned, perceived_intensity, clients(id, name)")
      .eq("coach_id", user.id)
      .gte("performed_on", thirtyDaysAgo.toISOString().slice(0, 10))
  ]);

  if (error || activityError) throw new Error(error?.message ?? activityError?.message);
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
  for (const log of activityLogs ?? []) {
    const client = Array.isArray(log.clients) ? log.clients[0] : log.clients;
    if (!client) continue;
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

  return (
    <>
      <PageHeader
        title="Progress"
        description="Review recent Activity totals and body composition history across trainees."
      />
      <section className="mb-8">
        <h2 className="mb-3 text-lg font-semibold">Activity summary · Last 30 days</h2>
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
            {!activityByClient.size ? <tr><Td colSpan={activityColumnCount}>No Activities completed in the last 30 days.</Td></tr> : null}
          </tbody>
        </Table>
      </section>
      <section>
        <h2 className="mb-3 text-lg font-semibold">Body composition history</h2>
      <Table>
        <thead>
          <tr>
            <Th>Client</Th>
            <Th>Date</Th>
            <Th>Weight</Th>
            <Th>Body fat</Th>
            <Th>Waist</Th>
            <Th>Chest</Th>
            <Th>Arms</Th>
            <Th>Legs</Th>
          </tr>
        </thead>
        <tbody>
          {entries?.map((entry) => {
            const client = Array.isArray(entry.clients) ? entry.clients[0] : entry.clients;
            return (
              <tr key={entry.id}>
                <Td>
                  {client ? (
                    <Link className="font-medium text-info hover:text-info/80" href={`/dashboard/clients/${client.id}`}>
                      {client.name}
                    </Link>
                  ) : (
                    "Unknown"
                  )}
                </Td>
                <Td>{formatDate(entry.recorded_on)}</Td>
                <Td>{entry.body_weight} kg</Td>
                <Td>{entry.body_fat_percentage ? `${entry.body_fat_percentage}%` : "Not set"}</Td>
                <Td>{entry.waist ?? "Not set"}</Td>
                <Td>{entry.chest ?? "Not set"}</Td>
                <Td>{entry.arms ?? "Not set"}</Td>
                <Td>{entry.legs ?? "Not set"}</Td>
              </tr>
            );
          })}
          {!entries?.length ? (
            <tr>
              <Td colSpan={8}>No progress entries yet.</Td>
            </tr>
          ) : null}
        </tbody>
      </Table>
      </section>
    </>
  );
}
