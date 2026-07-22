"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getUserOrRedirect } from "@/lib/auth";

function optionalString(formData: FormData, key: string) {
  const value = String(formData.get(key) ?? "").trim();
  return value.length > 0 ? value : null;
}

function optionalNumber(formData: FormData, key: string) {
  const value = String(formData.get(key) ?? "").trim();
  return value.length > 0 ? Number(value) : null;
}

function numberWithDefault(formData: FormData, key: string, fallback: number) {
  const value = Number(formData.get(key) ?? fallback);
  return Number.isFinite(value) ? value : fallback;
}

export async function createRoutineAction(formData: FormData) {
  const { supabase, user } = await getUserOrRedirect();

  const { data, error } = await supabase
    .from("workout_routines")
    .insert({
      coach_id: user.id,
      name: String(formData.get("name") ?? "").trim(),
      description: optionalString(formData, "description"),
      routine_type: String(formData.get("routine_type") ?? "circuit") as "circuit" | "individual",
      default_cycles: numberWithDefault(formData, "default_cycles", 3)
    })
    .select("id")
    .single();

  if (error) throw new Error(error.message);

  revalidatePath("/dashboard/routines");
  redirect(`/dashboard/routines/${data.id}`);
}

export async function addRoutineExerciseAction(routineId: string, formData: FormData) {
  const { supabase } = await getUserOrRedirect();
  const exerciseId = String(formData.get("exercise_id") ?? "");

  const { error } = await supabase.from("routine_exercises").insert({
    routine_id: routineId,
    exercise_id: exerciseId,
    position: numberWithDefault(formData, "position", 1),
    reps: String(formData.get("reps") ?? "10"),
    rest_seconds: optionalNumber(formData, "rest_seconds"),
    notes: optionalString(formData, "notes")
  });

  if (error) throw new Error(error.message);

  revalidatePath(`/dashboard/routines/${routineId}`);
}

export async function removeRoutineExerciseAction(routineId: string, routineExerciseId: string) {
  const { supabase } = await getUserOrRedirect();

  const { error } = await supabase
    .from("routine_exercises")
    .delete()
    .eq("id", routineExerciseId)
    .eq("routine_id", routineId);

  if (error) throw new Error(error.message);

  revalidatePath(`/dashboard/routines/${routineId}`);
}

export async function reorderRoutineExercisesAction(routineId: string, orderedIds: string[]) {
  const { supabase } = await getUserOrRedirect();
  const uniqueIds = Array.from(new Set(orderedIds.filter(Boolean)));

  if (uniqueIds.length !== orderedIds.length) {
    throw new Error("Routine exercise order contains duplicate or invalid items.");
  }

  const results = await Promise.all(
    uniqueIds.map((id, index) =>
      supabase
        .from("routine_exercises")
        .update({ position: index + 1 })
        .eq("id", id)
        .eq("routine_id", routineId)
    )
  );

  const failedUpdate = results.find((result) => result.error);
  if (failedUpdate?.error) throw new Error(failedUpdate.error.message);

  revalidatePath(`/dashboard/routines/${routineId}`);
}
