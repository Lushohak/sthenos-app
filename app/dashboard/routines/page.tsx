import Link from "next/link";
import { PageHeader } from "@/components/dashboard/page-header";
import { LinkButton } from "@/components/ui/button";
import { Table, Td, Th } from "@/components/ui/table";
import { getUserOrRedirect } from "@/lib/auth";
import { formatDate } from "@/lib/utils";

export default async function RoutinesPage() {
  const { supabase, user } = await getUserOrRedirect();
  const { data: routines, error } = await supabase
    .from("workout_routines")
    .select("*")
    .eq("coach_id", user.id)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);

  return (
    <>
      <PageHeader
        title="Routines"
        description="Create reusable workout templates and assign them to clients."
        action={<LinkButton href="/dashboard/routines/new">New routine</LinkButton>}
      />
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
                <Link className="font-medium text-primary" href={`/dashboard/routines/${routine.id}`}>
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
              <Td colSpan={4}>No routines yet.</Td>
            </tr>
          ) : null}
        </tbody>
      </Table>
    </>
  );
}
