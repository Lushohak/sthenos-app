import { PageHeader } from "@/components/dashboard/page-header";
import { LinkButton } from "@/components/ui/button";
import {
  ExerciseBrowser,
  type ExerciseSortMode
} from "@/components/exercises/exercise-browser";
import { ExerciseArchivedToast } from "@/components/exercises/exercise-archived-toast";
import { getUserOrRedirect } from "@/lib/auth";

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function firstValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function listValue(value: string | string[] | undefined) {
  return (Array.isArray(value) ? value : value ? [value] : [])
    .flatMap((item) => item.split(","))
    .map((item) => item.trim())
    .filter(Boolean);
}

export default async function ExercisesPage({ searchParams }: PageProps) {
  const { supabase, user } = await getUserOrRedirect();
  const resolvedSearchParams = await searchParams;
  const query = firstValue(resolvedSearchParams?.q).trim();
  const archivedExerciseName = firstValue(resolvedSearchParams?.archived).trim();
  const requestedSort = firstValue(resolvedSearchParams?.sort);
  const sort: ExerciseSortMode = ["name", "recent", "difficulty"].includes(requestedSort)
    ? requestedSort as ExerciseSortMode
    : "name";
  const request = supabase
    .from("exercises")
    .select("*")
    .eq("coach_id", user.id)
    .is("archived_at", null)
    .order("name");

  const { data: exercises, error } = await request;

  if (error) throw new Error(error.message);

  return (
    <>
      <PageHeader
        title="Exercise Library"
        description="Manage reusable movements for routine creation."
        action={
          <div className="flex flex-wrap gap-2">
            <LinkButton href="/dashboard/exercises/bulk-new" variant="secondary">
              Bulk create
            </LinkButton>
            <LinkButton href="/dashboard/exercises/new">New exercise</LinkButton>
          </div>
        }
      />
      <ExerciseBrowser
        mode="library"
        exercises={(exercises ?? []).map((exercise) => ({
          id: exercise.id,
          name: exercise.name,
          category: exercise.category,
          difficulty: exercise.difficulty,
          equipment: exercise.equipment,
          movementPattern: exercise.movement_pattern,
          primaryMuscles: exercise.primary_muscles,
          thumbnailUrl: exercise.thumbnail_url,
          createdAt: exercise.created_at
        }))}
        initialFilters={{
          query,
          categories: listValue(resolvedSearchParams?.category),
          equipment: listValue(resolvedSearchParams?.equipment),
          difficulties: listValue(resolvedSearchParams?.difficulty),
          movementPatterns: listValue(resolvedSearchParams?.pattern),
          primaryMuscles: listValue(resolvedSearchParams?.muscle),
          sort
        }}
        syncFiltersToUrl
      />
      {archivedExerciseName ? (
        <ExerciseArchivedToast exerciseName={archivedExerciseName} />
      ) : null}
    </>
  );
}
