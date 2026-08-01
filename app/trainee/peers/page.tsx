import { UserRound, Users } from "lucide-react";
import { PageHeader } from "@/components/dashboard/page-header";
import { getTraineeOrRedirect } from "@/lib/trainee";
import type { Database } from "@/types/database";

type TraineePeer =
  Database["public"]["Functions"]["get_trainee_peers"]["Returns"][number];

function getInitials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

export default async function TraineePeersPage() {
  const { supabase } = await getTraineeOrRedirect();
  const { data, error } = await supabase.rpc("get_trainee_peers");

  if (error) {
    throw new Error("Unable to load trainee peers.");
  }

  const peers = (data ?? []) as TraineePeer[];

  return (
    <>
      <PageHeader
        title="Peers"
        description="Meet the other active trainees working with your coach."
      />

      <div className="mb-6 rounded-lg border border-info/30 bg-info/5 px-4 py-3 text-sm text-muted-foreground">
        To protect everyone&apos;s privacy, this page only shares trainee names. Progress,
        measurements, contact details, and coach notes always remain private.
      </div>

      {peers.length ? (
        <section aria-labelledby="peer-list-title">
          <div className="mb-4 flex items-center justify-between gap-4">
            <h2 id="peer-list-title" className="flex items-center gap-2 text-lg font-semibold">
              <Users className="h-5 w-5 text-info" aria-hidden="true" />
              Your training community
            </h2>
            <span className="rounded-full bg-muted px-3 py-1 text-sm text-muted-foreground">
              {peers.length} {peers.length === 1 ? "peer" : "peers"}
            </span>
          </div>
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {peers.map((peer, index) => (
              <li
                key={`${peer.name}-${index}`}
                className="flex items-center gap-4 rounded-xl border bg-card p-4 shadow-soft"
              >
                <span
                  className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-secondary/15 font-semibold text-secondary-hover"
                  aria-hidden="true"
                >
                  {getInitials(peer.name)}
                </span>
                <div className="min-w-0">
                  <p className="truncate font-semibold">{peer.name}</p>
                  <p className="mt-1 text-sm text-muted-foreground">Training alongside you</p>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : (
        <div className="rounded-xl border border-dashed bg-card p-10 text-center shadow-soft">
          <UserRound className="mx-auto h-9 w-9 text-muted-foreground" aria-hidden="true" />
          <p className="mt-3 font-medium">No peers to show yet</p>
          <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
            When another active trainee joins your coach, you will see their name here.
          </p>
        </div>
      )}
    </>
  );
}
