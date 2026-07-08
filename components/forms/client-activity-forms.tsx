import {
  assignRoutineAction,
  createBodyProgressAction,
  createWorkoutLogAction
} from "@/lib/actions/clients";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
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

export function AssignRoutineForm({ clientId, routines }: Pick<Props, "clientId" | "routines">) {
  return (
    <form action={assignRoutineAction.bind(null, clientId)} className="grid gap-4 rounded-md border bg-white p-4 shadow-soft">
      <Field label="Routine">
        <Select name="routine_id" required>
          <option value="">Select a routine</option>
          {routines.map((routine) => (
            <option key={routine.id} value={routine.id}>
              {routine.name}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Assignment notes">
        <Textarea name="notes" />
      </Field>
      <Button type="submit" className="w-fit">
        Assign routine
      </Button>
    </form>
  );
}

export function WorkoutLogForm({ clientId, assignments }: Pick<Props, "clientId" | "assignments">) {
  return (
    <form action={createWorkoutLogAction.bind(null, clientId)} className="grid gap-4 rounded-md border bg-white p-4 shadow-soft">
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
      <Field label="Notes">
        <Textarea name="notes" />
      </Field>
      <Button type="submit" className="w-fit">
        Mark completed
      </Button>
    </form>
  );
}

export function BodyProgressForm({ clientId }: Pick<Props, "clientId">) {
  return (
    <form action={createBodyProgressAction.bind(null, clientId)} className="grid gap-4 rounded-md border bg-white p-4 shadow-soft">
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Recorded on">
          <Input name="recorded_on" type="date" defaultValue={new Date().toISOString().slice(0, 10)} required />
        </Field>
        <Field label="Body weight">
          <Input name="body_weight" type="number" min="1" step="0.1" required />
        </Field>
        <Field label="Body fat %">
          <Input name="body_fat_percentage" type="number" min="0" max="100" step="0.1" />
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-4">
        <Field label="Waist">
          <Input name="waist" type="number" min="1" step="0.1" />
        </Field>
        <Field label="Chest">
          <Input name="chest" type="number" min="1" step="0.1" />
        </Field>
        <Field label="Arms">
          <Input name="arms" type="number" min="1" step="0.1" />
        </Field>
        <Field label="Legs">
          <Input name="legs" type="number" min="1" step="0.1" />
        </Field>
      </div>
      <Field label="Notes">
        <Textarea name="notes" />
      </Field>
      <Button type="submit" className="w-fit">
        Add progress
      </Button>
      {/* TODO: Add progress photo uploads with Supabase Storage here. */}
      {/* TODO: Add AI progress insights once enough history exists. */}
    </form>
  );
}
