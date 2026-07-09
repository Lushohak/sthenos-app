import { addExerciseProgressionAction } from "@/lib/actions/exercises";
import { Button } from "@/components/ui/button";
import { Field, Select } from "@/components/ui/field";
import type { Database } from "@/types/database";

type Exercise = Database["public"]["Tables"]["exercises"]["Row"];

type ProgressionFormProps = {
  exerciseId: string;
  exercises: Exercise[];
};

export function ProgressionForm({ exerciseId, exercises }: ProgressionFormProps) {
  return (
    <form action={addExerciseProgressionAction.bind(null, exerciseId)} className="grid gap-4 rounded-md border bg-white p-4 shadow-soft">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Relationship">
          <Select name="relationship" defaultValue="easier">
            <option value="easier">Easier variation</option>
            <option value="harder">Harder variation</option>
          </Select>
        </Field>
        <Field label="Exercise">
          <Select name="related_exercise_id" required>
            <option value="">Select exercise</option>
            {exercises
              .filter((exercise) => exercise.id !== exerciseId)
              .map((exercise) => (
                <option key={exercise.id} value={exercise.id}>
                  {exercise.name}
                </option>
              ))}
          </Select>
        </Field>
      </div>
      <Button type="submit" className="w-fit">
        Add progression
      </Button>
    </form>
  );
}
