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

export type BulkAssignRoutineState = {
  status: "idle" | "success" | "error";
  message: string;
  assignedCount: number;
  skippedCount: number;
};

export type ArchiveRoutineResult =
  | { success: true }
  | { success: false; message: string };

export async function createRoutineAction(formData: FormData) {
  const { supabase, user } = await getUserOrRedirect();
  const requestedType = String(formData.get("routine_type") ?? "circuit");
  const routineType = ["circuit", "individual", "gym"].includes(requestedType)
    ? (requestedType as "circuit" | "individual" | "gym")
    : "circuit";

  const { data, error } = await supabase
    .from("workout_routines")
    .insert({
      coach_id: user.id,
      name: String(formData.get("name") ?? "").trim(),
      description: optionalString(formData, "description"),
      routine_type: routineType,
      default_cycles:
        routineType === "gym" ? 1 : numberWithDefault(formData, "default_cycles", 3)
    })
    .select("id")
    .single();

  if (error) throw new Error(error.message);

  revalidatePath("/dashboard/routines");
  redirect(`/dashboard/routines/${data.id}`);
}

export async function addRoutineExerciseAction(routineId: string, formData: FormData) {
  const { supabase, user } = await getUserOrRedirect();
  const exerciseId = String(formData.get("exercise_id") ?? "");

  const { data: routine } = await supabase
    .from("workout_routines")
    .select("id, routine_type")
    .eq("id", routineId)
    .eq("coach_id", user.id)
    .is("archived_at", null)
    .maybeSingle();

  if (!routine) {
    throw new Error("Archived routines cannot be edited.");
  }

  const { error } = await supabase.from("routine_exercises").insert({
    routine_id: routineId,
    exercise_id: exerciseId,
    position: numberWithDefault(formData, "position", 1),
    sets:
      routine.routine_type === "gym"
        ? Math.min(
            20,
            Math.max(1, Math.trunc(numberWithDefault(formData, "sets", 1)))
          )
        : 1,
    reps: String(formData.get("reps") ?? "10"),
    rest_seconds: optionalNumber(formData, "rest_seconds"),
    notes: optionalString(formData, "notes")
  });

  if (error) throw new Error(error.message);

  revalidatePath(`/dashboard/routines/${routineId}`);
}

export async function bulkAssignRoutineAction(
  routineId: string,
  _previousState: BulkAssignRoutineState,
  formData: FormData
): Promise<BulkAssignRoutineState> {
  const { supabase, user } = await getUserOrRedirect();
  const clientIds = Array.from(
    new Set(
      formData
        .getAll("client_ids")
        .map((value) => String(value).trim())
        .filter(Boolean)
    )
  );

  if (!clientIds.length) {
    return {
      status: "error",
      message: "Select at least one trainee.",
      assignedCount: 0,
      skippedCount: 0
    };
  }

  if (clientIds.length > 200) {
    return {
      status: "error",
      message: "Select no more than 200 trainees at a time.",
      assignedCount: 0,
      skippedCount: 0
    };
  }

  const { data: routine, error: routineError } = await supabase
    .from("workout_routines")
    .select("id")
    .eq("id", routineId)
    .eq("coach_id", user.id)
    .is("archived_at", null)
    .single();

  if (routineError || !routine) {
    return {
      status: "error",
      message: "This routine is no longer available.",
      assignedCount: 0,
      skippedCount: 0
    };
  }

  const { data: ownedActiveClients, error: clientsError } = await supabase
    .from("clients")
    .select("id")
    .eq("coach_id", user.id)
    .eq("status", "active")
    .in("id", clientIds);

  if (clientsError) {
    return {
      status: "error",
      message: "We could not validate the selected trainees. Please try again.",
      assignedCount: 0,
      skippedCount: 0
    };
  }

  const validClientIds = (ownedActiveClients ?? []).map((client) => client.id);
  const { data: existingAssignments, error: assignmentsError } = validClientIds.length
    ? await supabase
        .from("client_routines")
        .select("client_id")
        .eq("coach_id", user.id)
        .eq("routine_id", routineId)
        .in("status", ["active", "paused"])
        .in("client_id", validClientIds)
    : { data: [], error: null };

  if (assignmentsError) {
    return {
      status: "error",
      message: "We could not verify existing assignments. Please try again.",
      assignedCount: 0,
      skippedCount: 0
    };
  }

  const existingClientIds = new Set(
    (existingAssignments ?? []).map((assignment) => assignment.client_id)
  );
  const assignableClientIds = validClientIds.filter(
    (clientId) => !existingClientIds.has(clientId)
  );
  const skippedCount = clientIds.length - assignableClientIds.length;

  if (!assignableClientIds.length) {
    return {
      status: "error",
      message: "All selected trainees already have this routine or are unavailable.",
      assignedCount: 0,
      skippedCount
    };
  }

  const notes = optionalString(formData, "notes");
  const { error: insertError } = await supabase
    .from("client_routines")
    .insert(
      assignableClientIds.map((clientId) => ({
        coach_id: user.id,
        client_id: clientId,
        routine_id: routineId,
        notes
      }))
    );

  if (insertError) {
    return {
      status: "error",
      message:
        insertError.code === "23505"
          ? "Assignments changed while you were selecting trainees. Refresh and try again."
          : "We could not assign this routine. Please try again.",
      assignedCount: 0,
      skippedCount
    };
  }

  revalidatePath(`/dashboard/routines/${routineId}`);
  revalidatePath(`/dashboard/routines/${routineId}/assign`);
  revalidatePath("/dashboard/clients");
  revalidatePath("/dashboard");
  revalidatePath("/trainee");

  return {
    status: "success",
    message: "Routine assigned successfully.",
    assignedCount: assignableClientIds.length,
    skippedCount
  };
}

export async function removeRoutineExerciseAction(routineId: string, routineExerciseId: string) {
  const { supabase, user } = await getUserOrRedirect();
  const { data: routine } = await supabase
    .from("workout_routines")
    .select("id")
    .eq("id", routineId)
    .eq("coach_id", user.id)
    .is("archived_at", null)
    .maybeSingle();

  if (!routine) throw new Error("Archived routines cannot be edited.");

  const { error } = await supabase
    .from("routine_exercises")
    .delete()
    .eq("id", routineExerciseId)
    .eq("routine_id", routineId);

  if (error) throw new Error(error.message);

  revalidatePath(`/dashboard/routines/${routineId}`);
}

export async function reorderRoutineExercisesAction(routineId: string, orderedIds: string[]) {
  const { supabase, user } = await getUserOrRedirect();
  const uniqueIds = Array.from(new Set(orderedIds.filter(Boolean)));

  if (uniqueIds.length !== orderedIds.length) {
    throw new Error("Routine exercise order contains duplicate or invalid items.");
  }

  const { data: routine } = await supabase
    .from("workout_routines")
    .select("id")
    .eq("id", routineId)
    .eq("coach_id", user.id)
    .is("archived_at", null)
    .maybeSingle();

  if (!routine) throw new Error("Archived routines cannot be edited.");

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

export async function archiveRoutineAction(
  routineId: string
): Promise<ArchiveRoutineResult> {
  const { supabase, user } = await getUserOrRedirect();
  const { data, error } = await supabase
    .from("workout_routines")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", routineId)
    .eq("coach_id", user.id)
    .is("archived_at", null)
    .select("id")
    .maybeSingle();

  if (error) {
    return {
      success: false,
      message: "We could not archive this routine. Please try again."
    };
  }

  if (!data) {
    return {
      success: false,
      message: "This routine is unavailable or has already been archived."
    };
  }

  revalidatePath("/dashboard/routines");
  revalidatePath(`/dashboard/routines/${routineId}`);
  revalidatePath("/dashboard/clients");
  revalidatePath("/trainee");

  return { success: true };
}

export async function restoreRoutineAction(
  routineId: string
): Promise<ArchiveRoutineResult> {
  const { supabase, user } = await getUserOrRedirect();
  const { data, error } = await supabase
    .from("workout_routines")
    .update({ archived_at: null })
    .eq("id", routineId)
    .eq("coach_id", user.id)
    .not("archived_at", "is", null)
    .select("id")
    .maybeSingle();

  if (error) {
    return {
      success: false,
      message: "We could not restore this routine. Please try again."
    };
  }

  if (!data) {
    return {
      success: false,
      message: "This archived routine is no longer available."
    };
  }

  revalidatePath("/dashboard/routines");
  revalidatePath(`/dashboard/routines/${routineId}`);
  revalidatePath("/dashboard/clients");

  return { success: true };
}
