"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import {
  assignRoutineAction,
  type AssignRoutineState
} from "@/lib/actions/clients";
import { Field, Select, Textarea } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { Toast } from "@/components/ui/toast";
import type { Database } from "@/types/database";

type Routine = Database["public"]["Tables"]["workout_routines"]["Row"];

type AssignRoutineFormProps = {
  clientId: string;
  clientName: string;
  routines: Routine[];
};

const initialState: AssignRoutineState = {
  status: "idle",
  message: ""
};

export function AssignRoutineForm({
  clientId,
  clientName,
  routines
}: AssignRoutineFormProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const [isToastOpen, setIsToastOpen] = useState(false);
  const [state, formAction] = useActionState(
    assignRoutineAction.bind(null, clientId),
    initialState
  );

  useEffect(() => {
    if (state.status !== "success") return;

    formRef.current?.reset();
    setIsToastOpen(true);
  }, [state]);

  return (
    <>
      <form
        ref={formRef}
        action={formAction}
        className="grid gap-4 rounded-md border bg-white p-4 shadow-soft"
        onSubmit={() => setIsToastOpen(false)}
      >
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
        {state.status === "error" ? (
          <p
            className="rounded-md border border-destructive/25 bg-destructive/5 px-3 py-2 text-sm text-destructive"
            role="alert"
          >
            {state.message}
          </p>
        ) : null}
        <SubmitButton className="w-fit" pendingLabel="Assigning routine...">
          Assign routine
        </SubmitButton>
      </form>

      <Toast
        open={isToastOpen}
        onOpenChange={setIsToastOpen}
        title="Routine assigned"
        description={`${state.routineName ?? "The routine"} is now assigned to ${clientName}.`}
        variant="success"
      />
    </>
  );
}
