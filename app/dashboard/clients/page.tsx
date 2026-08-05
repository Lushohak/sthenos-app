import Link from "next/link";
import { PageHeader } from "@/components/dashboard/page-header";
import { LinkButton } from "@/components/ui/button";
import { Table, Td, Th } from "@/components/ui/table";
import { getUserOrRedirect } from "@/lib/auth";
import { formatDate } from "@/lib/utils";
import { ArchiveStatusToast } from "@/components/ui/archive-status-toast";

type PageProps = {
  searchParams?: Promise<{
    deleted?: string;
    archived?: string;
    restored?: string;
    view?: string;
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

  const { data: clients, error } = await clientRequest.order("created_at", {
    ascending: false
  });

  if (error) throw new Error(error.message);

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
      <div className="mb-4 flex flex-wrap gap-2" aria-label="Client views">
        <LinkButton
          href="/dashboard/clients"
          variant={showArchived ? "ghost" : "secondary"}
        >
          Active clients
        </LinkButton>
        <LinkButton
          href="/dashboard/clients?view=archived"
          variant={showArchived ? "secondary" : "ghost"}
        >
          Archived clients
        </LinkButton>
      </div>
      {deletedClientName ? (
        <div
          className="mb-4 rounded-md border border-success/40 bg-success/5 px-4 py-3 text-sm text-success shadow-soft"
          role="status"
        >
          {deletedClientName} and their account were permanently deleted.
        </div>
      ) : null}
      <Table>
        <thead>
          <tr>
            <Th>Name</Th>
            <Th>Email</Th>
            <Th>Goal</Th>
            <Th>Status</Th>
            <Th>Created</Th>
          </tr>
        </thead>
        <tbody>
          {clients?.map((client) => (
            <tr key={client.id}>
              <Td>
                <Link className="font-medium text-info hover:text-info/80" href={`/dashboard/clients/${client.id}`}>
                  {client.name}
                </Link>
              </Td>
              <Td>{client.email ?? "Not set"}</Td>
              <Td>{client.goal ?? "Not set"}</Td>
              <Td className="capitalize">{client.status}</Td>
              <Td>{formatDate(client.created_at)}</Td>
            </tr>
          ))}
          {!clients?.length ? (
            <tr>
              <Td colSpan={5}>
                {showArchived ? "No archived clients." : "No active clients yet."}
              </Td>
            </tr>
          ) : null}
        </tbody>
      </Table>
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
