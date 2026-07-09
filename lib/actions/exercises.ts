"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getUserOrRedirect } from "@/lib/auth";

function optionalString(formData: FormData, key: string) {
  const value = String(formData.get(key) ?? "").trim();
  return value.length > 0 ? value : null;
}

function parseList(value: FormDataEntryValue | null) {
  return String(value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseDifficulty(formData: FormData) {
  const value = Number(formData.get("difficulty") ?? 1);
  return Math.min(5, Math.max(1, Number.isFinite(value) ? value : 1));
}

async function uploadThumbnail(formData: FormData, coachId: string) {
  const file = formData.get("thumbnail_file");

  if (!(file instanceof File) || file.size === 0) {
    return optionalString(formData, "thumbnail_url");
  }

  const { supabase } = await getUserOrRedirect();
  const extension = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
  const path = `${coachId}/${crypto.randomUUID()}.${extension}`;
  const { error } = await supabase.storage.from("exercise-media").upload(path, file, {
    cacheControl: "3600",
    upsert: false
  });

  if (error) {
    throw new Error(error.message);
  }

  const { data } = supabase.storage.from("exercise-media").getPublicUrl(path);
  return data.publicUrl;
}

export async function createExerciseAction(formData: FormData) {
  const { supabase, user } = await getUserOrRedirect();
  const thumbnailUrl = await uploadThumbnail(formData, user.id);

  const { data, error } = await supabase
    .from("exercises")
    .insert({
      coach_id: user.id,
      name: String(formData.get("name") ?? "").trim(),
      category: optionalString(formData, "category"),
      description: optionalString(formData, "description"),
      difficulty: parseDifficulty(formData),
      thumbnail_url: thumbnailUrl,
      video_url: optionalString(formData, "video_url"),
      equipment: optionalString(formData, "equipment"),
      movement_pattern: optionalString(formData, "movement_pattern"),
      primary_muscles: parseList(formData.get("primary_muscles")),
      notes: optionalString(formData, "notes")
    })
    .select("id")
    .single();

  if (error) throw new Error(error.message);

  revalidatePath("/dashboard/exercises");
  redirect(`/dashboard/exercises/${data.id}`);
}

export async function updateExerciseAction(exerciseId: string, formData: FormData) {
  const { supabase, user } = await getUserOrRedirect();
  const thumbnailUrl = await uploadThumbnail(formData, user.id);

  const { error } = await supabase
    .from("exercises")
    .update({
      name: String(formData.get("name") ?? "").trim(),
      category: optionalString(formData, "category"),
      description: optionalString(formData, "description"),
      difficulty: parseDifficulty(formData),
      thumbnail_url: thumbnailUrl,
      video_url: optionalString(formData, "video_url"),
      equipment: optionalString(formData, "equipment"),
      movement_pattern: optionalString(formData, "movement_pattern"),
      primary_muscles: parseList(formData.get("primary_muscles")),
      notes: optionalString(formData, "notes"),
      is_archived: formData.get("is_archived") === "on"
    })
    .eq("id", exerciseId);

  if (error) throw new Error(error.message);

  revalidatePath("/dashboard/exercises");
  revalidatePath(`/dashboard/exercises/${exerciseId}`);
  redirect(`/dashboard/exercises/${exerciseId}`);
}

export async function addExerciseProgressionAction(exerciseId: string, formData: FormData) {
  const { supabase, user } = await getUserOrRedirect();
  const relatedExerciseId = String(formData.get("related_exercise_id") ?? "");
  const relationship = String(formData.get("relationship") ?? "easier") as "easier" | "harder";

  const { error } = await supabase.from("exercise_progressions").insert({
    coach_id: user.id,
    exercise_id: exerciseId,
    related_exercise_id: relatedExerciseId,
    relationship
  });

  if (error) throw new Error(error.message);

  revalidatePath(`/dashboard/exercises/${exerciseId}`);
}
