import Link from "next/link";
import { PageHeader } from "@/components/dashboard/page-header";
import { Table, Td, Th } from "@/components/ui/table";
import { getUserOrRedirect } from "@/lib/auth";
import { formatDate } from "@/lib/utils";

export default async function ProgressPage() {
  const { supabase, user } = await getUserOrRedirect();
  const { data: entries, error } = await supabase
    .from("body_progress_entries")
    .select("*, clients(id, name)")
    .eq("coach_id", user.id)
    .order("recorded_on", { ascending: false });

  if (error) throw new Error(error.message);

  return (
    <>
      <PageHeader
        title="Progress"
        description="Review body composition history across all active trainees."
      />
      <Table>
        <thead>
          <tr>
            <Th>Client</Th>
            <Th>Date</Th>
            <Th>Weight</Th>
            <Th>Body fat</Th>
            <Th>Waist</Th>
            <Th>Chest</Th>
            <Th>Arms</Th>
            <Th>Legs</Th>
          </tr>
        </thead>
        <tbody>
          {entries?.map((entry) => {
            const client = Array.isArray(entry.clients) ? entry.clients[0] : entry.clients;
            return (
              <tr key={entry.id}>
                <Td>
                  {client ? (
                    <Link className="font-medium text-primary" href={`/dashboard/clients/${client.id}`}>
                      {client.name}
                    </Link>
                  ) : (
                    "Unknown"
                  )}
                </Td>
                <Td>{formatDate(entry.recorded_on)}</Td>
                <Td>{entry.body_weight} kg</Td>
                <Td>{entry.body_fat_percentage ? `${entry.body_fat_percentage}%` : "Not set"}</Td>
                <Td>{entry.waist ?? "Not set"}</Td>
                <Td>{entry.chest ?? "Not set"}</Td>
                <Td>{entry.arms ?? "Not set"}</Td>
                <Td>{entry.legs ?? "Not set"}</Td>
              </tr>
            );
          })}
          {!entries?.length ? (
            <tr>
              <Td colSpan={8}>No progress entries yet.</Td>
            </tr>
          ) : null}
        </tbody>
      </Table>
    </>
  );
}
