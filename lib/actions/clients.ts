"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getUserOrRedirect } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

export type DeleteClientAccountResult =
  | { success: true; clientName: string }
  | { success: false; message: string };

export type ArchiveClientResult =
  | { success: true }
  | { success: false; message: string };

type AdminAuthError = {
  code?: string;
  message: string;
};

function isMissingAuthUser(error: AdminAuthError) {
  return (
    error.code === "user_not_found" ||
    error.message.toLowerCase().includes("user not found")
  );
}

function optionalString(formData: FormData, key: string) {
  const value = String(formData.get(key) ?? "").trim();
  return value.length > 0 ? value : null;
}

function optionalNumber(formData: FormData, key: string) {
  const value = String(formData.get(key) ?? "").trim();
  return value.length > 0 ? Number(value) : null;
}

export type AssignRoutineState = {
  status: "idle" | "success" | "error";
  message: string;
  routineName?: string;
};

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

export async function archiveClientAction(
  clientId: string
): Promise<ArchiveClientResult> {
  const { supabase, user } = await getUserOrRedirect();
  const { data, error } = await supabase
    .from("clients")
    .update({ status: "archived" })
    .eq("id", clientId)
    .eq("coach_id", user.id)
    .neq("status", "archived")
    .select("id")
    .maybeSingle();

  if (error) {
    return {
      success: false,
      message: "We could not archive this client. Please try again."
    };
  }

  if (!data) {
    return {
      success: false,
      message: "This client is unavailable or has already been archived."
    };
  }

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/clients");
  revalidatePath(`/dashboard/clients/${clientId}`);
  revalidatePath("/dashboard/routines");

  return { success: true };
}

export async function restoreClientAction(
  clientId: string
): Promise<ArchiveClientResult> {
  const { supabase, user } = await getUserOrRedirect();
  const { data, error } = await supabase
    .from("clients")
    .update({ status: "active" })
    .eq("id", clientId)
    .eq("coach_id", user.id)
    .eq("status", "archived")
    .select("id")
    .maybeSingle();

  if (error) {
    return {
      success: false,
      message: "We could not restore this client. Please try again."
    };
  }

  if (!data) {
    return {
      success: false,
      message: "This archived client is no longer available."
    };
  }

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/clients");
  revalidatePath(`/dashboard/clients/${clientId}`);
  revalidatePath("/dashboard/routines");

  return { success: true };
}

export async function deleteClientAccountAction(
  clientId: string,
  confirmationName: string
): Promise<DeleteClientAccountResult> {
  const { supabase, user } = await getUserOrRedirect();
  const { data: client, error: clientError } = await supabase
    .from("clients")
    .select("id, name, client_user_id")
    .eq("id", clientId)
    .eq("coach_id", user.id)
    .maybeSingle();

  if (clientError) {
    console.error("Unable to load client for deletion.", {
      clientId,
      coachId: user.id,
      message: clientError.message
    });
    return {
      success: false,
      message: "We could not verify this client. Please refresh and try again."
    };
  }

  if (!client) {
    return {
      success: false,
      message: "This client no longer exists or you do not have permission to delete it."
    };
  }

  if (confirmationName.trim() !== client.name) {
    return {
      success: false,
      message: "Enter the trainee's name exactly as shown before deleting the account."
    };
  }

  const admin = createAdminClient();

  if (client.client_user_id) {
    if (client.client_user_id === user.id) {
      console.error("Blocked an attempt to delete the active coach account.", {
        clientId,
        coachId: user.id
      });
      return {
        success: false,
        message: "This linked account cannot be deleted from the client profile."
      };
    }

    const { data: linkedProfile, error: profileError } = await admin
      .from("profiles")
      .select("role")
      .eq("id", client.client_user_id)
      .maybeSingle();

    if (profileError) {
      console.error("Unable to verify the linked trainee profile.", {
        clientId,
        authUserId: client.client_user_id,
        message: profileError.message
      });
      return {
        success: false,
        message: "We could not verify the linked trainee account. Nothing was deleted."
      };
    }

    const { data: authUserData, error: authUserError } =
      await admin.auth.admin.getUserById(client.client_user_id);

    if (authUserError && !isMissingAuthUser(authUserError)) {
      console.error("Unable to verify the linked Supabase Auth user.", {
        clientId,
        authUserId: client.client_user_id,
        code: authUserError.code ?? "unknown",
        message: authUserError.message
      });
      return {
        success: false,
        message: "We could not verify the linked trainee account. Nothing was deleted."
      };
    }

    const authUser = authUserData.user;

    if (authUser) {
      const metadata = authUser.user_metadata;
      const hasTraineeRole =
        linkedProfile?.role === "trainee" || metadata?.role === "trainee";
      const hasConflictingLink =
        (typeof metadata?.client_id === "string" &&
          metadata.client_id !== client.id) ||
        (typeof metadata?.coach_id === "string" &&
          metadata.coach_id !== user.id);

      if (!hasTraineeRole || hasConflictingLink) {
        console.error("Blocked deletion of an invalid linked Auth account.", {
          clientId,
          coachId: user.id,
          authUserId: client.client_user_id
        });
        return {
          success: false,
          message:
            "The linked login could not be verified as this coach's trainee account. Nothing was deleted."
        };
      }

      const { error: deleteAuthError } = await admin.auth.admin.deleteUser(
        client.client_user_id
      );

      if (deleteAuthError) {
        console.error("Unable to delete the linked Supabase Auth user.", {
          clientId,
          authUserId: client.client_user_id,
          code: deleteAuthError.code ?? "unknown",
          message: deleteAuthError.message
        });
        return {
          success: false,
          message: "The trainee login could not be deleted. Nothing else was removed."
        };
      }
    }
  }

  const { data: deletedClient, error: deleteClientError } = await admin
    .from("clients")
    .delete()
    .eq("id", client.id)
    .eq("coach_id", user.id)
    .select("id")
    .maybeSingle();

  if (deleteClientError || !deletedClient) {
    console.error("Unable to delete the client record after account cleanup.", {
      clientId,
      coachId: user.id,
      message: deleteClientError?.message ?? "Client record was not deleted."
    });
    return {
      success: false,
      message:
        "The login was removed, but the client data could not be deleted. Please try again."
    };
  }

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/clients");
  revalidatePath("/dashboard/progress");

  return { success: true, clientName: client.name };
}

export async function createWorkoutLogAction(clientId: string, formData: FormData) {
  const { supabase, user } = await getUserOrRedirect();
  const routineId = optionalString(formData, "routine_id");
  const { data: client } = await supabase
    .from("clients")
    .select("id")
    .eq("id", clientId)
    .eq("coach_id", user.id)
    .neq("status", "archived")
    .maybeSingle();

  if (!client) throw new Error("Archived clients cannot receive new workout logs.");

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
  const { data: client } = await supabase
    .from("clients")
    .select("id")
    .eq("id", clientId)
    .eq("coach_id", user.id)
    .neq("status", "archived")
    .maybeSingle();

  if (!client) throw new Error("Archived clients cannot receive new progress entries.");

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

export async function assignRoutineAction(
  clientId: string,
  _previousState: AssignRoutineState,
  formData: FormData
): Promise<AssignRoutineState> {
  const { supabase, user } = await getUserOrRedirect();
  const routineId = String(formData.get("routine_id") ?? "");

  if (!routineId) {
    return {
      status: "error",
      message: "Select a routine before assigning it."
    };
  }

  const { data: assignableClient, error: clientError } = await supabase
    .from("clients")
    .select("id")
    .eq("id", clientId)
    .eq("coach_id", user.id)
    .eq("status", "active")
    .maybeSingle();

  if (clientError || !assignableClient) {
    return {
      status: "error",
      message: "This client is not active and cannot receive new routines."
    };
  }

  const { data: routine, error: routineError } = await supabase
    .from("workout_routines")
    .select("name")
    .eq("id", routineId)
    .eq("coach_id", user.id)
    .is("archived_at", null)
    .single();

  if (routineError || !routine) {
    return {
      status: "error",
      message: "That routine is no longer available. Refresh the page and try again."
    };
  }

  const { error } = await supabase.from("client_routines").insert({
    coach_id: user.id,
    client_id: clientId,
    routine_id: routineId,
    notes: optionalString(formData, "notes")
  });

  if (error) {
    return {
      status: "error",
      message: "We could not assign this routine. Please try again."
    };
  }

  revalidatePath(`/dashboard/clients/${clientId}`);
  revalidatePath("/trainee");

  return {
    status: "success",
    message: "Routine assigned successfully.",
    routineName: routine.name
  };
}
