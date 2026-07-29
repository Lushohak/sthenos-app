import { PageHeader } from "@/components/dashboard/page-header";
import { ExerciseForm } from "@/components/exercises/exercise-form";

type PageProps = {
  searchParams?: Promise<{ returnTo?: string }>;
};

export default async function NewExercisePage({ searchParams }: PageProps) {
  const requestedReturnTo = (await searchParams)?.returnTo;
  const returnTo =
    requestedReturnTo &&
    /^\/dashboard\/routines\/[0-9a-f-]{36}$/i.test(requestedReturnTo)
      ? requestedReturnTo
      : undefined;

  return (
    <>
      <PageHeader
        title="New exercise"
        description={
          returnTo
            ? "Create a reusable movement, then return to your routine."
            : "Create a reusable movement for your library."
        }
      />
      <ExerciseForm returnTo={returnTo} />
    </>
  );
}
