import { notFound } from "next/navigation";
import { PageHeader } from "@/components/dashboard/page-header";
import { RoutineExerciseForm } from "@/components/forms/routine-exercise-form";
import { RoutineExerciseList } from "@/components/forms/routine-exercise-list";
import { getUserOrRedirect } from "@/lib/auth";

type PageProps = {
  params: Promise<{ routineId: string }>;
};

export default async function RoutineDetailPage({ params }: PageProps) {
  const { routineId } = await params;
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
      .select("*, exercises(name, category, difficulty, thumbnail_url)")
      .eq("routine_id", routineId)
      .order("position"),
    supabase
      .from("exercises")
      .select("*")
      .eq("coach_id", user.id)
      .order("name")
  ]);

  if (error || !routine) notFound();

  return (
    <>
      <PageHeader title={routine.name} description={routine.description ?? "Build the exercise list for this routine."} />
      <section className="mb-6 grid gap-4 sm:grid-cols-3">
        <div className="rounded-md border bg-white p-4 shadow-soft">
          <p className="text-sm font-medium text-muted-foreground">Structure</p>
          <p className="mt-1 text-lg font-semibold">
            {routine.routine_type === "circuit" ? "Cycles" : "Exercise-specific repeats"}
          </p>
        </div>
        <div className="rounded-md border bg-white p-4 shadow-soft">
          <p className="text-sm font-medium text-muted-foreground">Default cycles</p>
          <p className="mt-1 text-lg font-semibold">{routine.default_cycles}</p>
        </div>
        <div className="rounded-md border bg-white p-4 shadow-soft">
          <p className="text-sm font-medium text-muted-foreground">Exercises</p>
          <p className="mt-1 text-lg font-semibold">{routineExercises?.length ?? 0}</p>
        </div>
      </section>
      <section className="grid gap-6 xl:grid-cols-[1fr_24rem]">
        <div>
          <RoutineExerciseList routineId={routine.id} routineExercises={routineExercises ?? []} />
        </div>
        <div>
          <h2 className="mb-3 font-semibold">Add exercise</h2>
          <RoutineExerciseForm
            routineId={routine.id}
            nextPosition={(routineExercises?.length ?? 0) + 1}
            exercises={libraryExercises ?? []}
          />
        </div>
      </section>
    </>
  );
}
