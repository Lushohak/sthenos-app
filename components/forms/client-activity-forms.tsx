"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import {
  createWorkoutLogAction,
  type WorkoutLogState
} from "@/lib/actions/clients";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { Toast } from "@/components/ui/toast";
import type { RoutineLogAssignment } from "@/lib/client-roster";

type Props = {
  clientId: string;
  assignments: RoutineLogAssignment[];
  today?: string;
  requireExplicitRoutineChoice?: boolean;
  onSuccess?: () => void;
};

const initialState: WorkoutLogState = {
  status: "idle",
  message: ""
};

export function WorkoutLogForm({
  clientId,
  assignments,
  today = new Date().toISOString().slice(0, 10),
  requireExplicitRoutineChoice = false,
  onSuccess
}: Props) {
  const formRef = useRef<HTMLFormElement>(null);
  const [toastOpen, setToastOpen] = useState(false);
  const [state, formAction] = useActionState(
    createWorkoutLogAction.bind(null, clientId),
    initialState
  );
  const defaultRoutineId = assignments.length === 1
    ? assignments[0].routineId
    : assignments.length === 0 || !requireExplicitRoutineChoice
      ? "unstructured"
      : "";

  useEffect(() => {
    if (state.status !== "success") return;
    formRef.current?.reset();
    setToastOpen(true);
    onSuccess?.();
  }, [onSuccess, state]);

  return (
    <>
    <form ref={formRef} action={formAction} className="grid gap-4 rounded-md border bg-card p-4 shadow-soft">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Date trained">
          <Input name="trained_on" type="date" defaultValue={today} max={today} required />
        </Field>
        <Field label="Routine">
          <Select name="routine_id" defaultValue={defaultRoutineId} required={requireExplicitRoutineChoice && assignments.length > 1}>
            {requireExplicitRoutineChoice && assignments.length > 1 ? (
              <option value="" disabled>Choose a routine or unstructured workout</option>
            ) : null}
            <option value="unstructured">Unstructured workout</option>
            {assignments.map((assignment) =>
              <option key={assignment.id} value={assignment.routineId}>
                {assignment.routineName}
              </option>
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
      {state.status === "error" ? (
        <p className="rounded-md border border-destructive/25 bg-destructive/5 px-3 py-2 text-sm text-destructive" role="alert">
          {state.message}
        </p>
      ) : null}
      <SubmitButton className="w-fit" pendingLabel="Saving workout...">
        Mark completed
      </SubmitButton>
    </form>
    <Toast
      open={toastOpen}
      onOpenChange={setToastOpen}
      title="Workout logged"
      description={state.message}
      variant="success"
    />
    </>
  );
}
