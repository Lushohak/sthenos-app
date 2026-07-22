import { notFound } from "next/navigation";
import { ExternalLink } from "lucide-react";
import { PageHeader } from "@/components/dashboard/page-header";
import { LinkButton } from "@/components/ui/button";
import { ExerciseThumb } from "@/components/exercises/exercise-thumb";
import { getUserOrRedirect } from "@/lib/auth";

type PageProps = {
  params: Promise<{ exerciseId: string }>;
};

export default async function ExerciseDetailPage({ params }: PageProps) {
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
      <PageHeader
        title={exercise.name}
        action={<LinkButton href={`/dashboard/exercises/${exercise.id}/edit`}>Edit exercise</LinkButton>}
      />
      <section className="max-w-2xl">
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
      </section>
    </>
  );
}
