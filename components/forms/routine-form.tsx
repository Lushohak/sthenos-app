import { createRoutineAction } from "@/lib/actions/routines";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";

export function RoutineForm() {
  return (
    <form action={createRoutineAction} className="grid max-w-2xl gap-4">
      <Field label="Routine name">
        <Input name="name" required />
      </Field>
      <Field label="Description">
        <Textarea name="description" />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Routine structure">
          <Select name="routine_type" defaultValue="circuit">
            <option value="circuit">Cycles</option>
            <option value="individual">Exercise-specific repeats</option>
          </Select>
        </Field>
        <Field label="Default cycles">
          <Input name="default_cycles" type="number" min={1} max={12} defaultValue={3} required />
        </Field>
      </div>
      <SubmitButton className="w-fit" pendingLabel="Creating routine...">
        Create routine
      </SubmitButton>
    </form>
  );
}
