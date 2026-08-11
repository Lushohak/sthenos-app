import { notFound } from "next/navigation";
import {
  WorkoutPlayer,
  type WorkoutPlayerExercise
} from "@/components/trainee/workout-player";
import { getTraineeOrRedirect } from "@/lib/trainee";

type PageProps = {
  params: Promise<{ assignmentId: string }>;
};

function routinePhaseRank(value: unknown) {
  return value === "warmup" ? 0 : value === "cooldown" ? 2 : 1;
}

export default async function TraineeWorkoutPage({ params }: PageProps) {
  const { assignmentId } = await params;
  const { supabase, client } = await getTraineeOrRedirect();
  const { data: assignment, error } = await supabase
    .from("client_routines")
    .select(
      "id, status, notes, workout_routines(id, name, description, warmup_notes, workout_notes, cooldown_notes, routine_type, default_cycles, routine_exercises(id, position, phase, sets, reps, rest_seconds, notes, exercises(id, name, category, equipment, thumbnail_url, video_url)))"
    )
    .eq("id", assignmentId)
    .eq("client_id", client.id)
    .single();

  if (error || !assignment || assignment.status !== "active") {
    notFound();
  }

  const routine = Array.isArray(assignment.workout_routines)
    ? assignment.workout_routines[0]
    : assignment.workout_routines;

  if (!routine) {
    notFound();
  }

  const exercises: WorkoutPlayerExercise[] = [...(routine.routine_exercises ?? [])]
    .sort((a, b) => routinePhaseRank(a.phase) - routinePhaseRank(b.phase) || a.position - b.position)
    .map((item) => {
      const exercise = Array.isArray(item.exercises)
        ? item.exercises[0]
        : item.exercises;

      if (!exercise) return null;

      return {
        id: item.id,
        name: exercise.name,
        category: exercise.category,
        equipment: exercise.equipment,
        thumbnailUrl: exercise.thumbnail_url,
        videoUrl: exercise.video_url,
        phase: item.phase,
        sets: item.sets,
        reps: item.reps,
        restSeconds: item.rest_seconds,
        notes: item.notes
      };
    })
    .filter((exercise): exercise is WorkoutPlayerExercise => exercise !== null);

  return (
    <WorkoutPlayer
      assignmentId={assignment.id}
      routineId={routine.id}
      routineName={routine.name}
      routineDescription={routine.description}
      warmupNotes={routine.warmup_notes}
      workoutNotes={routine.workout_notes}
      cooldownNotes={routine.cooldown_notes}
      assignmentNotes={assignment.notes}
      routineType={routine.routine_type}
      defaultCycles={routine.default_cycles}
      exercises={exercises}
      today={new Date().toISOString().slice(0, 10)}
    />
  );
}
