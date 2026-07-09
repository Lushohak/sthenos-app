import Link from "next/link";
import { Search } from "lucide-react";
import { PageHeader } from "@/components/dashboard/page-header";
import { LinkButton } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { ExerciseThumb } from "@/components/exercises/exercise-thumb";
import { getUserOrRedirect } from "@/lib/auth";

type PageProps = {
  searchParams?: Promise<{ q?: string }>;
};

export default async function ExercisesPage({ searchParams }: PageProps) {
  const { supabase, user } = await getUserOrRedirect();
  const query = (await searchParams)?.q?.trim() ?? "";
  let request = supabase
    .from("exercises")
    .select("*")
    .eq("coach_id", user.id)
    .eq("is_archived", false)
    .order("name");

  if (query) {
    const safeQuery = query.replaceAll(",", " ");
    request = request.or(`name.ilike.%${safeQuery}%,category.ilike.%${safeQuery}%,equipment.ilike.%${safeQuery}%,movement_pattern.ilike.%${safeQuery}%`);
  }

  const { data: exercises, error } = await request;

  if (error) throw new Error(error.message);

  return (
    <>
      <PageHeader
        title="Exercises"
        description="Manage reusable movements for routine creation."
        action={<LinkButton href="/dashboard/exercises/new">New exercise</LinkButton>}
      />
      <form className="mb-4 flex max-w-xl gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground" aria-hidden="true" />
          <Input name="q" defaultValue={query} className="pl-9" placeholder="Search exercises" />
        </div>
      </form>
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {exercises?.map((exercise) => (
          <Link
            key={exercise.id}
            href={`/dashboard/exercises/${exercise.id}`}
            className="rounded-md border bg-white p-3 shadow-soft transition hover:border-primary"
          >
            <ExerciseThumb src={exercise.thumbnail_url} alt={exercise.name} />
            <div className="mt-3">
              <h2 className="font-semibold">{exercise.name}</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Difficulty {exercise.difficulty} · {exercise.category ?? "Uncategorized"}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {exercise.equipment ?? "No equipment"} · {exercise.movement_pattern ?? "No pattern"}
              </p>
            </div>
          </Link>
        ))}
        {!exercises?.length ? (
          <div className="rounded-md border bg-white p-4 text-sm text-muted-foreground shadow-soft">
            No exercises found.
          </div>
        ) : null}
      </section>
    </>
  );
}
