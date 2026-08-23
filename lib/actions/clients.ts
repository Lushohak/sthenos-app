"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getUserOrRedirect } from "@/lib/auth";
import { calculateAge } from "@/lib/client-profile";
import { createAdminClient } from "@/lib/supabase/admin";
import { inviteTraineeAction } from "@/lib/actions/trainee-invites";
import type { ClientLoggingOptionsResult } from "@/lib/client-roster";
import type { ActivityMetricKey } from "@/lib/activities";
import type { Database } from "@/types/database";

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

type ClientGender = Database["public"]["Enums"]["client_gender"];

function optionalClientGender(formData: FormData): ClientGender | null {
  const value = optionalString(formData, "gender");
  if (value === null) return null;
  if (value === "male" || value === "female" || value === "prefer_not_to_say") {
    return value;
  }
  throw new Error("Choose a valid gender option.");
}

function optionalDateOfBirth(formData: FormData) {
  const value = optionalString(formData, "date_of_birth");
  if (value === null) return null;
  const parsed = new Date(`${value}T00:00:00Z`);
  const today = new Date().toISOString().slice(0, 10);
  const age = calculateAge(value);
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(value)
    || Number.isNaN(parsed.valueOf())
    || parsed.toISOString().slice(0, 10) !== value
    || value > today
    || age === null
    || age > 120
  ) {
    throw new Error("Choose a valid date of birth for a trainee aged 120 or younger.");
  }
  return value;
}

function optionalHeightCm(formData: FormData) {
  const value = optionalNumber(formData, "height_cm");
  if (value === null) return null;
  if (!Number.isFinite(value) || value < 30 || value > 300) {
    throw new Error("Height must be between 30 and 300 centimeters.");
  }
  return value;
}

export type AssignRoutineState = {
  status: "idle" | "success" | "error";
  message: string;
  assignedCount?: number;
  skippedCount?: number;
  routineNames?: string[];
};

export type UpdateRoutineAssignmentsState = {
  status: "idle" | "success" | "error";
  message: string;
  updatedCount?: number;
};

export type WorkoutLogState = {
  status: "idle" | "success" | "error";
  message: string;
};

export async function createClientAction(formData: FormData) {
  const { supabase, user } = await getUserOrRedirect();
  const email = optionalString(formData, "email");
  const status = String(formData.get("status") ?? "active") as "active" | "paused" | "archived";

  const { data: client, error } = await supabase
    .from("clients")
    .insert({
      coach_id: user.id,
      name: String(formData.get("name") ?? "").trim(),
      email,
      gender: optionalClientGender(formData),
      date_of_birth: optionalDateOfBirth(formData),
      height_cm: optionalHeightCm(formData),
      goal: optionalString(formData, "goal"),
      notes: optionalString(formData, "notes"),
      status
    })
    .select("id")
    .single();

  if (error) throw new Error(error.message);

  revalidatePath("/dashboard/clients");
  if (formData.get("send_invite") === "on" && email && status !== "archived") {
    await inviteTraineeAction(client.id);
  }
  redirect("/dashboard/clients");
}

export async function updateClientAction(
  clientId: string,
  returnTo: string | undefined,
  formData: FormData
) {
  const { supabase } = await getUserOrRedirect();

  const { error } = await supabase
    .from("clients")
    .update({
      name: String(formData.get("name") ?? "").trim(),
      email: optionalString(formData, "email"),
      gender: optionalClientGender(formData),
      date_of_birth: optionalDateOfBirth(formData),
      height_cm: optionalHeightCm(formData),
      goal: optionalString(formData, "goal"),
      notes: optionalString(formData, "notes"),
      status: String(formData.get("status") ?? "active") as "active" | "paused" | "archived"
    })
    .eq("id", clientId);

  if (error) throw new Error(error.message);

  revalidatePath("/dashboard/clients");
  const clientPath = `/dashboard/clients/${clientId}`;
  redirect(returnTo?.startsWith(clientPath) ? returnTo : clientPath);
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

export async function createWorkoutLogAction(
  clientId: string,
  _previousState: WorkoutLogState,
  formData: FormData
): Promise<WorkoutLogState> {
  const { supabase, user } = await getUserOrRedirect();
  const requestedRoutineId = optionalString(formData, "routine_id");
  const scheduleOccurrenceId = optionalString(formData, "schedule_occurrence_id");
  const routineId = requestedRoutineId === "unstructured" ? null : requestedRoutineId;
  const { data: client } = await supabase
    .from("clients")
    .select("id")
    .eq("id", clientId)
    .eq("coach_id", user.id)
    .neq("status", "archived")
    .maybeSingle();

  if (!client) {
    return {
      status: "error",
      message: "Archived clients cannot receive new workout logs."
    };
  }

  const { error } = scheduleOccurrenceId
    ? await supabase.rpc("complete_scheduled_workout", {
        target_occurrence_id: scheduleOccurrenceId,
        target_duration_minutes: optionalNumber(formData, "duration_minutes"),
        target_notes: optionalString(formData, "notes")
      })
    : await supabase.from("workout_logs").insert({
        coach_id: user.id,
        client_id: clientId,
        routine_id: routineId,
        trained_on: String(formData.get("trained_on") ?? new Date().toISOString().slice(0, 10)),
        duration_minutes: optionalNumber(formData, "duration_minutes"),
        notes: optionalString(formData, "notes")
      });

  if (error) {
    return {
      status: "error",
      message: "We could not save this workout. Please try again."
    };
  }

  revalidatePath(`/dashboard/clients/${clientId}`);
  revalidatePath("/dashboard/clients");
  revalidatePath("/dashboard");

  return {
    status: "success",
    message: "Workout added to the trainee's training history."
  };
}

export async function getClientLoggingOptionsAction(
  clientId: string
): Promise<ClientLoggingOptionsResult> {
  const { supabase, user } = await getUserOrRedirect();
  const { data: client, error: clientError } = await supabase
    .from("clients")
    .select("id, name")
    .eq("id", clientId)
    .eq("coach_id", user.id)
    .neq("status", "archived")
    .maybeSingle();

  if (clientError || !client) {
    return {
      success: false,
      message: "This trainee is unavailable or no longer belongs to your active roster."
    };
  }

  const today = new Date().toISOString().slice(0, 10);
  const [routineResult, activityResult, scheduleResult] = await Promise.all([
    supabase
      .from("client_routines")
      .select("id, routine_id, workout_routines(name)")
      .eq("coach_id", user.id)
      .eq("client_id", clientId)
      .eq("status", "active")
      .order("assigned_at", { ascending: false }),
    supabase
      .from("client_activities")
      .select("id, tracked_metrics, required_metrics, targets, activities(name)")
      .eq("coach_id", user.id)
      .eq("client_id", clientId)
      .eq("status", "active")
      .order("assigned_at", { ascending: false }),
    supabase
      .from("training_schedule_occurrences")
      .select("id, kind, scheduled_on, title, routine_assignment_id, activity_assignment_id")
      .eq("client_id", clientId)
      .lte("scheduled_on", today)
      .in("status", ["planned", "missed"])
      .order("scheduled_on", { ascending: false })
      .limit(30)
  ]);

  if (routineResult.error || activityResult.error || scheduleResult.error) {
    return {
      success: false,
      message: "We could not load this trainee's training options. Please try again."
    };
  }

  const routineAssignments = (routineResult.data ?? []).flatMap((assignment) => {
    const routine = Array.isArray(assignment.workout_routines)
      ? assignment.workout_routines[0]
      : assignment.workout_routines;
    return routine
      ? [{
          id: assignment.id,
          routineId: assignment.routine_id,
          routineName: routine.name
        }]
      : [];
  }).sort((left, right) => left.routineName.localeCompare(right.routineName));

  const activityAssignments = (activityResult.data ?? []).flatMap((assignment) => {
    const activity = Array.isArray(assignment.activities)
      ? assignment.activities[0]
      : assignment.activities;
    return activity
      ? [{
          id: assignment.id,
          activityName: activity.name,
          trackedMetrics: assignment.tracked_metrics as ActivityMetricKey[],
          requiredMetrics: assignment.required_metrics as ActivityMetricKey[],
          targets: assignment.targets
        }]
      : [];
  }).sort((left, right) => left.activityName.localeCompare(right.activityName));

  const scheduledSessions = (scheduleResult.data ?? []).map((session) => ({
    id: session.id,
    kind: session.kind,
    scheduledOn: session.scheduled_on,
    title: session.title,
    routineAssignmentId: session.routine_assignment_id,
    activityAssignmentId: session.activity_assignment_id
  }));

  return {
    success: true,
    options: {
      client,
      routineAssignments,
      activityAssignments,
      scheduledSessions
    }
  };
}

export async function assignRoutineAction(
  clientId: string,
  _previousState: AssignRoutineState,
  formData: FormData
): Promise<AssignRoutineState> {
  const { supabase, user } = await getUserOrRedirect();
  const routineIds = Array.from(
    new Set(
      formData
        .getAll("routine_ids")
        .map((value) => String(value).trim())
        .filter(Boolean)
    )
  );

  if (!routineIds.length) {
    return {
      status: "error",
      message: "Select at least one routine before assigning."
    };
  }

  if (routineIds.length > 50) {
    return {
      status: "error",
      message: "Select no more than 50 routines at a time."
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

  const { data: routines, error: routineError } = await supabase
    .from("workout_routines")
    .select("id, name")
    .in("id", routineIds)
    .eq("coach_id", user.id)
    .eq("status", "published")
    .is("archived_at", null);

  if (routineError || !routines || routines.length !== routineIds.length) {
    return {
      status: "error",
      message:
        "One or more selected routines are no longer available. Refresh the page and try again."
    };
  }

  const { data: existingAssignments, error: existingError } = await supabase
    .from("client_routines")
    .select("routine_id")
    .eq("coach_id", user.id)
    .eq("client_id", clientId)
    .in("routine_id", routineIds)
    .in("status", ["active", "paused"]);

  if (existingError) {
    return {
      status: "error",
      message: "We could not verify the trainee's current routines. Please try again."
    };
  }

  const existingRoutineIds = new Set(
    (existingAssignments ?? []).map((assignment) => assignment.routine_id)
  );
  const routinesToAssign = routines.filter(
    (routine) => !existingRoutineIds.has(routine.id)
  );
  const skippedCount = routines.length - routinesToAssign.length;

  if (!routinesToAssign.length) {
    return {
      status: "error",
      message:
        routineIds.length === 1
          ? "This routine is already assigned to the trainee."
          : "All selected routines are already assigned to the trainee."
    };
  }

  const notes = optionalString(formData, "notes");
  const { error } = await supabase.from("client_routines").insert(
    routinesToAssign.map((routine) => ({
      coach_id: user.id,
      client_id: clientId,
      routine_id: routine.id,
      notes
    }))
  );

  if (error) {
    return {
      status: "error",
      message:
        error.code === "23505"
          ? "One of these routines was assigned in another session. Refresh the page and try again."
          : "We could not assign these routines. Please try again."
    };
  }

  revalidatePath(`/dashboard/clients/${clientId}`);
  revalidatePath("/dashboard");
  revalidatePath("/trainee");

  return {
    status: "success",
    message:
      routinesToAssign.length === 1
        ? "Routine assigned successfully."
        : "Routines assigned successfully.",
    assignedCount: routinesToAssign.length,
    skippedCount,
    routineNames: routinesToAssign.map((routine) => routine.name)
  };
}

export async function updateRoutineAssignmentsStatusAction(
  clientId: string,
  nextStatus: "active" | "paused",
  _previousState: UpdateRoutineAssignmentsState,
  formData: FormData
): Promise<UpdateRoutineAssignmentsState> {
  const { supabase, user } = await getUserOrRedirect();
  const assignmentIds = Array.from(
    new Set(
      formData
        .getAll("assignment_ids")
        .map((value) => String(value).trim())
        .filter(Boolean)
    )
  );

  if (!assignmentIds.length) {
    return {
      status: "error",
      message: "Select at least one routine before continuing."
    };
  }

  if (assignmentIds.length > 50) {
    return {
      status: "error",
      message: "Select no more than 50 routines at a time."
    };
  }

  const { data: client, error: clientError } = await supabase
    .from("clients")
    .select("id")
    .eq("id", clientId)
    .eq("coach_id", user.id)
    .eq("status", "active")
    .maybeSingle();

  if (clientError || !client) {
    return {
      status: "error",
      message: "This client is not active, so their routines cannot be changed."
    };
  }

  const currentStatus = nextStatus === "paused" ? "active" : "paused";
  const { data: assignments, error: assignmentsError } = await supabase
    .from("client_routines")
    .select("id, routine_id")
    .eq("coach_id", user.id)
    .eq("client_id", clientId)
    .eq("status", currentStatus)
    .in("id", assignmentIds);

  if (
    assignmentsError ||
    !assignments ||
    assignments.length !== assignmentIds.length
  ) {
    return {
      status: "error",
      message:
        "One or more selected assignments have changed. Refresh the page and try again."
    };
  }

  if (nextStatus === "active") {
    const routineIds = assignments.map((assignment) => assignment.routine_id);
    const { data: availableRoutines, error: routinesError } = await supabase
      .from("workout_routines")
      .select("id")
      .eq("coach_id", user.id)
      .eq("status", "published")
      .is("archived_at", null)
      .in("id", routineIds);

    if (
      routinesError ||
      !availableRoutines ||
      availableRoutines.length !== routineIds.length
    ) {
      return {
        status: "error",
        message:
          "Archived routines cannot be resumed. Restore them before trying again."
      };
    }
  }

  const { data: updatedAssignments, error: updateError } = await supabase
    .from("client_routines")
    .update({ status: nextStatus })
    .eq("coach_id", user.id)
    .eq("client_id", clientId)
    .eq("status", currentStatus)
    .in("id", assignmentIds)
    .select("id");

  if (updateError || updatedAssignments.length !== assignmentIds.length) {
    return {
      status: "error",
      message: `We could not ${nextStatus === "paused" ? "pause" : "resume"} these routines. Please try again.`
    };
  }

  revalidatePath(`/dashboard/clients/${clientId}`);
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/routines");
  revalidatePath("/trainee");

  return {
    status: "success",
    message:
      nextStatus === "paused"
        ? "Selected routines were paused."
        : "Selected routines were resumed.",
    updatedCount: updatedAssignments.length
  };
}
