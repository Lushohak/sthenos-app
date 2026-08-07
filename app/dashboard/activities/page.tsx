import Link from "next/link";
import { PageHeader } from "@/components/dashboard/page-header";
import { ActivityThumbnail } from "@/components/activities/activity-thumbnail";
import { LinkButton } from "@/components/ui/button";
import { ArchiveStatusToast } from "@/components/ui/archive-status-toast";
import { Table, Td, Th } from "@/components/ui/table";
import { getUserOrRedirect } from "@/lib/auth";
import { formatDate } from "@/lib/utils";

type PageProps = {
  searchParams?: Promise<{ archived?: string; restored?: string; view?: string }>;
};

export default async function ActivitiesPage({ searchParams }: PageProps) {
  const query = await searchParams;
  const showArchived = query?.view === "archived";
  const { supabase, user } = await getUserOrRedirect();
  let request = supabase.from("activities").select("*").eq("coach_id", user.id);
  request = showArchived
    ? request.not("archived_at", "is", null)
    : request.is("archived_at", null);
  const { data: activities, error } = await request.order("created_at", { ascending: false });
  if (error) throw new Error(error.message);

  return (
    <>
      <PageHeader
        title="Activities"
        description={showArchived ? "Review and restore archived Activity templates." : "Create measurable Activities and prescribe them to trainees."}
        action={<LinkButton href="/dashboard/activities/new">New Activity</LinkButton>}
      />
      <div className="mb-4 flex flex-wrap gap-2" aria-label="Activity views">
        <LinkButton href="/dashboard/activities" variant={showArchived ? "ghost" : "secondary"}>Active Activities</LinkButton>
        <LinkButton href="/dashboard/activities?view=archived" variant={showArchived ? "secondary" : "ghost"}>Archived Activities</LinkButton>
      </div>
      <Table>
        <thead><tr><Th>Name</Th><Th>Tracked metrics</Th><Th>Description</Th><Th>Created</Th></tr></thead>
        <tbody>
          {activities?.map((activity) => (
            <tr key={activity.id}>
              <Td>
                <Link className="flex items-center gap-3 font-medium text-info hover:text-info/80" href={`/dashboard/activities/${activity.id}`}>
                  <ActivityThumbnail src={activity.thumbnail_url} alt="" className="h-12 w-16 shrink-0" />
                  <span>{activity.name}</span>
                </Link>
              </Td>
              <Td>{activity.tracked_metrics.length || "Completion only"}</Td>
              <Td>{activity.description ?? "No description"}</Td>
              <Td>{formatDate(activity.created_at)}</Td>
            </tr>
          ))}
          {!activities?.length ? (
            <tr><Td colSpan={4}>{showArchived ? "No archived Activities." : "No active Activities yet."}</Td></tr>
          ) : null}
        </tbody>
      </Table>
      {query?.archived ? <ArchiveStatusToast itemName={query.archived} action="archived" description="It is hidden from new assignments. Existing active assignments remain available." /> : null}
      {query?.restored ? <ArchiveStatusToast itemName={query.restored} action="restored" description="The Activity can be edited and assigned again." /> : null}
    </>
  );
}
