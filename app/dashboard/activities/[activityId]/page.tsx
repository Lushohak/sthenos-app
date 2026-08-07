import { notFound } from "next/navigation";
import { ActivityThumbnail } from "@/components/activities/activity-thumbnail";
import { ActivityMetrics } from "@/components/activities/activity-metrics";
import { ArchiveActivity } from "@/components/activities/archive-activity";
import { PageHeader } from "@/components/dashboard/page-header";
import { LinkButton } from "@/components/ui/button";
import { getUserOrRedirect } from "@/lib/auth";
import { parseActivityTargets } from "@/lib/activities";

type PageProps = { params: Promise<{ activityId: string }> };

export default async function ActivityDetailPage({ params }: PageProps) {
  const { activityId } = await params;
  const { supabase, user } = await getUserOrRedirect();
  const [{ data: activity, error }, { data: assignments }] = await Promise.all([
    supabase.from("activities").select("*").eq("id", activityId).eq("coach_id", user.id).maybeSingle(),
    supabase
      .from("client_activities")
      .select("client_id, clients(id, name)")
      .eq("activity_id", activityId)
      .eq("coach_id", user.id)
      .in("status", ["active", "paused"])
  ]);
  if (error || !activity) notFound();
  const isArchived = Boolean(activity.archived_at);
  const affectedClients = (assignments ?? []).flatMap((assignment) => {
    const client = Array.isArray(assignment.clients) ? assignment.clients[0] : assignment.clients;
    return client ? [{ id: client.id, name: client.name }] : [];
  });

  return (
    <>
      <PageHeader
        title={activity.name}
        description={isArchived ? "This Activity is archived and available in read-only mode." : activity.description ?? "A reusable measurable Activity."}
        action={!isArchived ? (
          <div className="flex flex-wrap gap-2">
            <LinkButton href={`/dashboard/activities/${activity.id}/edit`} variant="secondary">Edit Activity</LinkButton>
            <LinkButton href={`/dashboard/activities/${activity.id}/assign`}>Assign trainees</LinkButton>
          </div>
        ) : undefined}
      />
      {isArchived ? <div className="mb-6 rounded-md border border-info/30 bg-info/5 px-4 py-3 text-sm text-info shadow-soft">Archived Activities cannot be edited or newly assigned. Existing active assignments remain available.</div> : null}
      <section className="grid gap-5 rounded-xl border bg-card p-4 shadow-soft md:grid-cols-[minmax(0,22rem)_1fr] md:p-5">
        <ActivityThumbnail src={activity.thumbnail_url} alt={`${activity.name} reference`} className="w-full" />
        <div>
          <h2 className="text-lg font-semibold">Logging configuration</h2>
          <p className="mt-1 text-sm text-muted-foreground">Assignment targets begin with these defaults and can be tailored before assignment.</p>
          <ActivityMetrics
            className="mt-4"
            trackedMetrics={activity.tracked_metrics}
            requiredMetrics={activity.required_metrics}
            targets={parseActivityTargets(activity.default_targets)}
          />
        </div>
      </section>
      <ArchiveActivity activityId={activity.id} activityName={activity.name} isArchived={isArchived} affectedClients={affectedClients} />
    </>
  );
}
