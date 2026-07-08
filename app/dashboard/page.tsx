import { LinkButton } from "@/components/ui/button";
import { PageHeader } from "@/components/dashboard/page-header";
import { StatCard } from "@/components/dashboard/stat-card";
import { Table, Td, Th } from "@/components/ui/table";
import { getUserOrRedirect } from "@/lib/auth";
import { formatDate } from "@/lib/utils";

export default async function DashboardPage() {
  const { supabase, user } = await getUserOrRedirect();
  const weekStart = new Date();
  weekStart.setDate(weekStart.getDate() - 7);

  const [{ count: totalClients }, { data: weeklyLogs }, { data: recentProgress }] =
    await Promise.all([
      supabase.from("clients").select("id", { count: "exact", head: true }).eq("coach_id", user.id),
      supabase
        .from("workout_logs")
        .select("client_id")
        .eq("coach_id", user.id)
        .gte("trained_on", weekStart.toISOString().slice(0, 10)),
      supabase
        .from("body_progress_entries")
        .select("recorded_on, body_weight, body_fat_percentage, clients(name)")
        .eq("coach_id", user.id)
        .order("recorded_on", { ascending: false })
        .limit(5)
    ]);

  const trainedThisWeek = new Set(weeklyLogs?.map((log) => log.client_id)).size;

  return (
    <>
      <PageHeader
        title="Dashboard"
        description="A quick look at coaching activity and recent trainee progress."
        action={<LinkButton href="/dashboard/clients/new">New client</LinkButton>}
      />
      <section className="grid gap-4 md:grid-cols-3">
        <StatCard label="Total clients" value={totalClients ?? 0} />
        <StatCard label="Clients trained this week" value={trainedThisWeek} />
        <StatCard label="Recent progress updates" value={recentProgress?.length ?? 0} />
      </section>
      <section className="mt-8">
        <h2 className="mb-3 text-lg font-semibold">Recent progress</h2>
        <Table>
          <thead>
            <tr>
              <Th>Client</Th>
              <Th>Date</Th>
              <Th>Weight</Th>
              <Th>Body fat</Th>
            </tr>
          </thead>
          <tbody>
            {recentProgress?.map((entry) => {
              const client = Array.isArray(entry.clients) ? entry.clients[0] : entry.clients;
              return (
              <tr key={`${entry.recorded_on}-${entry.body_weight}`}>
                <Td>{(client as { name?: string } | null)?.name ?? "Unknown"}</Td>
                <Td>{formatDate(entry.recorded_on)}</Td>
                <Td>{entry.body_weight} kg</Td>
                <Td>{entry.body_fat_percentage ? `${entry.body_fat_percentage}%` : "Not set"}</Td>
              </tr>
              );
            })}
            {!recentProgress?.length ? (
              <tr>
                <Td colSpan={4}>No progress updates yet.</Td>
              </tr>
            ) : null}
          </tbody>
        </Table>
      </section>
    </>
  );
}
