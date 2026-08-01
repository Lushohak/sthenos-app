import { notFound } from "next/navigation";
import { PageHeader } from "@/components/dashboard/page-header";
import { RoutineExerciseForm } from "@/components/forms/routine-exercise-form";
import { RoutineExerciseList } from "@/components/forms/routine-exercise-list";
import { LinkButton } from "@/components/ui/button";
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

  const [{ data: routine, error }, { data: routineExercises }, { data: libraryExercises }] = await Promise.all([
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
      .order("name")
  ]);

  if (error || !routine) notFound();

  return (
    <>
      <PageHeader
        title={routine.name}
        description={routine.description ?? "Build the exercise list for this routine."}
        action={
          <LinkButton href={`/dashboard/routines/${routine.id}/assign`}>
            Assign trainees
          </LinkButton>
        }
      />
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
      <section className="grid gap-6 xl:grid-cols-[1fr_24rem]">
        <div>
          <RoutineExerciseList routineId={routine.id} routineExercises={routineExercises ?? []} />
        </div>
        <div>
          <h2 className="mb-3 font-semibold">Add exercise to routine</h2>
          <RoutineExerciseForm
            routineId={routine.id}
            nextPosition={(routineExercises?.length ?? 0) + 1}
            exercises={libraryExercises ?? []}
            initialExerciseId={createdExerciseId}
          />
        </div>
      </section>
    </>
  );
}
