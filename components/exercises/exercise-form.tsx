import { createExerciseAction, updateExerciseAction } from "@/lib/actions/exercises";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import type { Database } from "@/types/database";

type Exercise = Database["public"]["Tables"]["exercises"]["Row"];

type ExerciseFormProps = {
  exercise?: Exercise;
};

export function ExerciseForm({ exercise }: ExerciseFormProps) {
  const action = exercise ? updateExerciseAction.bind(null, exercise.id) : createExerciseAction;

  return (
    <form action={action} className="grid max-w-3xl gap-4" encType="multipart/form-data">
      <Field label="Title">
        <Input name="name" defaultValue={exercise?.name} required />
      </Field>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Category">
          <Input name="category" defaultValue={exercise?.category ?? ""} placeholder="Strength" />
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
          <Input name="equipment" defaultValue={exercise?.equipment ?? ""} placeholder="Dumbbells" />
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Movement pattern">
          <Input name="movement_pattern" defaultValue={exercise?.movement_pattern ?? ""} placeholder="Squat, hinge, push" />
        </Field>
        <Field label="Primary muscles" hint="Separate multiple muscles with commas.">
          <Input name="primary_muscles" defaultValue={exercise?.primary_muscles.join(", ") ?? ""} placeholder="Quads, glutes" />
        </Field>
      </div>
      <Field label="Description">
        <Textarea name="description" defaultValue={exercise?.description ?? ""} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Thumbnail image">
          <Input name="thumbnail_file" type="file" accept="image/png,image/jpeg,image/webp,image/gif" />
        </Field>
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
      <Button type="submit" className="w-fit">
        {exercise ? "Save exercise" : "Create exercise"}
      </Button>
    </form>
  );
}
