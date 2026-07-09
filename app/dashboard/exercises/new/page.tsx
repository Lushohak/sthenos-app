import { PageHeader } from "@/components/dashboard/page-header";
import { ExerciseForm } from "@/components/exercises/exercise-form";

export default function NewExercisePage() {
  return (
    <>
      <PageHeader title="New exercise" description="Create a reusable movement for your library." />
      <ExerciseForm />
    </>
  );
}
