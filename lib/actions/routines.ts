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

export async function createRoutineAction(formData: FormData) {
  const { supabase, user } = await getUserOrRedirect();

  const { data, error } = await supabase
    .from("workout_routines")
    .insert({
      coach_id: user.id,
      name: String(formData.get("name") ?? "").trim(),
      description: optionalString(formData, "description")
    })
    .select("id")
    .single();

  if (error) throw new Error(error.message);

  revalidatePath("/dashboard/routines");
  redirect(`/dashboard/routines/${data.id}`);
}

export async function addRoutineExerciseAction(routineId: string, formData: FormData) {
  const { supabase, user } = await getUserOrRedirect();
  const exerciseName = String(formData.get("exercise_name") ?? "").trim();

  const { data: exercise, error: exerciseError } = await supabase
    .from("exercises")
    .insert({
      coach_id: user.id,
      name: exerciseName,
      category: optionalString(formData, "category")
    })
    .select("id")
    .single();

  if (exerciseError) throw new Error(exerciseError.message);

  const { error } = await supabase.from("routine_exercises").insert({
    routine_id: routineId,
    exercise_id: exercise.id,
    position: Number(formData.get("position") ?? 1),
    sets: Number(formData.get("sets") ?? 3),
    reps: String(formData.get("reps") ?? "10"),
    target_weight: optionalString(formData, "target_weight"),
    rest_seconds: optionalNumber(formData, "rest_seconds"),
    notes: optionalString(formData, "notes")
  });

  if (error) throw new Error(error.message);

  revalidatePath(`/dashboard/routines/${routineId}`);
}
