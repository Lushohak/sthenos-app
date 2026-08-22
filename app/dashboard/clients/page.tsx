import { ClientRoster } from "@/components/clients/client-roster";
import { PageHeader } from "@/components/dashboard/page-header";
import { LinkButton } from "@/components/ui/button";
import { getUserOrRedirect } from "@/lib/auth";
import { ArchiveStatusToast } from "@/components/ui/archive-status-toast";
import type { Database } from "@/types/database";

type LastTrainedEntry = Database["public"]["Functions"]["get_coach_client_last_trained"]["Returns"][number];

type PageProps = {
  searchParams?: Promise<{
    deleted?: string;
    archived?: string;
    restored?: string;
    view?: string;
    q?: string;
    status?: string;
    sort?: string;
  }>;
};

export default async function ClientsPage({ searchParams }: PageProps) {
  const resolvedSearchParams = await searchParams;
  const deletedClientName = resolvedSearchParams?.deleted;
  const archivedClientName = resolvedSearchParams?.archived;
  const restoredClientName = resolvedSearchParams?.restored;
  const showArchived = resolvedSearchParams?.view === "archived";
  const { supabase, user } = await getUserOrRedirect();
  let clientRequest = supabase
    .from("clients")
    .select("*")
    .eq("coach_id", user.id);

  clientRequest = showArchived
    ? clientRequest.eq("status", "archived")
    : clientRequest.neq("status", "archived");

  const [clientResult, lastTrainedResult] = await Promise.all([
    clientRequest.order("name", { ascending: true }),
    supabase.rpc("get_coach_client_last_trained")
  ]);

  if (clientResult.error) throw new Error(clientResult.error.message);
  if (lastTrainedResult.error) throw new Error(lastTrainedResult.error.message);
  const lastTrainedByClient = new Map(
    ((lastTrainedResult.data ?? []) as LastTrainedEntry[]).map((entry) => [entry.client_id, entry.last_trained_on])
  );
  const clients = (clientResult.data ?? []).map((client) => ({
    ...client,
    lastTrainedOn: lastTrainedByClient.get(client.id) ?? null
  }));
  const today = new Date().toISOString().slice(0, 10);

  return (
    <>
      <PageHeader
        title="Clients"
        description={
          showArchived
            ? "Review and restore archived trainee profiles."
            : "Create and manage active trainee profiles."
        }
        action={<LinkButton href="/dashboard/clients/new">New client</LinkButton>}
      />
      {deletedClientName ? (
        <div
          className="mb-4 rounded-md border border-success/40 bg-success/5 px-4 py-3 text-sm text-success shadow-soft"
          role="status"
        >
          {deletedClientName} and their account were permanently deleted.
        </div>
      ) : null}
      <ClientRoster clients={clients} archived={showArchived} today={today} />
      {archivedClientName ? (
        <ArchiveStatusToast
          itemName={archivedClientName}
          action="archived"
          description="The profile is hidden from active coaching workflows. Its login and history were preserved."
        />
      ) : null}
      {restoredClientName ? (
        <ArchiveStatusToast
          itemName={restoredClientName}
          action="restored"
          description="The client is active and can receive new routine assignments."
        />
      ) : null}
    </>
  );
}
