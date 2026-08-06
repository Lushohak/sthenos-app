"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import {
  assignRoutineAction,
  type AssignRoutineState
} from "@/lib/actions/clients";
import { RoutineMultiSelect } from "@/components/forms/routine-multi-select";
import { Field, Textarea } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { Toast } from "@/components/ui/toast";
import type { Database } from "@/types/database";

type Routine = Database["public"]["Tables"]["workout_routines"]["Row"];

type AssignRoutineFormProps = {
  clientId: string;
  clientName: string;
  routines: Routine[];
  assignedRoutineIds?: string[];
};

const initialState: AssignRoutineState = {
  status: "idle",
  message: "",
  assignedCount: 0,
  skippedCount: 0
};

export function AssignRoutineForm({
  clientId,
  clientName,
  routines,
  assignedRoutineIds = []
}: AssignRoutineFormProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const [isToastOpen, setIsToastOpen] = useState(false);
  const [selectionVersion, setSelectionVersion] = useState(0);
  const [selectedCount, setSelectedCount] = useState(0);
  const [state, formAction] = useActionState(
    assignRoutineAction.bind(null, clientId),
    initialState
  );

  useEffect(() => {
    if (state.status !== "success") return;

    formRef.current?.reset();
    setSelectionVersion((current) => current + 1);
    setSelectedCount(0);
    setIsToastOpen(true);
  }, [state]);

  const routineOptions = routines.map((routine) => ({
    id: routine.id,
    name: routine.name,
    disabled: assignedRoutineIds.includes(routine.id)
  }));

  const availableRoutineCount = routineOptions.filter(
    (routine) => !routine.disabled
  ).length;

  const toastDescription =
    state.assignedCount === 1 && state.routineNames?.[0]
      ? `${state.routineNames[0]} is now assigned to ${clientName}.`
      : `${state.assignedCount} routines are now assigned to ${clientName}.`;

  return (
    <>
      <form
        ref={formRef}
        action={formAction}
        className="grid gap-4 rounded-md border bg-card p-4 shadow-soft"
        onSubmit={() => setIsToastOpen(false)}
      >
        <div className="grid gap-2 text-sm font-medium text-foreground">
          <span>Routines</span>
          <RoutineMultiSelect
            key={selectionVersion}
            name="routine_ids"
            options={routineOptions}
            onSelectionChange={(selectedIds) =>
              setSelectedCount(selectedIds.length)
            }
          />
          <span className="text-xs font-normal text-muted-foreground">
            {availableRoutineCount > 0
              ? "Choose one or more routines. The menu stays open while you select."
              : "All active routines are already assigned to this trainee."}
          </span>
        </div>
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
        <SubmitButton
          className="w-fit"
          disabled={selectedCount === 0}
          pendingLabel="Assigning routines..."
        >
          {selectedCount === 1
            ? "Assign 1 routine"
            : `Assign ${selectedCount} routines`}
        </SubmitButton>
      </form>

      <Toast
        open={isToastOpen}
        onOpenChange={setIsToastOpen}
        title={state.assignedCount === 1 ? "Routine assigned" : "Routines assigned"}
        description={`${toastDescription}${
          state.skippedCount
            ? ` ${state.skippedCount} already-assigned ${
                state.skippedCount === 1 ? "routine was" : "routines were"
              } skipped.`
            : ""
        }`}
        variant="success"
      />
    </>
  );
}
