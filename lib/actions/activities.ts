"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  ACTIVITY_METRIC_KEYS,
  readActivityConfiguration,
  readActivityMetricValue,
  readAssignmentTargets,
  type ActivityAssignmentMode,
  type ActivityMetricKey,
  type ActivityTargets
} from "@/lib/activities";
import { getUserOrRedirect } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { Json } from "@/types/database";

const ACTIVITY_MEDIA_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif"
]);
const MAX_ACTIVITY_MEDIA_SIZE = 1024 * 1024;

function optionalString(formData: FormData, key: string) {
  const value = String(formData.get(key) ?? "").trim();
  return value || null;
}

function activityMode(formData: FormData): ActivityAssignmentMode {
  return formData.get("assignment_mode") === "one_time"
    ? "one_time"
    : "repeatable";
}

function plannedDate(formData: FormData, mode: ActivityAssignmentMode) {
  if (mode !== "one_time") return null;
  const value = optionalString(formData, "planned_for");
  if (value && !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error("Choose a valid planned date.");
  }
  return value;
}

async function uploadActivityThumbnail(formData: FormData, coachId: string) {
  const file = formData.get("thumbnail_file");
  if (!(file instanceof File) || file.size === 0) return null;
  if (file.size > MAX_ACTIVITY_MEDIA_SIZE) {
    throw new Error("Activity thumbnail must be 1 MB or smaller.");
  }
  if (!ACTIVITY_MEDIA_TYPES.has(file.type)) {
    throw new Error("Activity thumbnail must be a PNG, JPEG, WebP, or GIF image.");
  }

  const { supabase } = await getUserOrRedirect();
  const extension = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
  const path = `${coachId}/${crypto.randomUUID()}.${extension}`;
  const { error } = await supabase.storage
    .from("activity-media")
    .upload(path, file, { cacheControl: "3600", upsert: false });
  if (error) throw new Error(error.message);

  return supabase.storage.from("activity-media").getPublicUrl(path).data.publicUrl;
}

async function removeOwnedActivityThumbnail(url: string | null) {
  if (!url) return;
  try {
    const marker = "/activity-media/";
    const pathname = new URL(url).pathname;
    const index = pathname.indexOf(marker);
    if (index < 0) return;
    const path = decodeURIComponent(pathname.slice(index + marker.length));
    const { supabase } = await getUserOrRedirect();
    await supabase.storage.from("activity-media").remove([path]);
  } catch {
    // A failed cleanup must not invalidate an otherwise successful update.
  }
}

export type ActivityMutationState = {
  status: "idle" | "success" | "error";
  message: string;
};

export type AssignActivityState = ActivityMutationState & {
  assignedCount: number;
  skippedCount: number;
};

export type UpdateActivityAssignmentsState = ActivityMutationState & {
  updatedCount: number;
};

export type ActivityLogState = ActivityMutationState & {
  completedOneTime: boolean;
};

export type ArchiveActivityResult =
  | { success: true }
  | { success: false; message: string };

export async function createActivityAction(formData: FormData) {
  const { supabase, user } = await getUserOrRedirect();
  const name = String(formData.get("name") ?? "").trim();
  if (!name) throw new Error("Activity name is required.");
  const { trackedMetrics, requiredMetrics, defaultTargets } =
    readActivityConfiguration(formData);
  const thumbnailUrl = await uploadActivityThumbnail(formData, user.id);

  const { data, error } = await supabase
    .from("activities")
    .insert({
      coach_id: user.id,
      name,
      description: optionalString(formData, "description"),
      thumbnail_url: thumbnailUrl,
      tracked_metrics: trackedMetrics,
      required_metrics: requiredMetrics,
      default_targets: defaultTargets as Json
    })
    .select("id")
    .single();

  if (error) {
    await removeOwnedActivityThumbnail(thumbnailUrl);
    throw new Error(error.message);
  }

  revalidatePath("/dashboard/activities");
  redirect(`/dashboard/activities/${data.id}`);
}

export async function updateActivityAction(activityId: string, formData: FormData) {
  const { supabase, user } = await getUserOrRedirect();
  const name = String(formData.get("name") ?? "").trim();
  if (!name) throw new Error("Activity name is required.");
  const { trackedMetrics, requiredMetrics, defaultTargets } =
    readActivityConfiguration(formData);
  const { data: existing } = await supabase
    .from("activities")
    .select("thumbnail_url")
    .eq("id", activityId)
    .eq("coach_id", user.id)
    .is("archived_at", null)
    .maybeSingle();
  if (!existing) throw new Error("Archived activities cannot be edited.");

  const replacementUrl = await uploadActivityThumbnail(formData, user.id);
  const removeThumbnail = formData.get("remove_thumbnail") === "on";
  const thumbnailUrl = replacementUrl
    ? replacementUrl
    : removeThumbnail
      ? null
      : existing.thumbnail_url;
  const { error } = await supabase
    .from("activities")
    .update({
      name,
      description: optionalString(formData, "description"),
      thumbnail_url: thumbnailUrl,
      tracked_metrics: trackedMetrics,
      required_metrics: requiredMetrics,
      default_targets: defaultTargets as Json
    })
    .eq("id", activityId)
    .eq("coach_id", user.id)
    .is("archived_at", null);

  if (error) {
    await removeOwnedActivityThumbnail(replacementUrl);
    throw new Error(error.message);
  }
  if (replacementUrl || removeThumbnail) {
    await removeOwnedActivityThumbnail(existing.thumbnail_url);
  }

  revalidatePath("/dashboard/activities");
  revalidatePath(`/dashboard/activities/${activityId}`);
  revalidatePath("/trainee");
  redirect(`/dashboard/activities/${activityId}`);
}

async function insertAssignments(
  activityId: string,
  clientIds: string[],
  formData: FormData
) {
  const { supabase, user } = await getUserOrRedirect();
  const { data: activity, error: activityError } = await supabase
    .from("activities")
    .select("id, tracked_metrics, required_metrics, default_targets")
    .eq("id", activityId)
    .eq("coach_id", user.id)
    .is("archived_at", null)
    .maybeSingle();
  if (activityError || !activity) {
    throw new Error("This activity is no longer available for assignment.");
  }

  const { data: clients, error: clientError } = await supabase
    .from("clients")
    .select("id")
    .eq("coach_id", user.id)
    .eq("status", "active")
    .in("id", clientIds);
  if (clientError || !clients || clients.length !== clientIds.length) {
    throw new Error("One or more selected trainees are no longer active.");
  }

  const { data: existing, error: existingError } = await supabase
    .from("client_activities")
    .select("client_id")
    .eq("activity_id", activityId)
    .in("client_id", clientIds)
    .in("status", ["active", "paused"]);
  if (existingError) throw new Error("Unable to verify current assignments.");

  const existingIds = new Set((existing ?? []).map((item) => item.client_id));
  const assignableIds = clientIds.filter((id) => !existingIds.has(id));
  const mode = activityMode(formData);
  const targets = readAssignmentTargets(
    formData,
    activity.tracked_metrics as ActivityMetricKey[]
  );

  if (assignableIds.length) {
    const { error } = await supabase.from("client_activities").insert(
      assignableIds.map((clientId) => ({
        coach_id: user.id,
        client_id: clientId,
        activity_id: activity.id,
        assignment_mode: mode,
        planned_for: plannedDate(formData, mode),
        tracked_metrics: activity.tracked_metrics,
        required_metrics: activity.required_metrics,
        targets: targets as Json,
        notes: optionalString(formData, "notes")
      }))
    );
    if (error) throw new Error(error.message);
  }

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/activities");
  revalidatePath("/dashboard/clients");
  revalidatePath("/trainee");
  return { assignedCount: assignableIds.length, skippedCount: existingIds.size };
}

export async function assignActivityAction(
  clientId: string,
  _previousState: AssignActivityState,
  formData: FormData
): Promise<AssignActivityState> {
  const activityId = String(formData.get("activity_id") ?? "");
  if (!activityId) {
    return { status: "error", message: "Select an activity.", assignedCount: 0, skippedCount: 0 };
  }

  try {
    const result = await insertAssignments(activityId, [clientId], formData);
    if (!result.assignedCount) {
      return {
        status: "error",
        message: "This activity is already assigned to the trainee.",
        ...result
      };
    }
    revalidatePath(`/dashboard/clients/${clientId}`);
    return {
      status: "success",
      message: "Activity assigned successfully.",
      ...result
    };
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Unable to assign activity.",
      assignedCount: 0,
      skippedCount: 0
    };
  }
}

export async function bulkAssignActivityAction(
  activityId: string,
  _previousState: AssignActivityState,
  formData: FormData
): Promise<AssignActivityState> {
  const clientIds = Array.from(
    new Set(formData.getAll("client_ids").map(String).filter(Boolean))
  );
  if (!clientIds.length) {
    return { status: "error", message: "Select at least one trainee.", assignedCount: 0, skippedCount: 0 };
  }
  if (clientIds.length > 200) {
    return { status: "error", message: "Select no more than 200 trainees.", assignedCount: 0, skippedCount: 0 };
  }

  try {
    const result = await insertAssignments(activityId, clientIds, formData);
    return {
      status: result.assignedCount ? "success" : "error",
      message: result.assignedCount
        ? "Activity assigned successfully."
        : "All selected trainees already have this activity assigned.",
      ...result
    };
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Unable to assign activity.",
      assignedCount: 0,
      skippedCount: 0
    };
  }
}

export async function updateActivityAssignmentsStatusAction(
  clientId: string,
  nextStatus: "active" | "paused",
  _previousState: UpdateActivityAssignmentsState,
  formData: FormData
): Promise<UpdateActivityAssignmentsState> {
  const { supabase, user } = await getUserOrRedirect();
  const assignmentIds = Array.from(
    new Set(formData.getAll("assignment_ids").map(String).filter(Boolean))
  );
  if (!assignmentIds.length) {
    return { status: "error", message: "Select at least one activity.", updatedCount: 0 };
  }
  if (assignmentIds.length > 50) {
    return { status: "error", message: "Select no more than 50 Activities.", updatedCount: 0 };
  }
  const { data: client } = await supabase
    .from("clients")
    .select("id")
    .eq("id", clientId)
    .eq("coach_id", user.id)
    .eq("status", "active")
    .maybeSingle();
  if (!client) {
    return { status: "error", message: "This trainee is not active.", updatedCount: 0 };
  }
  const currentStatus = nextStatus === "paused" ? "active" : "paused";
  const { data: assignments, error } = await supabase
    .from("client_activities")
    .select("id, activity_id")
    .eq("coach_id", user.id)
    .eq("client_id", clientId)
    .eq("status", currentStatus)
    .in("id", assignmentIds);
  if (error || !assignments || assignments.length !== assignmentIds.length) {
    return {
      status: "error",
      message: "One or more selected assignments changed. Refresh and try again.",
      updatedCount: 0
    };
  }

  if (nextStatus === "active") {
    const { data: available } = await supabase
      .from("activities")
      .select("id")
      .eq("coach_id", user.id)
      .is("archived_at", null)
      .in("id", assignments.map((item) => item.activity_id));
    if (!available || available.length !== assignments.length) {
      return {
        status: "error",
        message: "Archived activities must be restored before resuming them.",
        updatedCount: 0
      };
    }
  }

  const { data: updated, error: updateError } = await supabase
    .from("client_activities")
    .update({ status: nextStatus })
    .eq("coach_id", user.id)
    .eq("client_id", clientId)
    .eq("status", currentStatus)
    .in("id", assignmentIds)
    .select("id");
  if (updateError || updated.length !== assignmentIds.length) {
    return { status: "error", message: "Unable to update activity assignments.", updatedCount: 0 };
  }

  revalidatePath(`/dashboard/clients/${clientId}`);
  revalidatePath("/dashboard/activities");
  revalidatePath("/trainee");
  return {
    status: "success",
    message: nextStatus === "paused" ? "Activities paused." : "Activities resumed.",
    updatedCount: updated.length
  };
}

export async function createActivityLogAction(
  assignmentId: string,
  _previousState: ActivityLogState,
  formData: FormData
): Promise<ActivityLogState> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");
  const performedOn = String(formData.get("performed_on") ?? "");
  const today = new Date().toISOString().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(performedOn) || performedOn > today) {
    return { status: "error", message: "Choose today or an earlier activity date.", completedOneTime: false };
  }

  const { data: assignment, error: assignmentError } = await supabase
    .from("client_activities")
    .select("assignment_mode, tracked_metrics, required_metrics, coach_id, client_id, activities(name)")
    .eq("id", assignmentId)
    .eq("status", "active")
    .maybeSingle();
  if (assignmentError || !assignment) {
    return { status: "error", message: "This activity is no longer active.", completedOneTime: false };
  }

  try {
    const trackedMetrics = assignment.tracked_metrics as ActivityMetricKey[];
    const requiredMetrics = assignment.required_metrics as ActivityMetricKey[];
    const values = ACTIVITY_METRIC_KEYS.reduce<Partial<Record<ActivityMetricKey, number | null>>>(
      (result, key) => {
        if (!trackedMetrics.includes(key)) return result;
        result[key] = readActivityMetricValue(formData, key, key);
        return result;
      },
      {}
    );
    const missing = requiredMetrics.find((key) => values[key] === null);
    if (missing) {
      const label = missing.replaceAll("_", " ");
      return { status: "error", message: `${label} is required.`, completedOneTime: false };
    }

    const { error } = await supabase.rpc("create_assigned_activity_log", {
      target_assignment_id: assignmentId,
      target_performed_on: performedOn,
      target_duration_minutes: values.duration_minutes ?? null,
      target_distance_km: values.distance_km ?? null,
      target_elevation_gain_m: values.elevation_gain_m ?? null,
      target_calories_burned: values.calories_burned ?? null,
      target_perceived_intensity: values.perceived_intensity ?? null,
      target_notes: optionalString(formData, "notes")
    });
    if (error) throw new Error(error.message);

  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Unable to save activity.",
      completedOneTime: false
    };
  }

  if (assignment.assignment_mode === "one_time") {
    const activity = Array.isArray(assignment.activities)
      ? assignment.activities[0]
      : assignment.activities;
    const destination = user.id === assignment.coach_id
      ? `/dashboard/clients/${assignment.client_id}`
      : "/trainee";
    redirect(
      `${destination}?activityCompleted=${encodeURIComponent(activity?.name ?? "Activity")}`
    );
  }

  return {
    status: "success",
    message: "Activity completed and added to training history.",
    completedOneTime: false
  };
}

export async function archiveActivityAction(
  activityId: string
): Promise<ArchiveActivityResult> {
  const { supabase, user } = await getUserOrRedirect();
  const { data, error } = await supabase
    .from("activities")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", activityId)
    .eq("coach_id", user.id)
    .is("archived_at", null)
    .select("id")
    .maybeSingle();
  if (error || !data) {
    return { success: false, message: "We could not archive this activity." };
  }
  return { success: true };
}

export async function restoreActivityAction(
  activityId: string
): Promise<ArchiveActivityResult> {
  const { supabase, user } = await getUserOrRedirect();
  const { data, error } = await supabase
    .from("activities")
    .update({ archived_at: null })
    .eq("id", activityId)
    .eq("coach_id", user.id)
    .not("archived_at", "is", null)
    .select("id")
    .maybeSingle();
  if (error || !data) {
    return { success: false, message: "We could not restore this activity." };
  }
  return { success: true };
}
