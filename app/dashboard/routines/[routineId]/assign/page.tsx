import { notFound } from "next/navigation";
import { PageHeader } from "@/components/dashboard/page-header";
import { BulkAssignRoutineForm } from "@/components/forms/bulk-assign-routine-form";
import { LinkButton } from "@/components/ui/button";
import { getUserOrRedirect } from "@/lib/auth";

type PageProps = {
  params: Promise<{ routineId: string }>;
};

export default async function BulkAssignRoutinePage({ params }: PageProps) {
  const { routineId } = await params;
  const { supabase, user } = await getUserOrRedirect();
  const [
    { data: routine, error: routineError },
    { data: trainees, error: traineesError },
    { data: existingAssignments, error: assignmentsError }
  ] = await Promise.all([
    supabase
      .from("workout_routines")
      .select("id, name, description")
      .eq("id", routineId)
      .eq("coach_id", user.id)
      .is("archived_at", null)
      .single(),
    supabase
      .from("clients")
      .select("id, name, email")
      .eq("coach_id", user.id)
      .eq("status", "active")
      .order("name"),
    supabase
      .from("client_routines")
      .select("client_id, status")
      .eq("coach_id", user.id)
      .eq("routine_id", routineId)
      .in("status", ["active", "paused"])
  ]);

  if (routineError || !routine) {
    notFound();
  }

  if (traineesError || assignmentsError) {
    throw new Error("Unable to load trainees for bulk assignment.");
  }

  const assignmentStatusByClient = new Map(
    (existingAssignments ?? []).map((assignment) => [
      assignment.client_id,
      assignment.status as "active" | "paused"
    ])
  );
  const assignableTrainees = (trainees ?? []).map((trainee) => ({
    ...trainee,
    existingAssignmentStatus:
      assignmentStatusByClient.get(trainee.id) ?? null
  }));

  return (
    <>
      <PageHeader
        title="Assign trainees"
        description={`Assign ${routine.name} to several active trainees at once.`}
        action={
          <LinkButton
            href={`/dashboard/routines/${routine.id}`}
            variant="secondary"
          >
            Back to routine
          </LinkButton>
        }
      />
      <BulkAssignRoutineForm
        routineId={routine.id}
        routineName={routine.name}
        routineDescription={routine.description}
        trainees={assignableTrainees}
      />
    </>
  );
}
