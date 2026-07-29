import { notFound } from "next/navigation";
import { PageHeader } from "@/components/dashboard/page-header";
import { ArchiveExercise } from "@/components/exercises/archive-exercise";
import { ExerciseForm } from "@/components/exercises/exercise-form";
import { getUserOrRedirect } from "@/lib/auth";

type PageProps = {
  params: Promise<{ exerciseId: string }>;
};

export default async function EditExercisePage({ params }: PageProps) {
  const { exerciseId } = await params;
  const { supabase, user } = await getUserOrRedirect();
  const [
    { data: exercise, error },
    { data: routineReferences, error: routineReferencesError }
  ] = await Promise.all([
    supabase
      .from("exercises")
      .select("*")
      .eq("coach_id", user.id)
      .eq("id", exerciseId)
      .is("archived_at", null)
      .single(),
    supabase
      .from("routine_exercises")
      .select("routine_id, workout_routines(id, name)")
      .eq("exercise_id", exerciseId)
  ]);

  if (error || !exercise) notFound();
  if (routineReferencesError) throw new Error(routineReferencesError.message);

  const affectedRoutines = Array.from(
    new Map(
      (routineReferences ?? []).flatMap((reference) => {
        const routine = Array.isArray(reference.workout_routines)
          ? reference.workout_routines[0]
          : reference.workout_routines;

        return routine ? [[routine.id, routine] as const] : [];
      })
    ).values()
  ).sort((a, b) => a.name.localeCompare(b.name));

  return (
    <>
      <PageHeader title="Edit exercise" description="Update library movement details." />
      <ExerciseForm exercise={exercise} />
      <ArchiveExercise
        exerciseId={exercise.id}
        exerciseName={exercise.name}
        affectedRoutines={affectedRoutines}
      />
    </>
  );
}
