"use client";

import { useState } from "react";
import { createRoutineAction } from "@/lib/actions/routines";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";

export function RoutineForm() {
  const [routineType, setRoutineType] = useState<
    "circuit" | "individual" | "gym"
  >("circuit");

  return (
    <form action={createRoutineAction} className="grid max-w-2xl gap-4">
      <Field label="Routine name">
        <Input
          name="name"
          placeholder={
            routineType === "gym" ? "e.g. Upper body strength" : undefined
          }
          required
        />
      </Field>
      <Field label="Description">
        <Textarea
          name="description"
          placeholder={
            routineType === "gym"
              ? "Describe the workout focus or share any guidance for trainees."
              : undefined
          }
        />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Routine structure">
          <Select
            name="routine_type"
            value={routineType}
            onChange={(event) => {
              const nextType = event.target.value as
                | "circuit"
                | "individual"
                | "gym";
              setRoutineType(nextType);
            }}
          >
            <option value="circuit">Cycles</option>
            <option value="individual">Exercise-specific repeats</option>
            <option value="gym">Gym workout</option>
          </Select>
        </Field>
        {routineType !== "gym" ? (
          <Field label="Default cycles">
            <Input
              name="default_cycles"
              type="number"
              min={1}
              max={12}
              defaultValue={3}
              required
            />
          </Field>
        ) : (
          <div className="rounded-md border border-info/30 bg-info/5 p-3 text-sm text-muted-foreground">
            Gym workouts use sets and reps for each exercise instead of routine
            cycles.
          </div>
        )}
      </div>
      <SubmitButton
        className="w-fit"
        pendingLabel="Creating routine..."
      >
        Create routine
      </SubmitButton>
    </form>
  );
}
