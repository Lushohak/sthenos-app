"use client";

import { useState } from "react";
import { createExerciseAction, updateExerciseAction } from "@/lib/actions/exercises";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { MuscleMultiSelect } from "@/components/exercises/muscle-multi-select";
import {
  EXERCISE_CATEGORIES,
  EXERCISE_EQUIPMENT,
  EXERCISE_MOVEMENT_PATTERNS,
  EXERCISE_PRIMARY_MUSCLES
} from "@/lib/exercise-options";
import type { Database } from "@/types/database";

type Exercise = Database["public"]["Tables"]["exercises"]["Row"];

type ExerciseFormProps = {
  exercise?: Exercise;
};

const MAX_THUMBNAIL_SIZE_BYTES = 1024 * 1024;

export function ExerciseForm({ exercise }: ExerciseFormProps) {
  const action = exercise ? updateExerciseAction.bind(null, exercise.id) : createExerciseAction;
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
    <form action={action} className="grid max-w-3xl gap-4">
      <Field label="Title">
        <Input name="name" defaultValue={exercise?.name} required />
      </Field>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Category">
          <Select name="category" defaultValue={exercise?.category ?? EXERCISE_CATEGORIES[0]}>
            {EXERCISE_CATEGORIES.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Difficulty">
          <Select name="difficulty" defaultValue={exercise?.difficulty ?? 1}>
            <option value="1">1 - Beginner</option>
            <option value="2">2 - Easy</option>
            <option value="3">3 - Moderate</option>
            <option value="4">4 - Hard</option>
            <option value="5">5 - Advanced</option>
          </Select>
        </Field>
        <Field label="Equipment">
          <Select name="equipment" defaultValue={exercise?.equipment ?? "None"}>
            {EXERCISE_EQUIPMENT.map((equipment) => (
              <option key={equipment} value={equipment}>
                {equipment}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Movement pattern">
          <Select name="movement_pattern" defaultValue={exercise?.movement_pattern ?? EXERCISE_MOVEMENT_PATTERNS[0]}>
            {EXERCISE_MOVEMENT_PATTERNS.map((pattern) => (
              <option key={pattern} value={pattern}>
                {pattern}
              </option>
            ))}
          </Select>
        </Field>
        <div className="grid gap-2 text-sm font-medium text-foreground">
          <span>Primary muscles</span>
          <MuscleMultiSelect
            name="primary_muscles"
            options={EXERCISE_PRIMARY_MUSCLES}
            defaultValue={exercise?.primary_muscles ?? []}
          />

        </div>
      </div>
      <Field label="Description">
        <Textarea name="description" defaultValue={exercise?.description ?? ""} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2 text-sm font-medium text-foreground">
          <span>Thumbnail image</span>
          <Input
            name="thumbnail_file"
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            aria-invalid={Boolean(thumbnailError)}
            onChange={handleThumbnailChange}
          />
          {thumbnailError ? (
            <span className="text-xs font-normal text-destructive">{thumbnailError}</span>
          ) : (
            <span className="text-xs font-normal text-muted-foreground">Maximum size: 1 MB.</span>
          )}
        </div>
        <Field label="Thumbnail URL">
          <Input name="thumbnail_url" type="url" defaultValue={exercise?.thumbnail_url ?? ""} />
        </Field>
      </div>
      <Field label="Video URL">
        <Input name="video_url" type="url" defaultValue={exercise?.video_url ?? ""} placeholder="https://..." />
      </Field>
      <Field label="Coach notes">
        <Textarea name="notes" defaultValue={exercise?.notes ?? ""} />
      </Field>
      {exercise ? (
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <input name="is_archived" type="checkbox" defaultChecked={exercise.is_archived} />
          Archive this exercise
        </label>
      ) : null}
      <Button type="submit" className="w-fit" disabled={Boolean(thumbnailError)}>
        {exercise ? "Save exercise" : "Create exercise"}
      </Button>
    </form>
  );
}
