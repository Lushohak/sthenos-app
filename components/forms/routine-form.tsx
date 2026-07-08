import { createRoutineAction } from "@/lib/actions/routines";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/field";

export function RoutineForm() {
  return (
    <form action={createRoutineAction} className="grid max-w-2xl gap-4">
      <Field label="Routine name">
        <Input name="name" required />
      </Field>
      <Field label="Description">
        <Textarea name="description" />
      </Field>
      <Button type="submit" className="w-fit">
        Create routine
      </Button>
    </form>
  );
}
