"use server";

import { revalidatePath } from "next/cache";
import { getUserOrRedirect } from "@/lib/auth";
import type { Json } from "@/types/database";

export type RoutineBuilderResult =
  | { success: true; message?: string; ids?: string[] }
  | { success: false; message: string; rowErrors?: Record<number, string> };

export type RoutinePhase = "warmup" | "main" | "cooldown";

export type RoutineDetailsInput = {
  name: string;
  description: string;
  warmupNotes: string;
  workoutNotes: string;
  cooldownNotes: string;
  routineType: "circuit" | "individual" | "gym";
  defaultCycles: number;
};

export type RoutineExerciseConfigInput = {
  sets: number;
  reps: string;
  restSeconds: number | null;
  notes: string;
  phase: RoutinePhase;
};

type BulkExerciseRow = {
  name: string;
  category: string;
  difficulty: number;
  equipment: string;
  movementPattern: string;
  primaryMuscles: string[];
  videoUrl: string;
  thumbnailUrl: string;
  existingExerciseId?: string;
  createAnyway?: boolean;
  sets: number;
  reps: string;
  restSeconds: number | null;
  notes: string;
};

const MAX_BULK_EXERCISES = 25;
function normalizeName(value: string) {
  return value.trim().replace(/\s+/g, " ").toLocaleLowerCase();
}

function optionalText(value: string) {
  const normalized = value.trim();
  return normalized || null;
}

function isRoutinePhase(value: string): value is RoutinePhase {
  return value === "warmup" || value === "main" || value === "cooldown";
}

function isValidVideoUrl(value: string) {
  if (!value.trim()) return true;
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function isOwnedThumbnailUrl(value: string, coachId: string) {
  if (!value) return true;
  try {
    const url = new URL(value);
    const marker = "/storage/v1/object/public/exercise-media/";
    const storedPath = decodeURIComponent(url.pathname.split(marker)[1] ?? "");
    return storedPath.startsWith(`${coachId}/`);
  } catch {
    return false;
  }
}

function parseBulkRows(formData: FormData):
  | { success: true; rows: BulkExerciseRow[] }
  | { success: false; result: RoutineBuilderResult } {
  let rawRows: unknown;
  try {
    rawRows = JSON.parse(String(formData.get("rows") ?? "[]"));
  } catch {
    return {
      success: false,
      result: { success: false, message: "The exercise list could not be read." }
    };
  }

  if (!Array.isArray(rawRows) || rawRows.length < 1) {
    return {
      success: false,
      result: { success: false, message: "Add at least one exercise." }
    };
  }

  if (rawRows.length > MAX_BULK_EXERCISES) {
    return {
      success: false,
      result: {
        success: false,
        message: `Add no more than ${MAX_BULK_EXERCISES} exercises at a time.`
      }
    };
  }

  const rowErrors: Record<number, string> = {};
  const rows = rawRows.map((rawRow, index) => {
    const source =
      typeof rawRow === "object" && rawRow !== null
        ? (rawRow as Record<string, unknown>)
        : {};
    const name = String(source.name ?? "").trim().replace(/\s+/g, " ");
    const videoUrl = String(source.videoUrl ?? "").trim();
    const difficulty = Number(source.difficulty ?? 1);
    const sets = Number(source.sets ?? 3);
    const restValue = source.restSeconds;
    const restSeconds =
      restValue === null || restValue === undefined || restValue === ""
        ? null
        : Number(restValue);

    if (!name) rowErrors[index] = "Exercise name is required.";
    else if (!Number.isFinite(difficulty) || difficulty < 1 || difficulty > 5) {
      rowErrors[index] = "Difficulty must be between 1 and 5.";
    } else if (!Number.isFinite(sets) || sets < 1 || sets > 20) {
      rowErrors[index] = "Sets must be between 1 and 20.";
    } else if (
      restSeconds !== null &&
      (!Number.isFinite(restSeconds) || restSeconds < 0)
    ) {
      rowErrors[index] = "Rest time cannot be negative.";
    } else if (!String(source.reps ?? "10").trim()) {
      rowErrors[index] = "Reps are required.";
    } else if (!isValidVideoUrl(videoUrl)) {
      rowErrors[index] = "Enter a valid http or https video URL.";
    }

    return {
      name,
      category: String(source.category ?? ""),
      difficulty,
      equipment: String(source.equipment ?? ""),
      movementPattern: String(source.movementPattern ?? ""),
      primaryMuscles: Array.isArray(source.primaryMuscles)
        ? source.primaryMuscles.map(String).filter(Boolean)
        : [],
      videoUrl,
      thumbnailUrl: String(source.thumbnailUrl ?? ""),
      existingExerciseId: source.existingExerciseId
        ? String(source.existingExerciseId)
        : undefined,
      createAnyway: Boolean(source.createAnyway),
      sets,
      reps: String(source.reps ?? "10").trim(),
      restSeconds,
      notes: String(source.notes ?? "")
    };
  });

  const namesSeen = new Set<string>();
  rows.forEach((row, index) => {
    const normalized = normalizeName(row.name);
    if (!rowErrors[index] && namesSeen.has(normalized) && !row.createAnyway) {
      rowErrors[index] = "This name is already included in the batch.";
    }
    namesSeen.add(normalized);
  });

  if (Object.keys(rowErrors).length) {
    return {
      success: false,
      result: {
        success: false,
        message: "Review the highlighted exercises.",
        rowErrors
      }
    };
  }

  return { success: true, rows };
}

async function resolveExistingExercises(
  rows: BulkExerciseRow[],
  coachId: string
) {
  const { supabase } = await getUserOrRedirect();
  const { data, error } = await supabase
    .from("exercises")
    .select("id, name")
    .eq("coach_id", coachId)
    .is("archived_at", null);
  if (error) throw new Error(error.message);

  const byName = new Map(
    (data ?? []).map((exercise) => [normalizeName(exercise.name), exercise.id])
  );
  return rows.map((row) => ({
    ...row,
    existingExerciseId:
      row.createAnyway
        ? undefined
        : row.existingExerciseId ?? byName.get(normalizeName(row.name))
  }));
}

export async function saveRoutineDetailsAction(
  routineId: string,
  input: RoutineDetailsInput
): Promise<RoutineBuilderResult> {
  const { supabase, user } = await getUserOrRedirect();
  const name = input.name.trim().replace(/\s+/g, " ");
  if (!name) return { success: false, message: "Routine name is required." };
  if (!["circuit", "individual", "gym"].includes(input.routineType)) {
    return { success: false, message: "Choose a valid routine structure." };
  }
  const defaultCycles =
    input.routineType === "gym"
      ? 1
      : Math.min(12, Math.max(1, Math.trunc(input.defaultCycles)));

  const { data: existingRoutine } = await supabase
    .from("workout_routines")
    .select("id, routine_type")
    .eq("id", routineId)
    .eq("coach_id", user.id)
    .is("archived_at", null)
    .maybeSingle();
  if (!existingRoutine) {
    return { success: false, message: "This routine is unavailable." };
  }

  const { data, error } = await supabase
    .from("workout_routines")
    .update({
      name,
      description: optionalText(input.description),
      warmup_notes: optionalText(input.warmupNotes),
      workout_notes: optionalText(input.workoutNotes),
      cooldown_notes: optionalText(input.cooldownNotes),
      routine_type: input.routineType,
      default_cycles: defaultCycles
    })
    .eq("id", routineId)
    .eq("coach_id", user.id)
    .is("archived_at", null)
    .select("id")
    .maybeSingle();

  if (error || !data) {
    return { success: false, message: "The routine could not be saved." };
  }
  if (existingRoutine.routine_type !== input.routineType) {
    const { error: workloadError } = await supabase
      .from("routine_exercises")
      .update({ sets: input.routineType === "gym" ? 3 : 1 })
      .eq("routine_id", routineId)
      .eq("phase", "main");
    if (workloadError) {
      return {
        success: false,
        message: "The routine structure changed, but exercise settings could not be updated."
      };
    }
  }
  revalidatePath("/dashboard/routines");
  revalidatePath(`/dashboard/routines/${routineId}`);
  return { success: true };
}

export async function saveRoutineExerciseConfigAction(
  routineId: string,
  routineExerciseId: string,
  input: RoutineExerciseConfigInput
): Promise<RoutineBuilderResult> {
  const { supabase, user } = await getUserOrRedirect();
  const { data: routine } = await supabase
    .from("workout_routines")
    .select("id, routine_type")
    .eq("id", routineId)
    .eq("coach_id", user.id)
    .is("archived_at", null)
    .maybeSingle();
  if (!routine) return { success: false, message: "This routine is unavailable." };

  const reps = input.reps.trim();
  if (!reps) return { success: false, message: "Reps are required." };
  if (input.restSeconds !== null && input.restSeconds < 0) {
    return { success: false, message: "Rest time cannot be negative." };
  }
  if (!isRoutinePhase(input.phase)) {
    return { success: false, message: "Choose a valid workout phase." };
  }

  const { error } = await supabase
    .from("routine_exercises")
    .update({
      sets:
        input.phase === "main" && routine.routine_type === "gym"
          ? Math.min(20, Math.max(1, Math.trunc(input.sets)))
          : 1,
      phase: input.phase,
      reps,
      rest_seconds: input.restSeconds,
      notes: optionalText(input.notes)
    })
    .eq("id", routineExerciseId)
    .eq("routine_id", routineId);
  if (error) return { success: false, message: "Exercise settings could not be saved." };

  revalidatePath(`/dashboard/routines/${routineId}`);
  return { success: true };
}

export async function addLibraryExercisesAction(
  routineId: string,
  exerciseIds: string[],
  phase: RoutinePhase
): Promise<RoutineBuilderResult> {
  const { supabase, user } = await getUserOrRedirect();
  const uniqueIds = Array.from(new Set(exerciseIds.filter(Boolean))).slice(0, 25);
  if (!uniqueIds.length) return { success: false, message: "Select at least one exercise." };
  if (!isRoutinePhase(phase)) return { success: false, message: "Choose a valid workout phase." };

  const [{ data: routine }, { data: exercises, error: exercisesError }, { data: lastItem }] =
    await Promise.all([
      supabase
        .from("workout_routines")
        .select("id, routine_type")
        .eq("id", routineId)
        .eq("coach_id", user.id)
        .is("archived_at", null)
        .maybeSingle(),
      supabase
        .from("exercises")
        .select("id")
        .eq("coach_id", user.id)
        .is("archived_at", null)
        .in("id", uniqueIds),
      supabase
        .from("routine_exercises")
        .select("position")
        .eq("routine_id", routineId)
        .order("position", { ascending: false })
        .limit(1)
        .maybeSingle()
    ]);

  if (!routine) return { success: false, message: "This routine is unavailable." };
  if (exercisesError || exercises?.length !== uniqueIds.length) {
    return { success: false, message: "One or more exercises are unavailable." };
  }

  const availableIds = new Set(exercises.map((exercise) => exercise.id));
  const orderedIds = uniqueIds.filter((id) => availableIds.has(id));
  const startPosition = lastItem?.position ?? 0;
  const { error } = await supabase.from("routine_exercises").insert(
    orderedIds.map((exerciseId, index) => ({
      routine_id: routineId,
      exercise_id: exerciseId,
      position: startPosition + index + 1,
      phase,
      sets: phase === "main" && routine.routine_type === "gym" ? 3 : 1,
      reps: "10"
    }))
  );
  if (error) return { success: false, message: "The exercises could not be added." };

  revalidatePath(`/dashboard/routines/${routineId}`);
  return { success: true, ids: orderedIds };
}

export async function bulkCreateRoutineExercisesAction(
  routineId: string,
  phase: RoutinePhase,
  formData: FormData
): Promise<RoutineBuilderResult> {
  if (!isRoutinePhase(phase)) {
    return { success: false, message: "Choose a valid workout phase." };
  }
  const parsed = parseBulkRows(formData);
  if (!parsed.success) return parsed.result;

  const { supabase, user } = await getUserOrRedirect();
  const { data: routine } = await supabase
    .from("workout_routines")
    .select("id")
    .eq("id", routineId)
    .eq("coach_id", user.id)
    .is("archived_at", null)
    .maybeSingle();
  if (!routine) return { success: false, message: "This routine is unavailable." };

  try {
    const rows = await resolveExistingExercises(parsed.rows, user.id);
    if (
      rows.some(
        (row) =>
          !row.existingExerciseId &&
          !isOwnedThumbnailUrl(row.thumbnailUrl, user.id)
      )
    ) {
      return { success: false, message: "One or more thumbnails are invalid." };
    }
    const payload = rows.map((row) => ({
      existing_exercise_id: row.existingExerciseId ?? null,
      name: row.name,
      category: row.category,
      difficulty: row.difficulty,
      equipment: row.equipment,
      movement_pattern: row.movementPattern,
      primary_muscles: row.primaryMuscles,
      video_url: row.videoUrl,
      thumbnail_url: row.existingExerciseId ? null : row.thumbnailUrl,
      sets: row.sets,
      reps: row.reps,
      rest_seconds: row.restSeconds,
      notes: row.notes,
      phase
    })) as Json;
    const { data, error } = await supabase.rpc(
      "bulk_create_and_add_routine_exercises",
      { target_routine_id: routineId, exercise_items: payload }
    );
    if (error) throw new Error(error.message);

    revalidatePath("/dashboard/exercises");
    revalidatePath(`/dashboard/routines/${routineId}`);
    return {
      success: true,
      ids: data.map((item: { exercise_id: string }) => item.exercise_id),
      message: `${data.length} ${data.length === 1 ? "exercise was" : "exercises were"} added.`
    };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : "Exercises could not be created."
    };
  }
}

export async function bulkCreateLibraryExercisesAction(
  formData: FormData
): Promise<RoutineBuilderResult> {
  const parsed = parseBulkRows(formData);
  if (!parsed.success) return parsed.result;

  const { supabase, user } = await getUserOrRedirect();
  try {
    const rows = await resolveExistingExercises(parsed.rows, user.id);
    if (
      rows.some(
        (row) =>
          !row.existingExerciseId &&
          !isOwnedThumbnailUrl(row.thumbnailUrl, user.id)
      )
    ) {
      return { success: false, message: "One or more thumbnails are invalid." };
    }
    const newRows = rows
      .map((row, index) => ({ row, index }))
      .filter(({ row }) => !row.existingExerciseId);
    const generatedIdByIndex = new Map(
      newRows.map(({ index }) => [index, crypto.randomUUID()])
    );
    const { data, error } = newRows.length
      ? await supabase
          .from("exercises")
          .insert(
            newRows.map(({ row, index }) => ({
              id: generatedIdByIndex.get(index),
              coach_id: user.id,
              name: row.name,
              category: optionalText(row.category),
              difficulty: row.difficulty,
              equipment: optionalText(row.equipment),
              movement_pattern: optionalText(row.movementPattern),
              primary_muscles: row.primaryMuscles,
              video_url: optionalText(row.videoUrl),
              thumbnail_url: optionalText(row.thumbnailUrl)
            }))
          )
          .select("id")
      : { data: [], error: null };
    if (error) throw new Error(error.message);

    const insertedIds = new Set((data ?? []).map((exercise) => exercise.id));
    const ids = rows.map((row, index) =>
      row.existingExerciseId ?? generatedIdByIndex.get(index) ?? ""
    );
    if (
      ids.some(
        (id) =>
          !id ||
          (!insertedIds.has(id) &&
            !rows.some((row) => row.existingExerciseId === id))
      )
    ) {
      throw new Error("The created exercise order could not be verified.");
    }
    revalidatePath("/dashboard/exercises");
    return {
      success: true,
      ids,
      message: `${ids.length} ${ids.length === 1 ? "exercise is" : "exercises are"} ready.`
    };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : "Exercises could not be created."
    };
  }
}

export async function publishRoutineAction(
  routineId: string
): Promise<RoutineBuilderResult> {
  const { supabase, user } = await getUserOrRedirect();
  const [{ data: routine }, { count, error: countError }] = await Promise.all([
    supabase
      .from("workout_routines")
      .select("id, name, status")
      .eq("id", routineId)
      .eq("coach_id", user.id)
      .is("archived_at", null)
      .maybeSingle(),
    supabase
      .from("routine_exercises")
      .select("id", { count: "exact", head: true })
      .eq("routine_id", routineId)
      .eq("phase", "main")
  ]);
  if (!routine) return { success: false, message: "This routine is unavailable." };
  if (!routine.name.trim()) return { success: false, message: "Routine name is required." };
  if (countError || !count) {
    return { success: false, message: "Add at least one exercise to the Main workout before publishing." };
  }
  if (routine.status === "published") return { success: true };

  const { error } = await supabase
    .from("workout_routines")
    .update({ status: "published" })
    .eq("id", routineId)
    .eq("coach_id", user.id)
    .eq("status", "draft");
  if (error) return { success: false, message: "The routine could not be published." };

  revalidatePath("/dashboard/routines");
  revalidatePath(`/dashboard/routines/${routineId}`);
  return { success: true, message: "Routine published." };
}

export async function discardRoutineDraftAction(
  routineId: string
): Promise<RoutineBuilderResult> {
  const { supabase, user } = await getUserOrRedirect();
  const { data, error } = await supabase
    .from("workout_routines")
    .delete()
    .eq("id", routineId)
    .eq("coach_id", user.id)
    .eq("status", "draft")
    .select("id")
    .maybeSingle();
  if (error || !data) return { success: false, message: "The draft could not be discarded." };

  revalidatePath("/dashboard/routines");
  return { success: true };
}
