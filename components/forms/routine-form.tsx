"use client";

import { useState } from "react";
import { createRoutineAction } from "@/lib/actions/routines";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";

const MAX_THUMBNAIL_SIZE_BYTES = 1024 * 1024;

export function RoutineForm() {
  const [routineType, setRoutineType] = useState<
    "circuit" | "individual" | "activity" | "gym"
  >("circuit");
  const [thumbnailError, setThumbnailError] = useState<string | null>(null);

  function handleThumbnailChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (file && file.size > MAX_THUMBNAIL_SIZE_BYTES) {
      setThumbnailError("Thumbnail image must be 1 MB or smaller.");
      return;
    }

    setThumbnailError(null);
  }

  return (
    <form action={createRoutineAction} className="grid max-w-2xl gap-4">
      <Field label="Routine name">
        <Input
          name="name"
          placeholder={
            routineType === "activity"
              ? "e.g. Soccer match"
              : routineType === "gym"
                ? "e.g. Upper body strength"
                : undefined
          }
          required
        />
      </Field>
      <Field label="Description">
        <Textarea
          name="description"
          placeholder={
            routineType === "activity"
              ? "Describe the activity or share any guidance for trainees."
              : routineType === "gym"
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
                | "activity"
                | "gym";
              setRoutineType(nextType);
              if (nextType !== "activity") setThumbnailError(null);
            }}
          >
            <option value="circuit">Cycles</option>
            <option value="individual">Exercise-specific repeats</option>
            <option value="gym">Gym workout</option>
            <option value="activity">Activity</option>
          </Select>
        </Field>
        {routineType !== "activity" && routineType !== "gym" ? (
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
        ) : routineType === "activity" ? (
          <div className="rounded-md border border-info/30 bg-info/5 p-3 text-sm text-muted-foreground">
            Activities skip the exercise player and can be logged repeatedly by
            assigned trainees.
          </div>
        ) : (
          <div className="rounded-md border border-info/30 bg-info/5 p-3 text-sm text-muted-foreground">
            Gym workouts use sets and reps for each exercise instead of routine
            cycles.
          </div>
        )}
      </div>
      {routineType === "activity" ? (
        <div className="grid gap-2 text-sm font-medium text-foreground">
          <label htmlFor="activity-thumbnail">Activity thumbnail</label>
          <Input
            id="activity-thumbnail"
            name="thumbnail_file"
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            aria-invalid={Boolean(thumbnailError)}
            onChange={handleThumbnailChange}
          />
          {thumbnailError ? (
            <span className="text-xs font-normal text-destructive">
              {thumbnailError}
            </span>
          ) : (
            <span className="text-xs font-normal text-muted-foreground">
              Optional graphical reference. Maximum size: 1 MB.
            </span>
          )}
        </div>
      ) : null}
      <SubmitButton
        className="w-fit"
        disabled={Boolean(thumbnailError)}
        pendingLabel="Creating routine..."
      >
        Create routine
      </SubmitButton>
    </form>
  );
}
