import { notFound } from "next/navigation";
import { PageHeader } from "@/components/dashboard/page-header";
import { RoutineExerciseForm } from "@/components/forms/routine-exercise-form";
import { Table, Td, Th } from "@/components/ui/table";
import { getUserOrRedirect } from "@/lib/auth";

type PageProps = {
  params: Promise<{ routineId: string }>;
};

export default async function RoutineDetailPage({ params }: PageProps) {
  const { routineId } = await params;
  const { supabase, user } = await getUserOrRedirect();

  const [{ data: routine, error }, { data: exercises }] = await Promise.all([
    supabase
      .from("workout_routines")
      .select("*")
      .eq("coach_id", user.id)
      .eq("id", routineId)
      .single(),
    supabase
      .from("routine_exercises")
      .select("*, exercises(name, category)")
      .eq("routine_id", routineId)
      .order("position")
  ]);

  if (error || !routine) notFound();

  return (
    <>
      <PageHeader title={routine.name} description={routine.description ?? "Build the exercise list for this routine."} />
      <section className="grid gap-6 xl:grid-cols-[1fr_24rem]">
        <div>
          <Table>
            <thead>
              <tr>
                <Th>Order</Th>
                <Th>Exercise</Th>
                <Th>Sets</Th>
                <Th>Reps</Th>
                <Th>Weight</Th>
                <Th>Rest</Th>
                <Th>Notes</Th>
              </tr>
            </thead>
            <tbody>
              {exercises?.map((item) => (
                <tr key={item.id}>
                  <Td>{item.position}</Td>
                  <Td>{Array.isArray(item.exercises) ? item.exercises[0]?.name : item.exercises?.name}</Td>
                  <Td>{item.sets}</Td>
                  <Td>{item.reps}</Td>
                  <Td>{item.target_weight ?? "Not set"}</Td>
                  <Td>{item.rest_seconds ? `${item.rest_seconds}s` : "Not set"}</Td>
                  <Td>{item.notes ?? "No notes"}</Td>
                </tr>
              ))}
              {!exercises?.length ? (
                <tr>
                  <Td colSpan={7}>No exercises yet.</Td>
                </tr>
              ) : null}
            </tbody>
          </Table>
        </div>
        <div>
          <h2 className="mb-3 font-semibold">Add exercise</h2>
          <RoutineExerciseForm routineId={routine.id} nextPosition={(exercises?.length ?? 0) + 1} />
        </div>
      </section>
    </>
  );
}
