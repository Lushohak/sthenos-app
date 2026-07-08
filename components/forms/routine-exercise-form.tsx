import { addRoutineExerciseAction } from "@/lib/actions/routines";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/field";

type RoutineExerciseFormProps = {
  routineId: string;
  nextPosition: number;
};

export function RoutineExerciseForm({ routineId, nextPosition }: RoutineExerciseFormProps) {
  return (
    <form action={addRoutineExerciseAction.bind(null, routineId)} className="grid gap-4 rounded-md border bg-white p-4 shadow-soft">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Exercise">
          <Input name="exercise_name" required />
        </Field>
        <Field label="Category">
          <Input name="category" placeholder="Strength, cardio, mobility" />
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-5">
        <Field label="Order">
          <Input name="position" type="number" min={1} defaultValue={nextPosition} required />
        </Field>
        <Field label="Sets">
          <Input name="sets" type="number" min={1} defaultValue={3} required />
        </Field>
        <Field label="Reps">
          <Input name="reps" defaultValue="10" required />
        </Field>
        <Field label="Weight">
          <Input name="target_weight" placeholder="80 kg" />
        </Field>
        <Field label="Rest sec">
          <Input name="rest_seconds" type="number" min={0} placeholder="90" />
        </Field>
      </div>
      <Field label="Notes">
        <Textarea name="notes" />
      </Field>
      <Button type="submit" className="w-fit">
        Add exercise
      </Button>
    </form>
  );
}
