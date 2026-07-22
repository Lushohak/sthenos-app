"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getTraineeOrRedirect } from "@/lib/trainee";

export type TraineeWorkoutLogState = {
  status: "idle" | "success" | "error";
  message: string;
};

function optionalString(formData: FormData, key: string) {
  const value = String(formData.get(key) ?? "").trim();
  return value.length > 0 ? value : null;
}

function optionalNumber(formData: FormData, key: string) {
  const value = String(formData.get(key) ?? "").trim();
  return value.length > 0 ? Number(value) : null;
}

export async function completeTraineeSetupAction(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login");
  }

  const fullName = String(formData.get("name") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (password.length < 6) {
    redirect("/trainee/setup?error=Password+must+be+at+least+6+characters");
  }

  const { error: authError } = await supabase.auth.updateUser({
    password,
    data: {
      full_name: fullName,
      role: "trainee"
    }
  });

  if (authError) {
    redirect(`/trainee/setup?error=${encodeURIComponent(authError.message)}`);
  }

  const admin = createAdminClient();
  const { error: profileError } = await admin.from("profiles").upsert({
    id: user.id,
    full_name: fullName,
    role: "trainee"
  });

  if (profileError) {
    throw new Error(profileError.message);
  }

  const { error: clientError } = await admin
    .from("clients")
    .update({
      name: fullName,
      age: optionalNumber(formData, "age"),
      goal: optionalString(formData, "goal"),
      invitation_accepted_at: new Date().toISOString()
    })
    .eq("client_user_id", user.id);

  if (clientError) {
    throw new Error(clientError.message);
  }

  redirect("/trainee");
}

export async function createTraineeWorkoutLogAction(
  routineId: string,
  _previousState: TraineeWorkoutLogState,
  formData: FormData
): Promise<TraineeWorkoutLogState> {
  const { supabase, client } = await getTraineeOrRedirect();
  const trainedOn = String(formData.get("trained_on") ?? "");
  const today = new Date().toISOString().slice(0, 10);

  if (!/^\d{4}-\d{2}-\d{2}$/.test(trainedOn) || trainedOn > today) {
    return {
      status: "error",
      message: "Choose today or an earlier training date."
    };
  }

  const { data: assignment, error: assignmentError } = await supabase
    .from("client_routines")
    .select("coach_id")
    .eq("client_id", client.id)
    .eq("routine_id", routineId)
    .eq("status", "active")
    .limit(1)
    .maybeSingle();

  if (assignmentError || !assignment) {
    return {
      status: "error",
      message: "This routine is no longer active. Refresh the page or contact your coach."
    };
  }

  const { error } = await supabase.from("workout_logs").insert({
    coach_id: assignment.coach_id,
    client_id: client.id,
    routine_id: routineId,
    trained_on: trainedOn,
    notes: optionalString(formData, "notes")
  });

  if (error) {
    return {
      status: "error",
      message: "We could not save this workout. Please try again."
    };
  }

  revalidatePath("/trainee");
  revalidatePath(`/dashboard/clients/${client.id}`);
  revalidatePath("/dashboard");

  return {
    status: "success",
    message: "Workout completed and added to your history."
  };
}
