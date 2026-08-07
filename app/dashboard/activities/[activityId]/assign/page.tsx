import { notFound } from "next/navigation";
import { PageHeader } from "@/components/dashboard/page-header";
import { BulkAssignActivityForm } from "@/components/forms/bulk-assign-activity-form";
import { getUserOrRedirect } from "@/lib/auth";

type PageProps = { params: Promise<{ activityId: string }> };

export default async function AssignActivityPage({ params }: PageProps) {
  const { activityId } = await params;
  const { supabase, user } = await getUserOrRedirect();
  const [{ data: activity }, { data: trainees }, { data: assignments }] = await Promise.all([
    supabase.from("activities").select("*").eq("id", activityId).eq("coach_id", user.id).is("archived_at", null).maybeSingle(),
    supabase.from("clients").select("id, name, email").eq("coach_id", user.id).eq("status", "active").order("name"),
    supabase.from("client_activities").select("client_id, status").eq("activity_id", activityId).eq("coach_id", user.id).in("status", ["active", "paused"])
  ]);
  if (!activity) notFound();
  const statusByClient = new Map((assignments ?? []).map((item) => [item.client_id, item.status]));

  return (
    <>
      <PageHeader title={`Assign ${activity.name}`} description="Apply one Activity prescription to several trainees." />
      <BulkAssignActivityForm
        activity={{
          id: activity.id,
          name: activity.name,
          trackedMetrics: activity.tracked_metrics,
          requiredMetrics: activity.required_metrics,
          defaultTargets: activity.default_targets
        }}
        trainees={(trainees ?? []).map((trainee) => ({
          ...trainee,
          existingAssignmentStatus: (statusByClient.get(trainee.id) as "active" | "paused" | undefined) ?? null
        }))}
      />
    </>
  );
}
