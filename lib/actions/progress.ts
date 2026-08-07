"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type BodyProgressState = {
  status: "idle" | "success" | "error";
  message: string;
};

function optionalString(formData: FormData, key: string) {
  const value = String(formData.get(key) ?? "").trim();
  return value || null;
}

function metricValue(
  formData: FormData,
  key: string,
  label: string,
  minimum: number,
  maximum: number,
  required = false
) {
  const raw = String(formData.get(key) ?? "").trim();
  if (!raw) {
    if (required) throw new Error(`${label} is required.`);
    return null;
  }

  const value = Number(raw);
  if (!Number.isFinite(value) || value < minimum || value > maximum) {
    throw new Error(`${label} must be between ${minimum} and ${maximum}.`);
  }
  return value;
}

export async function createBodyProgressAction(
  clientId: string,
  _previousState: BodyProgressState,
  formData: FormData
): Promise<BodyProgressState> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const { data: client, error: clientError } = await supabase
    .from("clients")
    .select("id, coach_id, client_user_id, status")
    .eq("id", clientId)
    .maybeSingle();
  const isCoach = client?.coach_id === user.id;
  const isTrainee = client?.client_user_id === user.id;

  if (clientError || !client || (!isCoach && !isTrainee)) {
    return { status: "error", message: "This progress profile is not available." };
  }
  if (client.status === "archived" || (isTrainee && client.status !== "active")) {
    return { status: "error", message: "Progress cannot be added while this trainee profile is inactive." };
  }

  const recordedOn = String(formData.get("recorded_on") ?? "").trim();
  const today = new Date().toISOString().slice(0, 10);
  const parsedRecordedOn = new Date(`${recordedOn}T00:00:00Z`);
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(recordedOn)
    || Number.isNaN(parsedRecordedOn.valueOf())
    || parsedRecordedOn.toISOString().slice(0, 10) !== recordedOn
    || recordedOn > today
  ) {
    return { status: "error", message: "Choose today or an earlier progress date." };
  }

  try {
    const { error } = await supabase.from("body_progress_entries").insert({
      coach_id: client.coach_id,
      client_id: client.id,
      recorded_by: user.id,
      recorded_on: recordedOn,
      body_weight: metricValue(formData, "body_weight", "Body weight", 1, 500, true)!,
      body_fat_percentage: metricValue(formData, "body_fat_percentage", "Body fat percentage", 0, 100),
      muscle_mass_percentage: metricValue(formData, "muscle_mass_percentage", "Muscle mass percentage", 0, 100),
      waist: metricValue(formData, "waist", "Waist measurement", 1, 500),
      chest: metricValue(formData, "chest", "Chest measurement", 1, 500),
      arms: metricValue(formData, "arms", "Arm measurement", 1, 500),
      legs: metricValue(formData, "legs", "Leg measurement", 1, 500),
      notes: optionalString(formData, "notes")
    });
    if (error) throw new Error(error.message);

    revalidatePath("/dashboard");
    revalidatePath("/dashboard/progress");
    revalidatePath(`/dashboard/clients/${client.id}`);
    revalidatePath("/trainee");
    revalidatePath("/trainee/progress");

    return {
      status: "success",
      message: isTrainee
        ? "Your progress was added successfully."
        : "The progress entry was added successfully."
    };
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Unable to add progress."
    };
  }
}
