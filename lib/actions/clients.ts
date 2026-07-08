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

export async function createClientAction(formData: FormData) {
  const { supabase, user } = await getUserOrRedirect();

  const { error } = await supabase.from("clients").insert({
    coach_id: user.id,
    name: String(formData.get("name") ?? "").trim(),
    email: optionalString(formData, "email"),
    age: optionalNumber(formData, "age"),
    goal: optionalString(formData, "goal"),
    notes: optionalString(formData, "notes"),
    status: String(formData.get("status") ?? "active") as "active" | "paused" | "archived"
  });

  if (error) throw new Error(error.message);

  revalidatePath("/dashboard/clients");
  redirect("/dashboard/clients");
}

export async function updateClientAction(clientId: string, formData: FormData) {
  const { supabase } = await getUserOrRedirect();

  const { error } = await supabase
    .from("clients")
    .update({
      name: String(formData.get("name") ?? "").trim(),
      email: optionalString(formData, "email"),
      age: optionalNumber(formData, "age"),
      goal: optionalString(formData, "goal"),
      notes: optionalString(formData, "notes"),
      status: String(formData.get("status") ?? "active") as "active" | "paused" | "archived"
    })
    .eq("id", clientId);

  if (error) throw new Error(error.message);

  revalidatePath("/dashboard/clients");
  redirect(`/dashboard/clients/${clientId}`);
}

export async function createWorkoutLogAction(clientId: string, formData: FormData) {
  const { supabase, user } = await getUserOrRedirect();
  const routineId = optionalString(formData, "routine_id");

  const { error } = await supabase.from("workout_logs").insert({
    coach_id: user.id,
    client_id: clientId,
    routine_id: routineId,
    trained_on: String(formData.get("trained_on") ?? new Date().toISOString().slice(0, 10)),
    notes: optionalString(formData, "notes")
  });

  if (error) throw new Error(error.message);

  revalidatePath(`/dashboard/clients/${clientId}`);
  revalidatePath("/dashboard");
}

export async function createBodyProgressAction(clientId: string, formData: FormData) {
  const { supabase, user } = await getUserOrRedirect();

  const { error } = await supabase.from("body_progress_entries").insert({
    coach_id: user.id,
    client_id: clientId,
    recorded_on: String(formData.get("recorded_on") ?? new Date().toISOString().slice(0, 10)),
    body_weight: Number(formData.get("body_weight")),
    body_fat_percentage: optionalNumber(formData, "body_fat_percentage"),
    waist: optionalNumber(formData, "waist"),
    chest: optionalNumber(formData, "chest"),
    arms: optionalNumber(formData, "arms"),
    legs: optionalNumber(formData, "legs"),
    notes: optionalString(formData, "notes")
  });

  if (error) throw new Error(error.message);

  revalidatePath(`/dashboard/clients/${clientId}`);
  revalidatePath("/dashboard/progress");
}

export async function assignRoutineAction(clientId: string, formData: FormData) {
  const { supabase, user } = await getUserOrRedirect();

  const { error } = await supabase.from("client_routines").insert({
    coach_id: user.id,
    client_id: clientId,
    routine_id: String(formData.get("routine_id") ?? ""),
    notes: optionalString(formData, "notes")
  });

  if (error) throw new Error(error.message);

  revalidatePath(`/dashboard/clients/${clientId}`);
}
