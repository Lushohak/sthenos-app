import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/dashboard/page-header";
import { StatCard } from "@/components/dashboard/stat-card";
import { LinkButton } from "@/components/ui/button";
import {
  BodyProgressForm,
  WorkoutLogForm
} from "@/components/forms/client-activity-forms";
import { AssignRoutineForm } from "@/components/forms/assign-routine-form";
import { AssignActivityForm } from "@/components/forms/assign-activity-form";
import { TraineeInviteForm } from "@/components/forms/trainee-invite-form";
import { DeleteClientAccount } from "@/components/clients/delete-client-account";
import { ArchiveClient } from "@/components/clients/archive-client";
import { ManageRoutineAssignments } from "@/components/clients/manage-routine-assignments";
import { ManageActivityAssignments } from "@/components/activities/manage-activity-assignments";
import { ActivityCompletedToast } from "@/components/activities/activity-completed-toast";
import { ActivityActions } from "@/components/trainee/activity-actions";
import { Table, Td, Th } from "@/components/ui/table";
import { getUserOrRedirect } from "@/lib/auth";
import { formatDate } from "@/lib/utils";
import {
  ACTIVITY_METRIC_KEYS,
  activityMetricValuesFromLog,
  formatActivityMetricResult,
  parseActivityTargets,
  summarizeActivityLogs
} from "@/lib/activities";

type PageProps = {
  params: Promise<{ clientId: string }>;
  searchParams?: Promise<{ invite?: string; activityCompleted?: string }>;
};

export default async function ClientProfilePage({ params, searchParams }: PageProps) {
  const { clientId } = await params;
  const resolvedSearchParams = await searchParams;
  const inviteStatus = resolvedSearchParams?.invite;
  const activityCompleted = resolvedSearchParams?.activityCompleted;
  const { supabase, user } = await getUserOrRedirect();
  const today = new Date().toISOString().slice(0, 10);
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const activitySince = thirtyDaysAgo.toISOString().slice(0, 10);

  const [
    { data: client, error: clientError },
    { data: routines },
    { data: assignments },
    { data: logs },
    { data: progress },
    { data: activities },
    { data: activityAssignments },
    { data: activityLogs },
    { data: recentActivityLogs }
  ] = await Promise.all([
    supabase
      .from("clients")
      .select("*")
      .eq("coach_id", user.id)
      .eq("id", clientId)
      .single(),
    supabase
      .from("workout_routines")
      .select("*")
      .eq("coach_id", user.id)
      .is("archived_at", null)
      .order("name"),
    supabase
      .from("client_routines")
      .select("*, workout_routines(id, name, archived_at)")
      .eq("coach_id", user.id)
      .eq("client_id", clientId)
      .order("assigned_at", { ascending: false }),
    supabase
      .from("workout_logs")
      .select("*, workout_routines(name)")
      .eq("coach_id", user.id)
      .eq("client_id", clientId)
      .order("trained_on", { ascending: false })
      .limit(10),
    supabase
      .from("body_progress_entries")
      .select("*")
      .eq("coach_id", user.id)
      .eq("client_id", clientId)
      .order("recorded_on", { ascending: false }),
    supabase
      .from("activities")
      .select("*")
      .eq("coach_id", user.id)
      .is("archived_at", null)
      .order("name"),
    supabase
      .from("client_activities")
      .select("*, activities(id, name, archived_at, tracked_metrics, required_metrics, default_targets)")
      .eq("coach_id", user.id)
      .eq("client_id", clientId)
      .order("assigned_at", { ascending: false }),
    supabase
      .from("activity_logs")
      .select("*, activities(name), client_activities(targets)")
      .eq("coach_id", user.id)
      .eq("client_id", clientId)
      .order("performed_on", { ascending: false })
      .limit(20),
    supabase
      .from("activity_logs")
      .select("duration_minutes, distance_km, elevation_gain_m, calories_burned, perceived_intensity")
      .eq("coach_id", user.id)
      .eq("client_id", clientId)
      .gte("performed_on", activitySince)
  ]);

  if (clientError || !client) notFound();

  const manageableAssignments = (assignments ?? []).flatMap((assignment) => {
    if (assignment.status !== "active" && assignment.status !== "paused") {
      return [];
    }

    const routine = Array.isArray(assignment.workout_routines)
      ? assignment.workout_routines[0]
      : assignment.workout_routines;

    if (!routine) return [];

    return [
      {
        id: assignment.id,
        routineName: routine.name,
        status: assignment.status,
        routineArchived: Boolean(routine.archived_at)
      }
    ];
  });
  const manageableActivityAssignments = (activityAssignments ?? []).flatMap((assignment) => {
    if (assignment.status !== "active" && assignment.status !== "paused") return [];
    const activity = Array.isArray(assignment.activities) ? assignment.activities[0] : assignment.activities;
    return activity ? [{ id: assignment.id, activityName: activity.name, status: assignment.status, activityArchived: Boolean(activity.archived_at) }] : [];
  });
  const activeActivityAssignments = (activityAssignments ?? []).flatMap((assignment) => {
    if (assignment.status !== "active") return [];
    const activity = Array.isArray(assignment.activities) ? assignment.activities[0] : assignment.activities;
    return activity ? [{ ...assignment, activity }] : [];
  });
  const trainingHistory = [
    ...(logs ?? []).map((log) => {
      const routine = Array.isArray(log.workout_routines) ? log.workout_routines[0] : log.workout_routines;
      return { id: log.id, type: "Workout", date: log.trained_on, name: routine?.name ?? "Workout", results: log.duration_minutes ? `${log.duration_minutes} min` : "Completed", notes: log.notes };
    }),
    ...(activityLogs ?? []).map((log) => {
      const activity = Array.isArray(log.activities) ? log.activities[0] : log.activities;
      const values = activityMetricValuesFromLog(log);
      const assignment = Array.isArray(log.client_activities) ? log.client_activities[0] : log.client_activities;
      const targets = parseActivityTargets(assignment?.targets ?? null);
      return { id: log.id, type: "Activity", date: log.performed_on, name: activity?.name ?? "Activity", results: ACTIVITY_METRIC_KEYS.flatMap((key) => values[key] === undefined ? [] : [formatActivityMetricResult(key, values[key]!, targets)]).join(" · ") || "Completed", notes: log.notes };
    })
  ].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 10);
  const activityInsights = summarizeActivityLogs(recentActivityLogs ?? []);

  return (
    <>
      {activityCompleted ? <ActivityCompletedToast activityName={activityCompleted} /> : null}
      <PageHeader
        title={client.name}
        description={client.goal ?? "No goal set yet."}
        action={<LinkButton href={`/dashboard/clients/${client.id}/edit`}>Edit client</LinkButton>}
      />
      {inviteStatus === "sent" ? (
        <div className="mb-4 rounded-md border border-success/40 bg-success/5 px-4 py-3 text-sm text-success shadow-soft">
          Invite email sent.
        </div>
      ) : null}
      {inviteStatus === "resent" ? (
        <div className="mb-4 rounded-md border border-success/40 bg-success/5 px-4 py-3 text-sm text-success shadow-soft">
          A new password setup email was sent.
        </div>
      ) : null}
      {inviteStatus === "error" ? (
        <div className="mb-4 rounded-md border border-destructive/25 bg-card px-4 py-3 text-sm text-destructive shadow-soft">
          The authentication email could not be sent. Check the server logs for
          the Supabase error code.
        </div>
      ) : null}
      {inviteStatus === "email-exists" ? (
        <div className="mb-4 rounded-md border border-destructive/25 bg-card px-4 py-3 text-sm text-destructive shadow-soft">
          This email already belongs to another Supabase Auth account. Use a
          different email, or remove the unused Auth user before inviting again.
        </div>
      ) : null}
      {inviteStatus === "email-not-authorized" ? (
        <div className="mb-4 rounded-md border border-destructive/25 bg-card px-4 py-3 text-sm text-destructive shadow-soft">
          Supabase cannot send to this address with its default email service.
          Configure custom SMTP in Supabase Authentication settings, then try
          again.
        </div>
      ) : null}
      {inviteStatus === "invalid-email" ? (
        <div className="mb-4 rounded-md border border-destructive/25 bg-card px-4 py-3 text-sm text-destructive shadow-soft">
          Supabase rejected this email address. Check it for mistakes and avoid
          example or test-only domains.
        </div>
      ) : null}
      {inviteStatus === "email-disabled" ? (
        <div className="mb-4 rounded-md border border-destructive/25 bg-card px-4 py-3 text-sm text-destructive shadow-soft">
          Email authentication is disabled in Supabase. Enable the email
          provider before sending trainee invitations.
        </div>
      ) : null}
      {inviteStatus === "rate-limited" ? (
        <div className="mb-4 rounded-md border border-warning/40 bg-warning/5 px-4 py-3 text-sm text-warning shadow-soft">
          Supabase temporarily limited authentication emails. Wait a few minutes
          before trying again.
        </div>
      ) : null}
      {inviteStatus === "account-missing" ? (
        <div className="mb-4 rounded-md border border-destructive/25 bg-card px-4 py-3 text-sm text-destructive shadow-soft">
          The linked Auth account no longer exists. Refresh this page and send a
          new invitation.
        </div>
      ) : null}
      {inviteStatus === "account-mismatch" ? (
        <div className="mb-4 rounded-md border border-destructive/25 bg-card px-4 py-3 text-sm text-destructive shadow-soft">
          The trainee email no longer matches the linked Auth account. Restore
          the original email or contact an administrator before sending another
          setup link.
        </div>
      ) : null}
      {inviteStatus === "active" ? (
        <div className="mb-4 rounded-md border border-success/40 bg-success/5 px-4 py-3 text-sm text-success shadow-soft">
          This trainee has already completed account setup.
        </div>
      ) : null}
      {inviteStatus === "missing-email" ? (
        <div className="mb-4 rounded-md border border-warning/40 bg-warning/5 px-4 py-3 text-sm text-warning shadow-soft">
          Add an email to this trainee before sending an invite.
        </div>
      ) : null}
      <section className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-md border bg-card p-4 shadow-soft">
          <h2 className="font-semibold">Profile</h2>
          <dl className="mt-4 grid gap-3 text-sm">
            <div>
              <dt className="text-muted-foreground">Email</dt>
              <dd>{client.email ?? "Not set"}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Age</dt>
              <dd>{client.age ?? "Not set"}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Status</dt>
              <dd className="capitalize">{client.status}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Notes</dt>
              <dd>{client.notes ?? "No notes"}</dd>
            </div>
          </dl>
        </div>
        <div className="lg:col-span-2">
          <div className="grid gap-4">
            {client.status !== "archived" ? (
              <>
              <TraineeInviteForm
                clientId={client.id}
                clientUserId={client.client_user_id}
                email={client.email}
                invitedAt={client.invited_at}
                acceptedAt={client.invitation_accepted_at}
              />
              <div>
                <h2 className="mb-3 font-semibold">Assign routine</h2>
                <AssignRoutineForm
                  clientId={client.id}
                  clientName={client.name}
                  routines={routines ?? []}
                  assignedRoutineIds={(assignments ?? [])
                    .filter(
                      (assignment) =>
                        assignment.status === "active" ||
                        assignment.status === "paused"
                    )
                    .map((assignment) => assignment.routine_id)}
                />
              </div>
              <ManageRoutineAssignments
                clientId={client.id}
                clientName={client.name}
                assignments={manageableAssignments}
              />
              <div>
                <h2 className="mb-3 font-semibold">Assign Activity</h2>
                <AssignActivityForm
                  clientId={client.id}
                  clientName={client.name}
                  activities={activities ?? []}
                  assignedActivityIds={(activityAssignments ?? []).filter((assignment) => assignment.status === "active" || assignment.status === "paused").map((assignment) => assignment.activity_id)}
                />
              </div>
              <ManageActivityAssignments
                clientId={client.id}
                clientName={client.name}
                assignments={manageableActivityAssignments}
              />
              </>
            ) : (
              <div className="rounded-md border border-info/30 bg-info/5 p-4 text-sm text-muted-foreground shadow-soft">
                Restore this client to send account invitations, create progress
                entries, or assign additional routines. Existing records remain
                available below.
              </div>
            )}
          </div>
        </div>
      </section>
      <section className="mt-8">
        <h2 className="mb-3 font-semibold">Activity insights · Last 30 days</h2>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
          <StatCard label="Activities" value={activityInsights.completions} />
          {activityInsights.durationMinutes ? <StatCard label="Duration" value={`${activityInsights.durationMinutes} min`} /> : null}
          {activityInsights.distanceKm ? <StatCard label="Distance" value={`${activityInsights.distanceKm.toFixed(2)} km`} /> : null}
          {activityInsights.elevationGainM ? <StatCard label="Elevation" value={`${activityInsights.elevationGainM.toFixed(0)} m`} /> : null}
          {activityInsights.caloriesBurned ? <StatCard label="Est. calories" value={`${activityInsights.caloriesBurned} kcal`} /> : null}
          {activityInsights.averageIntensity !== null ? <StatCard label="Average intensity" value={`${activityInsights.averageIntensity.toFixed(1)}/10`} /> : null}
        </div>
      </section>
      <section className="mt-8 grid gap-6 xl:grid-cols-2">
        <div>
          <h2 className="mb-3 font-semibold">Training history</h2>
          {client.status !== "archived" ? (
            <WorkoutLogForm clientId={client.id} assignments={(assignments ?? []) as never} />
          ) : null}
          {client.status !== "archived" && activeActivityAssignments.length ? (
            <div className="mt-4 grid gap-3">
              <h3 className="text-sm font-semibold">Log an Activity for this trainee</h3>
              {activeActivityAssignments.map((assignment) => (
                <div key={assignment.id} className="overflow-hidden rounded-md border bg-card shadow-soft">
                  <div className="px-4 pt-4">
                    <p className="font-medium">{assignment.activity.name}</p>
                    <p className="text-xs text-muted-foreground">Use the same fields and targets shown to the trainee.</p>
                  </div>
                  <ActivityActions
                    assignmentId={assignment.id}
                    activityName={assignment.activity.name}
                    trackedMetrics={assignment.tracked_metrics}
                    requiredMetrics={assignment.required_metrics}
                    targets={parseActivityTargets(assignment.targets)}
                    today={today}
                  />
                </div>
              ))}
            </div>
          ) : null}
          <div className={client.status !== "archived" ? "mt-4" : undefined}>
            <Table>
              <thead>
                <tr>
                  <Th>Date</Th>
                  <Th>Type</Th>
                  <Th>Session</Th>
                  <Th>Results</Th>
                  <Th>Notes</Th>
                </tr>
              </thead>
              <tbody>
                {trainingHistory.map((item) => (
                  <tr key={`${item.type}-${item.id}`}>
                    <Td>{formatDate(item.date)}</Td>
                    <Td>{item.type}</Td>
                    <Td>{item.name}</Td>
                    <Td>{item.results}</Td>
                    <Td>{item.notes ?? "No notes"}</Td>
                  </tr>
                ))}
                {!trainingHistory.length ? (
                  <tr>
                    <Td colSpan={5}>No completed training yet.</Td>
                  </tr>
                ) : null}
              </tbody>
            </Table>
          </div>
        </div>
        <div>
          <h2 className="mb-3 font-semibold">Body progress</h2>
          {client.status !== "archived" ? <BodyProgressForm clientId={client.id} /> : null}
          <div className={client.status !== "archived" ? "mt-4" : undefined}>
            <Table>
              <thead>
                <tr>
                  <Th>Date</Th>
                  <Th>Weight</Th>
                  <Th>Body fat</Th>
                  <Th>Waist</Th>
                </tr>
              </thead>
              <tbody>
                {progress?.map((entry) => (
                  <tr key={entry.id}>
                    <Td>{formatDate(entry.recorded_on)}</Td>
                    <Td>{entry.body_weight} kg</Td>
                    <Td>{entry.body_fat_percentage ? `${entry.body_fat_percentage}%` : "Not set"}</Td>
                    <Td>{entry.waist ?? "Not set"}</Td>
                  </tr>
                ))}
                {!progress?.length ? (
                  <tr>
                    <Td colSpan={4}>No progress entries yet.</Td>
                  </tr>
                ) : null}
              </tbody>
            </Table>
          </div>
        </div>
      </section>
      <p className="mt-6 text-sm text-muted-foreground">
        <Link href="/dashboard/routines" className="font-medium text-info hover:text-info/80">Manage routine templates</Link>
      </p>
      <ArchiveClient
        clientId={client.id}
        clientName={client.name}
        isArchived={client.status === "archived"}
        assignmentCount={assignments?.length ?? 0}
      />
      <DeleteClientAccount
        clientId={client.id}
        clientName={client.name}
        hasLoginAccount={Boolean(client.client_user_id)}
      />
    </>
  );
}
