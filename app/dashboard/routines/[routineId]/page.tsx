import { notFound, redirect } from "next/navigation";
import { PageHeader } from "@/components/dashboard/page-header";
import { RoutineExerciseList } from "@/components/forms/routine-exercise-list";
import { ArchiveRoutine } from "@/components/routines/archive-routine";
import { RoutineBuilder } from "@/components/routines/routine-builder";
import { getUserOrRedirect } from "@/lib/auth";

type BuilderStep = "details" | "exercises" | "configure" | "review" | "assign";

type PageProps = {
  params: Promise<{ routineId: string }>;
  searchParams?: Promise<{ step?: string }>;
};

const builderSteps = new Set<BuilderStep>([
  "details",
  "exercises",
  "configure",
  "review",
  "assign"
]);

export default async function RoutineDetailPage({ params, searchParams }: PageProps) {
  const [{ routineId }, resolvedSearchParams] = await Promise.all([
    params,
    searchParams
  ]);
  const requestedStep = resolvedSearchParams?.step as BuilderStep | undefined;
  const initialStep = requestedStep && builderSteps.has(requestedStep)
    ? requestedStep
    : undefined;
  const { supabase, user } = await getUserOrRedirect();

  const [
    { data: routine, error },
    { data: routineExercises },
    { data: libraryExercises },
    { data: existingAssignments },
    { data: trainees }
  ] = await Promise.all([
    supabase
      .from("workout_routines")
      .select("*")
      .eq("coach_id", user.id)
      .eq("id", routineId)
      .single(),
    supabase
      .from("routine_exercises")
      .select("*, exercises(id, name, category, difficulty, thumbnail_url, archived_at)")
      .eq("routine_id", routineId)
      .order("position"),
    supabase
      .from("exercises")
      .select("id, name, category, difficulty, equipment, movement_pattern, primary_muscles, thumbnail_url")
      .eq("coach_id", user.id)
      .is("archived_at", null)
      .order("name"),
    supabase
      .from("client_routines")
      .select("client_id, status, clients(id, name)")
      .eq("coach_id", user.id)
      .eq("routine_id", routineId)
      .in("status", ["active", "paused"]),
    supabase
      .from("clients")
      .select("id, name, email")
      .eq("coach_id", user.id)
      .eq("status", "active")
      .order("name")
  ]);

  if (error || !routine) {
    const { data: migratedActivity } = await supabase
      .from("activities")
      .select("id")
      .eq("id", routineId)
      .eq("coach_id", user.id)
      .maybeSingle();
    if (migratedActivity) redirect(`/dashboard/activities/${migratedActivity.id}`);
    notFound();
  }

  const isArchived = Boolean(routine.archived_at);
  const affectedClients = (existingAssignments ?? []).flatMap((assignment) => {
    const client = Array.isArray(assignment.clients)
      ? assignment.clients[0]
      : assignment.clients;
    return client ? [{ id: client.id, name: client.name }] : [];
  });
  const assignmentStatusByClient = new Map(
    (existingAssignments ?? []).map((assignment) => [
      assignment.client_id,
      assignment.status as "active" | "paused"
    ])
  );
  const assignableTrainees = (trainees ?? []).map((trainee) => ({
    ...trainee,
    existingAssignmentStatus: assignmentStatusByClient.get(trainee.id) ?? null
  }));

  return (
    <>
      <PageHeader
        title={routine.name}
        description={
          isArchived
            ? "This routine is archived and available in read-only mode."
            : routine.status === "draft"
              ? "Draft routine · Your progress saves automatically."
              : "Build, configure, and assign this routine from one workspace."
        }
      />

      {isArchived ? (
        <>
          <div className="mb-6 rounded-md border border-info/30 bg-info/5 px-4 py-3 text-sm text-info shadow-soft">
            Archived routines cannot be edited or assigned until they are restored.
            Existing trainee assignments remain available.
          </div>
          <section className="mb-6 grid gap-4 sm:grid-cols-3">
            <div className="rounded-md border bg-card p-4 shadow-soft">
              <p className="text-sm font-medium text-muted-foreground">Structure</p>
              <p className="mt-1 text-lg font-semibold">
                {routine.routine_type === "gym"
                  ? "Gym workout"
                  : routine.routine_type === "circuit"
                    ? "Cycles"
                    : "Exercise-specific repeats"}
              </p>
            </div>
            <div className="rounded-md border bg-card p-4 shadow-soft">
              <p className="text-sm font-medium text-muted-foreground">Status</p>
              <p className="mt-1 text-lg font-semibold">Archived</p>
            </div>
            <div className="rounded-md border bg-card p-4 shadow-soft">
              <p className="text-sm font-medium text-muted-foreground">Exercises</p>
              <p className="mt-1 text-lg font-semibold">{routineExercises?.length ?? 0}</p>
            </div>
          </section>
          {routine.warmup_notes || routine.workout_notes || routine.cooldown_notes ? (
            <section className="mb-6 grid gap-3 rounded-xl border bg-card p-4 shadow-soft">
              <h2 className="font-semibold">Phase guidance</h2>
              {routine.warmup_notes ? <div><p className="text-sm font-medium">Warm-up</p><p className="mt-1 text-sm text-muted-foreground">{routine.warmup_notes}</p></div> : null}
              {routine.workout_notes ? <div><p className="text-sm font-medium">Main workout</p><p className="mt-1 text-sm text-muted-foreground">{routine.workout_notes}</p></div> : null}
              {routine.cooldown_notes ? <div><p className="text-sm font-medium">Cool-down</p><p className="mt-1 text-sm text-muted-foreground">{routine.cooldown_notes}</p></div> : null}
            </section>
          ) : null}
          <RoutineExerciseList
            routineId={routine.id}
            routineExercises={routineExercises ?? []}
            readOnly
            showSets={routine.routine_type === "gym"}
          />
        </>
      ) : (
        <RoutineBuilder
          coachId={user.id}
          routine={routine}
          routineExercises={routineExercises ?? []}
          libraryExercises={libraryExercises ?? []}
          trainees={assignableTrainees}
          affectedTraineeCount={affectedClients.length}
          initialStep={initialStep}
        />
      )}

      {routine.status === "published" ? (
        <ArchiveRoutine
          routineId={routine.id}
          routineName={routine.name}
          isArchived={isArchived}
          affectedClients={affectedClients}
        />
      ) : null}
    </>
  );
}
