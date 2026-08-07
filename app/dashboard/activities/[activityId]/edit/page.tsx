import { notFound } from "next/navigation";
import { PageHeader } from "@/components/dashboard/page-header";
import { ActivityForm } from "@/components/forms/activity-form";
import { updateActivityAction } from "@/lib/actions/activities";
import { parseActivityTargets } from "@/lib/activities";
import { getUserOrRedirect } from "@/lib/auth";

type PageProps = { params: Promise<{ activityId: string }> };

export default async function EditActivityPage({ params }: PageProps) {
  const { activityId } = await params;
  const { supabase, user } = await getUserOrRedirect();
  const { data: activity } = await supabase
    .from("activities")
    .select("*")
    .eq("id", activityId)
    .eq("coach_id", user.id)
    .is("archived_at", null)
    .maybeSingle();
  if (!activity) notFound();

  return (
    <>
      <PageHeader title={`Edit ${activity.name}`} description="Update the template used for future Activity assignments." />
      <ActivityForm
        action={updateActivityAction.bind(null, activity.id)}
        initialActivity={{
          name: activity.name,
          description: activity.description,
          thumbnailUrl: activity.thumbnail_url,
          trackedMetrics: activity.tracked_metrics,
          requiredMetrics: activity.required_metrics,
          defaultTargets: parseActivityTargets(activity.default_targets)
        }}
      />
    </>
  );
}
