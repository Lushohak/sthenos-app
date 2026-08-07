import { createWorkoutLogAction } from "@/lib/actions/clients";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import type { Database } from "@/types/database";

type Routine = Database["public"]["Tables"]["workout_routines"]["Row"];
type Assignment = Database["public"]["Tables"]["client_routines"]["Row"] & {
  workout_routines: Pick<Routine, "id" | "name"> | null;
};

type Props = {
  clientId: string;
  routines: Routine[];
  assignments: Assignment[];
};

export function WorkoutLogForm({ clientId, assignments }: Pick<Props, "clientId" | "assignments">) {
  return (
    <form action={createWorkoutLogAction.bind(null, clientId)} className="grid gap-4 rounded-md border bg-card p-4 shadow-soft">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Date trained">
          <Input name="trained_on" type="date" defaultValue={new Date().toISOString().slice(0, 10)} required />
        </Field>
        <Field label="Routine">
          <Select name="routine_id">
            <option value="">No routine</option>
            {assignments.map((assignment) =>
              assignment.workout_routines ? (
                <option key={assignment.id} value={assignment.workout_routines.id}>
                  {assignment.workout_routines.name}
                </option>
              ) : null
            )}
          </Select>
        </Field>
      </div>
      <Field label="Duration in minutes" hint="Optional">
        <Input
          name="duration_minutes"
          type="number"
          min={1}
          max={1440}
          inputMode="numeric"
        />
      </Field>
      <Field label="Notes">
        <Textarea name="notes" />
      </Field>
      <SubmitButton className="w-fit" pendingLabel="Saving workout...">
        Mark completed
      </SubmitButton>
    </form>
  );
}
