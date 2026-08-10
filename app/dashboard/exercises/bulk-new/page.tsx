import { PageHeader } from "@/components/dashboard/page-header";
import { BulkExerciseEditor } from "@/components/exercises/bulk-exercise-editor";
import { LinkButton } from "@/components/ui/button";
import { getUserOrRedirect } from "@/lib/auth";

export default async function BulkCreateExercisesPage() {
  const { supabase, user } = await getUserOrRedirect();
  const { data: exercises, error } = await supabase
    .from("exercises")
    .select("id, name, category, difficulty, equipment")
    .eq("coach_id", user.id)
    .is("archived_at", null)
    .order("name");
  if (error) throw new Error(error.message);

  return (
    <>
      <PageHeader
        title="Bulk create exercises"
        description="Create up to 25 reusable exercises, then optionally start a routine with them."
        action={
          <LinkButton href="/dashboard/exercises" variant="secondary">
            Back to library
          </LinkButton>
        }
      />
      <BulkExerciseEditor coachId={user.id} existingExercises={exercises ?? []} />
    </>
  );
}
