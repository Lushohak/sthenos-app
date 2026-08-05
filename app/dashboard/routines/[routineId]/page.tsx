import { notFound } from "next/navigation";
import { PageHeader } from "@/components/dashboard/page-header";
import { RoutineExerciseForm } from "@/components/forms/routine-exercise-form";
import { RoutineExerciseList } from "@/components/forms/routine-exercise-list";
import { LinkButton } from "@/components/ui/button";
import { ArchiveRoutine } from "@/components/routines/archive-routine";
import { getUserOrRedirect } from "@/lib/auth";

type PageProps = {
  params: Promise<{ routineId: string }>;
  searchParams?: Promise<{ createdExercise?: string }>;
};

export default async function RoutineDetailPage({ params, searchParams }: PageProps) {
  const [{ routineId }, resolvedSearchParams] = await Promise.all([
    params,
    searchParams
  ]);
  const createdExerciseId = resolvedSearchParams?.createdExercise;
  const { supabase, user } = await getUserOrRedirect();

  const [
    { data: routine, error },
    { data: routineExercises },
    { data: libraryExercises },
    { data: existingAssignments }
  ] = await Promise.all([
    supabase
      .from("workout_routines")
      .select("*")
      .eq("coach_id", user.id)
      .eq("id", routineId)
      .single(),
    supabase
      .from("routine_exercises")
      .select("*, exercises(name, category, difficulty, thumbnail_url, archived_at)")
      .eq("routine_id", routineId)
      .order("position"),
    supabase
      .from("exercises")
      .select("*")
      .eq("coach_id", user.id)
      .is("archived_at", null)
      .order("name"),
    supabase
      .from("client_routines")
      .select("client_id, clients(id, name)")
      .eq("coach_id", user.id)
      .eq("routine_id", routineId)
      .in("status", ["active", "paused"])
  ]);

  if (error || !routine) notFound();

  const isArchived = Boolean(routine.archived_at);
  const affectedClients = (existingAssignments ?? []).flatMap((assignment) => {
    const client = Array.isArray(assignment.clients)
      ? assignment.clients[0]
      : assignment.clients;

    return client ? [{ id: client.id, name: client.name }] : [];
  });

  return (
    <>
      <PageHeader
        title={routine.name}
        description={
          isArchived
            ? "This routine is archived and available in read-only mode."
            : routine.description ?? "Build the exercise list for this routine."
        }
        action={
          !isArchived ? (
            <LinkButton href={`/dashboard/routines/${routine.id}/assign`}>
              Assign trainees
            </LinkButton>
          ) : undefined
        }
      />
      {isArchived ? (
        <div className="mb-6 rounded-md border border-info/30 bg-info/5 px-4 py-3 text-sm text-info shadow-soft">
          Archived routines cannot be edited or assigned until they are restored.
          Existing trainee assignments remain available.
        </div>
      ) : null}
      <section className="mb-6 grid gap-4 sm:grid-cols-3">
        <div className="rounded-md border bg-card p-4 shadow-soft">
          <p className="text-sm font-medium text-muted-foreground">Structure</p>
          <p className="mt-1 text-lg font-semibold">
            {routine.routine_type === "circuit" ? "Cycles" : "Exercise-specific repeats"}
          </p>
        </div>
        <div className="rounded-md border bg-card p-4 shadow-soft">
          <p className="text-sm font-medium text-muted-foreground">Default cycles</p>
          <p className="mt-1 text-lg font-semibold">{routine.default_cycles}</p>
        </div>
        <div className="rounded-md border bg-card p-4 shadow-soft">
          <p className="text-sm font-medium text-muted-foreground">Exercises</p>
          <p className="mt-1 text-lg font-semibold">{routineExercises?.length ?? 0}</p>
        </div>
      </section>
      <section className={isArchived ? "grid gap-6" : "grid gap-6 xl:grid-cols-[1fr_24rem]"}>
        <div>
          <RoutineExerciseList
            routineId={routine.id}
            routineExercises={routineExercises ?? []}
            readOnly={isArchived}
          />
        </div>
        {!isArchived ? <div>
          <h2 className="mb-3 font-semibold">Add exercise to routine</h2>
          <RoutineExerciseForm
            routineId={routine.id}
            nextPosition={(routineExercises?.length ?? 0) + 1}
            exercises={libraryExercises ?? []}
            initialExerciseId={createdExerciseId}
          />
        </div> : null}
      </section>
      <ArchiveRoutine
        routineId={routine.id}
        routineName={routine.name}
        isArchived={isArchived}
        affectedClients={affectedClients}
      />
    </>
  );
}
