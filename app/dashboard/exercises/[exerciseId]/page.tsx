import Link from "next/link";
import { notFound } from "next/navigation";
import { ExternalLink } from "lucide-react";
import { PageHeader } from "@/components/dashboard/page-header";
import { LinkButton } from "@/components/ui/button";
import { ExerciseThumb } from "@/components/exercises/exercise-thumb";
import { ProgressionForm } from "@/components/exercises/progression-form";
import { Table, Td, Th } from "@/components/ui/table";
import { getUserOrRedirect } from "@/lib/auth";

type PageProps = {
  params: Promise<{ exerciseId: string }>;
};

export default async function ExerciseDetailPage({ params }: PageProps) {
  const { exerciseId } = await params;
  const { supabase, user } = await getUserOrRedirect();
  const [{ data: exercise, error }, { data: allExercises }, { data: progressions }] =
    await Promise.all([
      supabase
        .from("exercises")
        .select("*")
        .eq("coach_id", user.id)
        .eq("id", exerciseId)
        .single(),
      supabase
        .from("exercises")
        .select("*")
        .eq("coach_id", user.id)
        .eq("is_archived", false)
        .order("name"),
      supabase
        .from("exercise_progressions")
        .select("id, relationship, related_exercise_id, exercises!exercise_progressions_related_exercise_id_fkey(id, name, difficulty, thumbnail_url)")
        .eq("coach_id", user.id)
        .eq("exercise_id", exerciseId)
    ]);

  if (error || !exercise) notFound();

  return (
    <>
      <PageHeader
        title={exercise.name}
        description={exercise.description ?? "No description yet."}
        action={<LinkButton href={`/dashboard/exercises/${exercise.id}/edit`}>Edit exercise</LinkButton>}
      />
      <section className="grid gap-6 lg:grid-cols-[24rem_1fr]">
        <div className="rounded-md border bg-white p-4 shadow-soft">
          <ExerciseThumb src={exercise.thumbnail_url} alt={exercise.name} />
          <dl className="mt-4 grid gap-3 text-sm">
            <div>
              <dt className="text-muted-foreground">Difficulty</dt>
              <dd>{exercise.difficulty} / 5</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Category</dt>
              <dd>{exercise.category ?? "Not set"}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Equipment</dt>
              <dd>{exercise.equipment ?? "Not set"}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Movement pattern</dt>
              <dd>{exercise.movement_pattern ?? "Not set"}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Primary muscles</dt>
              <dd>{exercise.primary_muscles.length ? exercise.primary_muscles.join(", ") : "Not set"}</dd>
            </div>
            {exercise.video_url ? (
              <div>
                <dt className="text-muted-foreground">Video</dt>
                <dd>
                  <a className="inline-flex items-center gap-1 text-primary" href={exercise.video_url} target="_blank" rel="noreferrer">
                    Open video <ExternalLink className="h-3 w-3" aria-hidden="true" />
                  </a>
                </dd>
              </div>
            ) : null}
          </dl>
        </div>
        <div className="grid gap-6">
          <section>
            <h2 className="mb-3 text-lg font-semibold">Progressions</h2>
            <Table>
              <thead>
                <tr>
                  <Th>Relationship</Th>
                  <Th>Exercise</Th>
                  <Th>Difficulty</Th>
                </tr>
              </thead>
              <tbody>
                {progressions?.map((progression) => {
                  const related = Array.isArray(progression.exercises)
                    ? progression.exercises[0]
                    : progression.exercises;
                  return (
                    <tr key={progression.id}>
                      <Td className="capitalize">{progression.relationship}</Td>
                      <Td>
                        {related ? (
                          <Link className="font-medium text-primary" href={`/dashboard/exercises/${related.id}`}>
                            {related.name}
                          </Link>
                        ) : (
                          "Unknown"
                        )}
                      </Td>
                      <Td>{related?.difficulty ?? "Not set"}</Td>
                    </tr>
                  );
                })}
                {!progressions?.length ? (
                  <tr>
                    <Td colSpan={3}>No progressions linked yet.</Td>
                  </tr>
                ) : null}
              </tbody>
            </Table>
          </section>
          <section>
            <h2 className="mb-3 text-lg font-semibold">Add progression</h2>
            <ProgressionForm exerciseId={exercise.id} exercises={allExercises ?? []} />
          </section>
        </div>
      </section>
    </>
  );
}
