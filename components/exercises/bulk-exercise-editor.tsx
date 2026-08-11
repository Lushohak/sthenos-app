"use client";

import { useMemo, useState, useTransition } from "react";
import { CheckCircle2, CopyPlus, Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import {
  bulkCreateLibraryExercisesAction,
  bulkCreateRoutineExercisesAction,
  type RoutinePhase
} from "@/lib/actions/routine-builder";
import {
  EXERCISE_CATEGORIES,
  EXERCISE_EQUIPMENT,
  EXERCISE_MOVEMENT_PATTERNS,
  EXERCISE_PRIMARY_MUSCLES
} from "@/lib/exercise-options";
import { Button, LinkButton } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { Spinner } from "@/components/ui/spinner";
import { Toast } from "@/components/ui/toast";
import { createClient } from "@/lib/supabase/browser";

type ExistingExercise = {
  id: string;
  name: string;
  category: string | null;
  difficulty: number;
  equipment: string | null;
};

type ExerciseRow = {
  key: string;
  name: string;
  category: string;
  difficulty: number;
  equipment: string;
  movementPattern: string;
  primaryMuscles: string[];
  videoUrl: string;
  thumbnail: File | null;
  createAnyway: boolean;
  sets: number;
  reps: string;
  restSeconds: string;
  notes: string;
};

type Defaults = Pick<
  ExerciseRow,
  | "category"
  | "difficulty"
  | "equipment"
  | "movementPattern"
  | "primaryMuscles"
  | "sets"
  | "reps"
  | "restSeconds"
>;

type BulkExerciseEditorProps = {
  coachId: string;
  existingExercises: ExistingExercise[];
  routineId?: string;
  routineType?: "circuit" | "individual" | "gym";
  routinePhase?: RoutinePhase;
};

const MAX_ROWS = 25;

function normalizeName(value: string) {
  return value.trim().replace(/\s+/g, " ").toLocaleLowerCase();
}

function newRow(name: string, defaults: Defaults): ExerciseRow {
  return {
    key: crypto.randomUUID(),
    name,
    category: defaults.category,
    difficulty: defaults.difficulty,
    equipment: defaults.equipment,
    movementPattern: defaults.movementPattern,
    primaryMuscles: defaults.primaryMuscles,
    videoUrl: "",
    thumbnail: null,
    createAnyway: false,
    sets: defaults.sets,
    reps: defaults.reps,
    restSeconds: defaults.restSeconds,
    notes: ""
  };
}

export function BulkExerciseEditor({
  coachId,
  existingExercises,
  routineId,
  routineType,
  routinePhase = "main"
}: BulkExerciseEditorProps) {
  const router = useRouter();
  const [defaults, setDefaults] = useState<Defaults>({
    category: EXERCISE_CATEGORIES[0],
    difficulty: 1,
    equipment: EXERCISE_EQUIPMENT[0],
    movementPattern: EXERCISE_MOVEMENT_PATTERNS[0],
    primaryMuscles: [],
    sets: 3,
    reps: "10",
    restSeconds: ""
  });
  const [pasteValue, setPasteValue] = useState("");
  const [rows, setRows] = useState<ExerciseRow[]>([]);
  const [rowErrors, setRowErrors] = useState<Record<number, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [createdIds, setCreatedIds] = useState<string[]>([]);
  const [toastOpen, setToastOpen] = useState(false);
  const [toastContent, setToastContent] = useState({
    title: "",
    description: ""
  });
  const [isPending, startTransition] = useTransition();
  const existingByName = useMemo(
    () =>
      new Map(
        existingExercises.map((exercise) => [normalizeName(exercise.name), exercise])
      ),
    [existingExercises]
  );

  function updateRow(key: string, update: Partial<ExerciseRow>) {
    setRows((current) =>
      current.map((row) => (row.key === key ? { ...row, ...update } : row))
    );
    setError(null);
    setRowErrors({});
  }

  function addPastedRows() {
    const names = pasteValue
      .split(/\r?\n/)
      .map((name) => name.trim().replace(/\s+/g, " "))
      .filter(Boolean);
    if (!names.length) {
      setError("Enter one exercise name per line.");
      return;
    }
    const availableSlots = MAX_ROWS - rows.length;
    if (availableSlots < 1) {
      setError(`You can create up to ${MAX_ROWS} exercises at a time.`);
      return;
    }
    setRows((current) => [
      ...current,
      ...names.slice(0, availableSlots).map((name) => newRow(name, defaults))
    ]);
    setPasteValue("");
    setError(
      names.length > availableSlots
        ? `Only the first ${availableSlots} names were added. The limit is ${MAX_ROWS}.`
        : null
    );
  }

  function addBlankRow() {
    if (rows.length >= MAX_ROWS) {
      setError(`You can create up to ${MAX_ROWS} exercises at a time.`);
      return;
    }
    setRows((current) => [...current, newRow("", defaults)]);
  }

  function applyDefaultsToRows() {
    setRows((current) =>
      current.map((row) => ({
        ...row,
        category: defaults.category,
        difficulty: defaults.difficulty,
        equipment: defaults.equipment,
        movementPattern: defaults.movementPattern,
        primaryMuscles: defaults.primaryMuscles,
        ...(routineId
          ? {
              sets: defaults.sets,
              reps: defaults.reps,
              restSeconds: defaults.restSeconds
            }
          : {})
      }))
    );
    setToastContent({
      title: "Configuration applied",
      description: routineId
        ? `${rows.length} ${rows.length === 1 ? "row was" : "rows were"} updated with the shared exercise and workload settings.`
        : `${rows.length} ${rows.length === 1 ? "row was" : "rows were"} updated with the shared exercise settings.`
    });
    setToastOpen(true);
  }

  function submitRows() {
    setError(null);
    setRowErrors({});
    setCreatedIds([]);
    if (!rows.length) {
      setError("Add at least one exercise.");
      return;
    }

    const invalidFileIndex = rows.findIndex(
      (row) =>
        row.thumbnail &&
        (row.thumbnail.size > 1024 * 1024 ||
          !["image/png", "image/jpeg", "image/webp", "image/gif"].includes(
            row.thumbnail.type
          ))
    );
    if (invalidFileIndex >= 0) {
      setRowErrors({
        [invalidFileIndex]:
          "Thumbnail must be a PNG, JPEG, WebP, or GIF image no larger than 1 MB."
      });
      setError("Review the highlighted exercise.");
      return;
    }

    const baseRows = rows.map((row) => {
      const duplicate = existingByName.get(normalizeName(row.name));
      return {
        name: row.name,
        category: row.category,
        difficulty: row.difficulty,
        equipment: row.equipment,
        movementPattern: row.movementPattern,
        primaryMuscles: row.primaryMuscles,
        videoUrl: row.videoUrl,
        thumbnailUrl: "",
        existingExerciseId:
          duplicate && !row.createAnyway ? duplicate.id : undefined,
        createAnyway: row.createAnyway,
        sets: row.sets,
        reps: row.reps,
        restSeconds: row.restSeconds,
        notes: row.notes
      };
    });

    startTransition(async () => {
      const supabase = createClient();
      const uploadedPaths: string[] = [];
      try {
        const serializedRows = [...baseRows];
        for (let index = 0; index < rows.length; index += 1) {
          const row = rows[index];
          const duplicate = existingByName.get(normalizeName(row.name));
          if (!row.thumbnail || (duplicate && !row.createAnyway)) continue;

          const extensionByType: Record<string, string> = {
            "image/png": "png",
            "image/jpeg": "jpg",
            "image/webp": "webp",
            "image/gif": "gif"
          };
          const path = `${coachId}/${crypto.randomUUID()}.${extensionByType[row.thumbnail.type]}`;
          const { error: uploadError } = await supabase.storage
            .from("exercise-media")
            .upload(path, row.thumbnail, { cacheControl: "3600", upsert: false });
          if (uploadError) throw new Error(uploadError.message);
          uploadedPaths.push(path);
          serializedRows[index] = {
            ...serializedRows[index],
            thumbnailUrl: supabase.storage.from("exercise-media").getPublicUrl(path)
              .data.publicUrl
          };
        }

        const formData = new FormData();
        formData.set("rows", JSON.stringify(serializedRows));
        const result = routineId
          ? await bulkCreateRoutineExercisesAction(routineId, routinePhase, formData)
          : await bulkCreateLibraryExercisesAction(formData);
        if (!result.success) {
          if (uploadedPaths.length) {
            await supabase.storage.from("exercise-media").remove(uploadedPaths);
          }
          setError(result.message);
          setRowErrors(result.rowErrors ?? {});
          return;
        }

        setCreatedIds(result.ids ?? []);
        setRows([]);
        setPasteValue("");
        setToastContent({
          title: routineId ? "Exercises added" : "Exercises created",
          description: routineId
            ? "The routine draft has been updated."
            : "The exercises are available in your library."
        });
        setToastOpen(true);
        router.refresh();
      } catch (uploadError) {
        if (uploadedPaths.length) {
          await supabase.storage.from("exercise-media").remove(uploadedPaths);
        }
        setError(
          uploadError instanceof Error
            ? uploadError.message
            : "Exercise thumbnails could not be uploaded."
        );
      }
    });
  }

  return (
    <div className="grid gap-5">
      <section className="rounded-xl border bg-card p-4 shadow-soft">
        <div className="flex items-start gap-3">
          <CopyPlus className="mt-1 h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
          <div>
            <h3 className="font-semibold">Paste exercise names</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Enter one name per line. Each name becomes an editable exercise row.
            </p>
          </div>
        </div>
        <Textarea
          className="mt-4"
          value={pasteValue}
          placeholder={"Push-up\nPull-up\nBodyweight squat"}
          onChange={(event) => setPasteValue(event.target.value)}
        />
        <div className="mt-3 flex flex-wrap gap-2">
          <Button type="button" onClick={addPastedRows}>
            Create rows from names
          </Button>
          <Button type="button" variant="secondary" onClick={addBlankRow}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            Add blank row
          </Button>
        </div>
      </section>

      <section className="rounded-xl border bg-card p-4 shadow-soft" aria-labelledby="shared-defaults-heading">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 id="shared-defaults-heading" className="font-semibold">Shared defaults</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              New rows inherit these values. You can override them individually.
            </p>
          </div>
          {rows.length ? (
            <Button type="button" variant="secondary" onClick={applyDefaultsToRows}>
              Apply to all rows
            </Button>
          ) : null}
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Field label="Category">
            <Select
              value={defaults.category}
              onChange={(event) =>
                setDefaults((current) => ({ ...current, category: event.target.value }))
              }
            >
              {EXERCISE_CATEGORIES.map((option) => (
                <option key={option}>{option}</option>
              ))}
            </Select>
          </Field>
          <Field label="Difficulty">
            <Select
              value={defaults.difficulty}
              onChange={(event) =>
                setDefaults((current) => ({
                  ...current,
                  difficulty: Number(event.target.value)
                }))
              }
            >
              {[1, 2, 3, 4, 5].map((value) => (
                <option key={value} value={value}>{value}</option>
              ))}
            </Select>
          </Field>
          <Field label="Equipment">
            <Select
              value={defaults.equipment}
              onChange={(event) =>
                setDefaults((current) => ({ ...current, equipment: event.target.value }))
              }
            >
              {EXERCISE_EQUIPMENT.map((option) => (
                <option key={option}>{option}</option>
              ))}
            </Select>
          </Field>
          <Field label="Movement pattern">
            <Select
              value={defaults.movementPattern}
              onChange={(event) =>
                setDefaults((current) => ({
                  ...current,
                  movementPattern: event.target.value
                }))
              }
            >
              {EXERCISE_MOVEMENT_PATTERNS.map((option) => (
                <option key={option}>{option}</option>
              ))}
            </Select>
          </Field>
        </div>
        {routineId ? (
          <div className={`mt-4 grid gap-4 ${routineType === "gym" && routinePhase === "main" ? "sm:grid-cols-3" : "sm:grid-cols-2"}`}>
            {routineType === "gym" && routinePhase === "main" ? (
              <Field label="Sets">
                <Input type="number" min={1} max={20} value={defaults.sets} onChange={(event) => setDefaults((current) => ({ ...current, sets: Number(event.target.value) }))} />
              </Field>
            ) : null}
            <Field label="Reps">
              <Input value={defaults.reps} onChange={(event) => setDefaults((current) => ({ ...current, reps: event.target.value }))} />
            </Field>
            <Field label="Rest seconds">
              <Input type="number" min={0} value={defaults.restSeconds} onChange={(event) => setDefaults((current) => ({ ...current, restSeconds: event.target.value }))} />
            </Field>
          </div>
        ) : null}
        <fieldset className="mt-4">
          <legend className="text-sm font-medium">Primary muscles</legend>
          <div className="mt-2 flex max-h-36 flex-wrap gap-2 overflow-y-auto rounded-md border bg-background-secondary p-3">
            {EXERCISE_PRIMARY_MUSCLES.map((muscle) => (
              <label key={muscle} className="inline-flex cursor-pointer items-center gap-2 rounded-full border bg-card px-3 py-1.5 text-xs">
                <input
                  type="checkbox"
                  checked={defaults.primaryMuscles.includes(muscle)}
                  onChange={() =>
                    setDefaults((current) => ({
                      ...current,
                      primaryMuscles: current.primaryMuscles.includes(muscle)
                        ? current.primaryMuscles.filter((item) => item !== muscle)
                        : [...current.primaryMuscles, muscle]
                    }))
                  }
                />
                {muscle}
              </label>
            ))}
          </div>
        </fieldset>
      </section>

      {rows.length ? (
        <section className="grid gap-3" aria-label="Exercises to create">
          <div className="flex items-center justify-between gap-3">
            <h3 className="font-semibold">Exercise rows</h3>
            <span className="text-sm text-muted-foreground">{rows.length} of {MAX_ROWS}</span>
          </div>
          {rows.map((row, index) => {
            const duplicate = existingByName.get(normalizeName(row.name));
            return (
              <details
                key={row.key}
                className="group rounded-xl border bg-card shadow-soft open:border-border-emphasis"
                open={index === 0 || Boolean(rowErrors[index])}
              >
                <summary className="flex cursor-pointer list-none items-center gap-3 p-4">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-semibold">
                    {index + 1}
                  </span>
                  <span className="min-w-0 flex-1 truncate font-medium">
                    {row.name || "Untitled exercise"}
                  </span>
                  {duplicate && !row.createAnyway ? (
                    <span className="rounded-full bg-info/10 px-2.5 py-1 text-xs font-medium text-info">
                      Reusing library exercise
                    </span>
                  ) : null}
                  <Button
                    type="button"
                    variant="ghost"
                    className="h-8 w-8 px-0"
                    aria-label={`Remove exercise ${index + 1}`}
                    onClick={(event) => {
                      event.preventDefault();
                      setRows((current) => current.filter((item) => item.key !== row.key));
                    }}
                  >
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                  </Button>
                </summary>
                <div className="grid gap-4 border-t p-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <Field label="Exercise name">
                      <Input
                        value={row.name}
                        required
                        onChange={(event) => updateRow(row.key, { name: event.target.value })}
                      />
                    </Field>
                    <Field label="Thumbnail" hint="Optional. PNG, JPEG, WebP, or GIF up to 1 MB.">
                      <Input
                        type="file"
                        accept="image/png,image/jpeg,image/webp,image/gif"
                        disabled={Boolean(duplicate && !row.createAnyway)}
                        onChange={(event) =>
                          updateRow(row.key, { thumbnail: event.target.files?.[0] ?? null })
                        }
                      />
                    </Field>
                  </div>
                  {duplicate ? (
                    <div className="rounded-lg border border-info/30 bg-info/5 p-3 text-sm">
                      <p className="font-medium">{duplicate.name} already exists in your library.</p>
                      <p className="mt-1 text-muted-foreground">
                        It will be reused by default so your library stays organized.
                      </p>
                      <label className="mt-3 inline-flex items-center gap-2 font-medium">
                        <input
                          type="checkbox"
                          checked={row.createAnyway}
                          onChange={(event) =>
                            updateRow(row.key, { createAnyway: event.target.checked })
                          }
                        />
                        Create a separate exercise anyway
                      </label>
                    </div>
                  ) : null}
                  <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                    <Field label="Category">
                      <Select value={row.category} onChange={(event) => updateRow(row.key, { category: event.target.value })} disabled={Boolean(duplicate && !row.createAnyway)}>
                        {EXERCISE_CATEGORIES.map((option) => <option key={option}>{option}</option>)}
                      </Select>
                    </Field>
                    <Field label="Difficulty">
                      <Select value={row.difficulty} onChange={(event) => updateRow(row.key, { difficulty: Number(event.target.value) })} disabled={Boolean(duplicate && !row.createAnyway)}>
                        {[1, 2, 3, 4, 5].map((value) => <option key={value} value={value}>{value}</option>)}
                      </Select>
                    </Field>
                    <Field label="Equipment">
                      <Select value={row.equipment} onChange={(event) => updateRow(row.key, { equipment: event.target.value })} disabled={Boolean(duplicate && !row.createAnyway)}>
                        {EXERCISE_EQUIPMENT.map((option) => <option key={option}>{option}</option>)}
                      </Select>
                    </Field>
                    <Field label="Movement pattern">
                      <Select value={row.movementPattern} onChange={(event) => updateRow(row.key, { movementPattern: event.target.value })} disabled={Boolean(duplicate && !row.createAnyway)}>
                        {EXERCISE_MOVEMENT_PATTERNS.map((option) => <option key={option}>{option}</option>)}
                      </Select>
                    </Field>
                  </div>
                  <Field label="Primary muscles">
                    <div className="flex max-h-36 flex-wrap gap-2 overflow-y-auto rounded-md border bg-background-secondary p-3">
                      {EXERCISE_PRIMARY_MUSCLES.map((muscle) => (
                        <label key={muscle} className="inline-flex items-center gap-2 rounded-full border bg-card px-3 py-1.5 text-xs">
                          <input
                            type="checkbox"
                            checked={row.primaryMuscles.includes(muscle)}
                            disabled={Boolean(duplicate && !row.createAnyway)}
                            onChange={() =>
                              updateRow(row.key, {
                                primaryMuscles: row.primaryMuscles.includes(muscle)
                                  ? row.primaryMuscles.filter((item) => item !== muscle)
                                  : [...row.primaryMuscles, muscle]
                              })
                            }
                          />
                          {muscle}
                        </label>
                      ))}
                    </div>
                  </Field>
                  <Field label="Video URL">
                    <Input type="url" value={row.videoUrl} disabled={Boolean(duplicate && !row.createAnyway)} placeholder="https://..." onChange={(event) => updateRow(row.key, { videoUrl: event.target.value })} />
                  </Field>
                  {routineId ? (
                    <div className={`grid gap-4 ${routineType === "gym" && routinePhase === "main" ? "sm:grid-cols-3" : "sm:grid-cols-2"}`}>
                      {routineType === "gym" && routinePhase === "main" ? (
                        <Field label="Sets">
                          <Input type="number" min={1} max={20} value={row.sets} onChange={(event) => updateRow(row.key, { sets: Number(event.target.value) })} />
                        </Field>
                      ) : null}
                      <Field label="Reps">
                        <Input value={row.reps} onChange={(event) => updateRow(row.key, { reps: event.target.value })} />
                      </Field>
                      <Field label="Rest seconds">
                        <Input type="number" min={0} value={row.restSeconds} onChange={(event) => updateRow(row.key, { restSeconds: event.target.value })} />
                      </Field>
                      <div className="sm:col-span-full">
                        <Field label="Routine instructions">
                          <Textarea value={row.notes} onChange={(event) => updateRow(row.key, { notes: event.target.value })} />
                        </Field>
                      </div>
                    </div>
                  ) : null}
                  {rowErrors[index] ? (
                    <p className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive" role="alert">
                      {rowErrors[index]}
                    </p>
                  ) : null}
                </div>
              </details>
            );
          })}
        </section>
      ) : null}

      {error ? (
        <p className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}

      {rows.length ? (
        <div className="sticky bottom-4 z-10 flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card/95 p-4 shadow-xl backdrop-blur">
          <p className="text-sm text-muted-foreground">
            {rows.length} {rows.length === 1 ? "exercise" : "exercises"} ready
          </p>
          <Button type="button" disabled={isPending} onClick={submitRows}>
            {isPending ? <Spinner className="h-4 w-4" label="Creating exercises" /> : <Plus className="h-4 w-4" aria-hidden="true" />}
            {isPending
              ? "Creating exercises..."
              : routineId
                ? "Create and add to routine"
                : "Create exercises"}
          </Button>
        </div>
      ) : null}

      {!routineId && createdIds.length ? (
        <section className="rounded-xl border border-success/30 bg-success/5 p-5">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="mt-0.5 h-5 w-5 text-success" aria-hidden="true" />
            <div>
              <h3 className="font-semibold">Exercises are ready</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Keep managing your library or start a routine with these exercises already selected.
              </p>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <LinkButton href="/dashboard/exercises" variant="secondary">Return to library</LinkButton>
            <LinkButton href={`/dashboard/routines/new?exerciseIds=${encodeURIComponent(createdIds.join(","))}`}>
              Start routine with exercises
            </LinkButton>
          </div>
        </section>
      ) : null}

      <Toast
        open={toastOpen}
        onOpenChange={setToastOpen}
        title={toastContent.title}
        description={toastContent.description}
        variant="success"
      />
    </div>
  );
}
