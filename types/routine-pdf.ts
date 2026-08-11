export type RoutinePdfExercise = {
  name: string;
  category: string | null;
  equipment: string | null;
  thumbnailUrl: string | null;
  phase: "warmup" | "main" | "cooldown";
  sets: number;
  reps: string;
  restSeconds: number | null;
  notes: string | null;
};

export type RoutinePdfData = {
  traineeName: string;
  routineName: string;
  routineDescription: string | null;
  warmupNotes: string | null;
  workoutNotes: string | null;
  cooldownNotes: string | null;
  assignmentNotes: string | null;
  routineType: "circuit" | "individual" | "gym";
  defaultCycles: number;
  exercises: RoutinePdfExercise[];
};
