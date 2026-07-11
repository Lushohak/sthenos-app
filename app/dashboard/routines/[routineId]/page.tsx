import { notFound } from "next/navigation";
import { Trash2 } from "lucide-react";
import { PageHeader } from "@/components/dashboard/page-header";
import { RoutineExerciseForm } from "@/components/forms/routine-exercise-form";
import { ExerciseThumb } from "@/components/exercises/exercise-thumb";
import { Button } from "@/components/ui/button";
import { Table, Td, Th } from "@/components/ui/table";
import { getUserOrRedirect } from "@/lib/auth";
import { removeRoutineExerciseAction } from "@/lib/actions/routines";

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
      .order("cycle_number")
      .order("position"),
    supabase
      .from("exercises")
      .select("*")
      .eq("coach_id", user.id)
      .eq("is_archived", false)
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
          <Table>
            <thead>
              <tr>
                <Th>Order</Th>
                <Th>Cycle</Th>
                <Th>Exercise</Th>
                <Th>{routine.routine_type === "circuit" ? "Cycles" : "Repeats"}</Th>
                <Th>Sets</Th>
                <Th>Reps</Th>
                <Th>Weight</Th>
                <Th>Rest</Th>
                <Th>Notes</Th>
                <Th>Remove</Th>
              </tr>
            </thead>
            <tbody>
              {routineExercises?.map((item) => {
                const exercise = Array.isArray(item.exercises) ? item.exercises[0] : item.exercises;
                return (
                  <tr key={item.id}>
                    <Td>{item.position}</Td>
                    <Td>{item.cycle_number}</Td>
                    <Td>
                      <div className="flex min-w-56 items-center gap-3">
                        <ExerciseThumb src={exercise?.thumbnail_url} alt={exercise?.name ?? "Exercise"} className="h-14 w-20" />
                        <div>
                          <p className="font-medium">{exercise?.name ?? "Exercise"}</p>
                          <p className="text-xs text-muted-foreground">Difficulty {exercise?.difficulty ?? "?"}</p>
                        </div>
                      </div>
                    </Td>
                    <Td>{item.repeat_count}</Td>
                    <Td>{item.sets}</Td>
                    <Td>{item.reps}</Td>
                    <Td>{item.load_type === "bodyweight" ? "Bodyweight" : item.target_weight ? `${item.target_weight} kg` : "Not set"}</Td>
                    <Td>{item.rest_seconds ? `${item.rest_seconds}s` : "Not set"}</Td>
                    <Td>{item.notes ?? "No notes"}</Td>
                    <Td>
                      <form action={removeRoutineExerciseAction.bind(null, routine.id, item.id)}>
                        <Button type="submit" variant="ghost" className="h-8 w-8 px-0" aria-label={`Remove ${exercise?.name ?? "exercise"}`}>
                          <Trash2 className="h-4 w-4" aria-hidden="true" />
                        </Button>
                      </form>
                    </Td>
                  </tr>
                );
              })}
              {!routineExercises?.length ? (
                <tr>
                  <Td colSpan={10}>No exercises yet.</Td>
                </tr>
              ) : null}
            </tbody>
          </Table>
        </div>
        <div>
          <h2 className="mb-3 font-semibold">Add exercise</h2>
          <RoutineExerciseForm
            routineId={routine.id}
            nextPosition={(routineExercises?.length ?? 0) + 1}
            exercises={libraryExercises ?? []}
            routineType={routine.routine_type}
            defaultCycles={routine.default_cycles}
          />
        </div>
      </section>
    </>
  );
}
