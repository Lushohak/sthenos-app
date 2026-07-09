import { notFound } from "next/navigation";
import { PageHeader } from "@/components/dashboard/page-header";
import { ExerciseForm } from "@/components/exercises/exercise-form";
import { getUserOrRedirect } from "@/lib/auth";

type PageProps = {
  params: Promise<{ exerciseId: string }>;
};

export default async function EditExercisePage({ params }: PageProps) {
  const { exerciseId } = await params;
  const { supabase, user } = await getUserOrRedirect();
  const { data: exercise, error } = await supabase
    .from("exercises")
    .select("*")
    .eq("coach_id", user.id)
    .eq("id", exerciseId)
    .single();

  if (error || !exercise) notFound();

  return (
    <>
      <PageHeader title="Edit exercise" description="Update library movement details." />
      <ExerciseForm exercise={exercise} />
    </>
  );
}
