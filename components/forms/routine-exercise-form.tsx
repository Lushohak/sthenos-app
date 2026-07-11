"use client";

import { useState } from "react";
import { addRoutineExerciseAction } from "@/lib/actions/routines";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { ExerciseThumb } from "@/components/exercises/exercise-thumb";
import type { Database } from "@/types/database";

type Exercise = Database["public"]["Tables"]["exercises"]["Row"];

type RoutineExerciseFormProps = {
  routineId: string;
  nextPosition: number;
  exercises: Exercise[];
  routineType: "circuit" | "individual";
  defaultCycles: number;
};

export function RoutineExerciseForm({
  routineId,
  nextPosition,
  exercises,
  routineType,
  defaultCycles
}: RoutineExerciseFormProps) {
  const [loadType, setLoadType] = useState<"weighted" | "bodyweight">("weighted");

  return (
    <form action={addRoutineExerciseAction.bind(null, routineId)} className="grid gap-4 rounded-md border bg-white p-4 shadow-soft">
      <fieldset className="grid gap-3">
        <legend className="text-sm font-medium">Exercise</legend>
        <div className="grid max-h-[28rem] gap-3 overflow-y-auto pr-1">
          {exercises.map((exercise) => (
            <label key={exercise.id} className="grid cursor-pointer grid-cols-[6rem_1fr] gap-3 rounded-md border bg-white p-2 transition has-[:checked]:border-primary has-[:checked]:ring-2 has-[:checked]:ring-primary/15">
              <input className="sr-only" name="exercise_id" type="radio" value={exercise.id} required />
              <ExerciseThumb src={exercise.thumbnail_url} alt={exercise.name} className="h-20 w-24" />
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold">{exercise.name}</span>
                <span className="mt-1 block text-xs text-muted-foreground">Difficulty {exercise.difficulty} · {exercise.category ?? "Uncategorized"}</span>
                <span className="mt-1 block text-xs text-muted-foreground">{exercise.equipment ?? "No equipment"}</span>
              </span>
            </label>
          ))}
          {!exercises.length ? (
            <p className="rounded-md border bg-muted px-3 py-2 text-sm text-muted-foreground">
              Create an exercise in the library before adding it to a routine.
            </p>
          ) : null}
        </div>
      </fieldset>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Cycle">
          <Input name="cycle_number" type="number" min={1} max={12} defaultValue={1} required />
        </Field>
        <Field label={routineType === "circuit" ? "Routine cycles" : "Exercise repeats"}>
          <Input
            name="repeat_count"
            type="number"
            min={1}
            max={20}
            defaultValue={routineType === "circuit" ? defaultCycles : 1}
            required
          />
        </Field>
        <Field label="Order">
          <Input name="position" type="number" min={1} defaultValue={nextPosition} required />
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-5">
        <Field label="Sets">
          <Input name="sets" type="number" min={1} defaultValue={3} required />
        </Field>
        <Field label="Reps">
          <Input name="reps" defaultValue="10" required />
        </Field>
        <Field label="Load">
          <Select
            name="load_type"
            value={loadType}
            onChange={(event) => setLoadType(event.target.value as "weighted" | "bodyweight")}
          >
            <option value="weighted">Weighted</option>
            <option value="bodyweight">Bodyweight</option>
          </Select>
        </Field>
        <Field label="Weight (kg)">
          <Input
            name="target_weight"
            placeholder="80"
            disabled={loadType === "bodyweight"}
            aria-disabled={loadType === "bodyweight"}
          />
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
