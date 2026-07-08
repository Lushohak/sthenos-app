import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/dashboard/page-header";
import { LinkButton } from "@/components/ui/button";
import {
  AssignRoutineForm,
  BodyProgressForm,
  WorkoutLogForm
} from "@/components/forms/client-activity-forms";
import { Table, Td, Th } from "@/components/ui/table";
import { getUserOrRedirect } from "@/lib/auth";
import { formatDate } from "@/lib/utils";

type PageProps = {
  params: Promise<{ clientId: string }>;
};

export default async function ClientProfilePage({ params }: PageProps) {
  const { clientId } = await params;
  const { supabase, user } = await getUserOrRedirect();

  const [
    { data: client, error: clientError },
    { data: routines },
    { data: assignments },
    { data: logs },
    { data: progress }
  ] = await Promise.all([
    supabase
      .from("clients")
      .select("*")
      .eq("coach_id", user.id)
      .eq("id", clientId)
      .single(),
    supabase.from("workout_routines").select("*").eq("coach_id", user.id).order("name"),
    supabase
      .from("client_routines")
      .select("*, workout_routines(id, name)")
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
      .order("recorded_on", { ascending: false })
  ]);

  if (clientError || !client) notFound();

  return (
    <>
      <PageHeader
        title={client.name}
        description={client.goal ?? "No goal set yet."}
        action={<LinkButton href={`/dashboard/clients/${client.id}/edit`}>Edit client</LinkButton>}
      />
      <section className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-md border bg-white p-4 shadow-soft">
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
          <h2 className="mb-3 font-semibold">Assign routine</h2>
          <AssignRoutineForm clientId={client.id} routines={routines ?? []} />
        </div>
      </section>
      <section className="mt-8 grid gap-6 xl:grid-cols-2">
        <div>
          <h2 className="mb-3 font-semibold">Training log</h2>
          <WorkoutLogForm clientId={client.id} assignments={(assignments ?? []) as never} />
          <div className="mt-4">
            <Table>
              <thead>
                <tr>
                  <Th>Date</Th>
                  <Th>Routine</Th>
                  <Th>Notes</Th>
                </tr>
              </thead>
              <tbody>
                {logs?.map((log) => (
                  <tr key={log.id}>
                    <Td>{formatDate(log.trained_on)}</Td>
                    <Td>{Array.isArray(log.workout_routines) ? log.workout_routines[0]?.name : log.workout_routines?.name ?? "None"}</Td>
                    <Td>{log.notes ?? "No notes"}</Td>
                  </tr>
                ))}
                {!logs?.length ? (
                  <tr>
                    <Td colSpan={3}>No completed workouts yet.</Td>
                  </tr>
                ) : null}
              </tbody>
            </Table>
          </div>
        </div>
        <div>
          <h2 className="mb-3 font-semibold">Body progress</h2>
          <BodyProgressForm clientId={client.id} />
          <div className="mt-4">
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
        <Link href="/dashboard/routines" className="text-primary">Manage routine templates</Link>
      </p>
    </>
  );
}
