import Link from "next/link";
import { PageHeader } from "@/components/dashboard/page-header";
import { LinkButton } from "@/components/ui/button";
import { Table, Td, Th } from "@/components/ui/table";
import { getUserOrRedirect } from "@/lib/auth";
import { formatDate } from "@/lib/utils";
import { ArchiveStatusToast } from "@/components/ui/archive-status-toast";

type PageProps = {
  searchParams?: Promise<{
    archived?: string;
    restored?: string;
    view?: string;
  }>;
};

export default async function RoutinesPage({ searchParams }: PageProps) {
  const resolvedSearchParams = await searchParams;
  const archivedRoutineName = resolvedSearchParams?.archived;
  const restoredRoutineName = resolvedSearchParams?.restored;
  const showArchived = resolvedSearchParams?.view === "archived";
  const { supabase, user } = await getUserOrRedirect();
  let routineRequest = supabase
    .from("workout_routines")
    .select("*")
    .eq("coach_id", user.id);

  routineRequest = showArchived
    ? routineRequest.not("archived_at", "is", null)
    : routineRequest.is("archived_at", null);

  const { data: routines, error } = await routineRequest.order("created_at", {
    ascending: false
  });

  if (error) throw new Error(error.message);

  return (
    <>
      <PageHeader
        title="Routines"
        description={
          showArchived
            ? "Review and restore archived workout templates."
            : "Create reusable workout templates and assign them to clients."
        }
        action={<LinkButton href="/dashboard/routines/new">New routine</LinkButton>}
      />
      <div className="mb-4 flex flex-wrap gap-2" aria-label="Routine views">
        <LinkButton
          href="/dashboard/routines"
          variant={showArchived ? "ghost" : "secondary"}
        >
          Active routines
        </LinkButton>
        <LinkButton
          href="/dashboard/routines?view=archived"
          variant={showArchived ? "secondary" : "ghost"}
        >
          Archived routines
        </LinkButton>
      </div>
      <Table>
        <thead>
          <tr>
            <Th>Name</Th>
            <Th>Structure</Th>
            <Th>Description</Th>
            <Th>Created</Th>
          </tr>
        </thead>
        <tbody>
          {routines?.map((routine) => (
            <tr key={routine.id}>
              <Td>
                <Link className="font-medium text-info hover:text-info/80" href={`/dashboard/routines/${routine.id}`}>
                  {routine.name}
                </Link>
              </Td>
              <Td>
                {routine.routine_type === "circuit"
                  ? `${routine.default_cycles} cycles`
                  : "Exercise-specific"}
              </Td>
              <Td>{routine.description ?? "No description"}</Td>
              <Td>{formatDate(routine.created_at)}</Td>
            </tr>
          ))}
          {!routines?.length ? (
            <tr>
              <Td colSpan={4}>
                {showArchived ? "No archived routines." : "No active routines yet."}
              </Td>
            </tr>
          ) : null}
        </tbody>
      </Table>
      {archivedRoutineName ? (
        <ArchiveStatusToast
          itemName={archivedRoutineName}
          action="archived"
          description="It is hidden from active workflows. Existing trainee assignments were not changed."
        />
      ) : null}
      {restoredRoutineName ? (
        <ArchiveStatusToast
          itemName={restoredRoutineName}
          action="restored"
          description="The routine can be edited and assigned to trainees again."
        />
      ) : null}
    </>
  );
}
