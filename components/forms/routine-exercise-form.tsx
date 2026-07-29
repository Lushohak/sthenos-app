"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus, Search } from "lucide-react";
import { addRoutineExerciseAction } from "@/lib/actions/routines";
import { Field, Input, Textarea } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { LinkButton } from "@/components/ui/button";
import { ExerciseThumb } from "@/components/exercises/exercise-thumb";
import type { Database } from "@/types/database";

type Exercise = Database["public"]["Tables"]["exercises"]["Row"];

type RoutineExerciseFormProps = {
  routineId: string;
  nextPosition: number;
  exercises: Exercise[];
  initialExerciseId?: string;
};

export function RoutineExerciseForm({
  routineId,
  nextPosition,
  exercises,
  initialExerciseId
}: RoutineExerciseFormProps) {
  const [query, setQuery] = useState("");
  const [selectedExerciseId, setSelectedExerciseId] = useState(
    exercises.some((exercise) => exercise.id === initialExerciseId)
      ? initialExerciseId ?? ""
      : ""
  );
  const normalizedQuery = query.trim().toLowerCase();
  const filteredExercises = useMemo(() => {
    if (!normalizedQuery) return exercises;

    return exercises.filter((exercise) =>
      [
        exercise.name,
        exercise.category,
        exercise.equipment,
        exercise.movement_pattern,
        ...exercise.primary_muscles
      ]
        .filter(Boolean)
        .some((value) => value?.toLowerCase().includes(normalizedQuery))
    );
  }, [exercises, normalizedQuery]);

  useEffect(() => {
    if (
      selectedExerciseId &&
      !filteredExercises.some((exercise) => exercise.id === selectedExerciseId)
    ) {
      setSelectedExerciseId("");
    }
  }, [filteredExercises, selectedExerciseId]);

  return (
    <form action={addRoutineExerciseAction.bind(null, routineId)} className="grid gap-4 rounded-md border bg-white p-4 shadow-soft">
      <input name="position" type="hidden" value={nextPosition} />
      <div className="grid gap-2">
        <label htmlFor="exercise-search" className="text-sm font-medium">
          Search exercises
        </label>
        <div className="relative">
          <Search
            className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            id="exercise-search"
            type="search"
            value={query}
            className="pl-9"
            placeholder="Search by name, category, equipment..."
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") event.preventDefault();
            }}
          />
        </div>
        {exercises.length ? (
          <p className="text-xs text-muted-foreground" aria-live="polite">
            Showing {filteredExercises.length} of {exercises.length} exercises
          </p>
        ) : null}
      </div>
      <fieldset className="grid gap-3">
        <legend className="text-sm font-medium">Choose an exercise</legend>
        <div className="grid max-h-[28rem] gap-3 overflow-y-auto pr-1">
          {filteredExercises.map((exercise) => (
            <label key={exercise.id} className="grid cursor-pointer grid-cols-[6rem_1fr] gap-3 rounded-md border bg-white p-2 transition has-[:checked]:border-primary has-[:checked]:ring-2 has-[:checked]:ring-primary/15">
              <input
                className="sr-only"
                name="exercise_id"
                type="radio"
                value={exercise.id}
                checked={selectedExerciseId === exercise.id}
                required
                onChange={() => setSelectedExerciseId(exercise.id)}
              />
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
              Your exercise library is empty.
            </p>
          ) : null}
          {exercises.length && !filteredExercises.length ? (
            <p className="rounded-md border border-dashed bg-muted/40 px-3 py-4 text-center text-sm text-muted-foreground">
              No exercises match &ldquo;{query.trim()}&rdquo;.
            </p>
          ) : null}
        </div>
      </fieldset>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Reps">
          <Input name="reps" defaultValue="10" required />
        </Field>
        <Field label="Rest sec">
          <Input name="rest_seconds" type="number" min={0} placeholder="90" />
        </Field>
      </div>
      <Field label="Notes">
        <Textarea name="notes" />
      </Field>
      <SubmitButton
        className="w-fit"
        disabled={!selectedExerciseId}
        pendingLabel="Adding to routine..."
      >
        Add exercise to routine
      </SubmitButton>
      <div className="grid gap-3 border-t pt-4">
        <div>
          <p className="text-sm font-medium">Can&apos;t find the exercise you need?</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Create it in your exercise library, then return here to add it to this routine.
          </p>
        </div>
        <LinkButton
          href={`/dashboard/exercises/new?returnTo=${encodeURIComponent(`/dashboard/routines/${routineId}`)}`}
          variant="secondary"
          className="w-fit"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          Create new exercise
        </LinkButton>
      </div>
    </form>
  );
}
