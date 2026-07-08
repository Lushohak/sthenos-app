import Link from "next/link";
import { PageHeader } from "@/components/dashboard/page-header";
import { LinkButton } from "@/components/ui/button";
import { Table, Td, Th } from "@/components/ui/table";
import { getUserOrRedirect } from "@/lib/auth";
import { formatDate } from "@/lib/utils";

export default async function ClientsPage() {
  const { supabase, user } = await getUserOrRedirect();
  const { data: clients, error } = await supabase
    .from("clients")
    .select("*")
    .eq("coach_id", user.id)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);

  return (
    <>
      <PageHeader
        title="Clients"
        description="Create and manage trainee profiles."
        action={<LinkButton href="/dashboard/clients/new">New client</LinkButton>}
      />
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
                <Link className="font-medium text-primary" href={`/dashboard/clients/${client.id}`}>
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
              <Td colSpan={5}>No clients yet.</Td>
            </tr>
          ) : null}
        </tbody>
      </Table>
    </>
  );
}
