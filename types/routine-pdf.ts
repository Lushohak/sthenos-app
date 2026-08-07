export type RoutinePdfExercise = {
  name: string;
  category: string | null;
  equipment: string | null;
  thumbnailUrl: string | null;
  sets: number;
  reps: string;
  restSeconds: number | null;
  notes: string | null;
};

export type RoutinePdfData = {
  traineeName: string;
  routineName: string;
  routineDescription: string | null;
  assignmentNotes: string | null;
  routineType: "circuit" | "individual" | "gym";
  defaultCycles: number;
  exercises: RoutinePdfExercise[];
};
