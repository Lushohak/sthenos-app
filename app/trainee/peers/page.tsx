import {
  CalendarClock,
  CheckCircle2,
  Flame,
  LockKeyhole,
  UserRound,
  Users
} from "lucide-react";
import { PageHeader } from "@/components/dashboard/page-header";
import { PeerSharingControl } from "@/components/trainee/peer-sharing-control";
import { getTraineeOrRedirect } from "@/lib/trainee";
import { formatDate } from "@/lib/utils";
import type { Database, Json } from "@/types/database";

type SocialFeedEntry =
  Database["public"]["Functions"]["get_trainee_social_feed"]["Returns"][number];

type RecentTraining = {
  type: "Workout" | "Activity";
  name: string;
  trained_on: string;
};

function getInitials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

function parseRecentTrainings(value: Json): RecentTraining[] {
  if (!Array.isArray(value)) return [];

  return value.flatMap((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return [];
    const type = item.type;
    const name = item.name;
    const trainedOn = item.trained_on;
    if (
      (type !== "Workout" && type !== "Activity")
      || typeof name !== "string"
      || typeof trainedOn !== "string"
    ) {
      return [];
    }
    return [{ type, name, trained_on: trainedOn }];
  });
}

function StreakSummary({ entry }: { entry: SocialFeedEntry }) {
  const streak = entry.current_streak_weeks ?? 0;
  const isViewer = entry.is_viewer;

  return (
    <div className="mt-4 flex flex-wrap items-center gap-3">
      <span className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1.5 text-sm font-semibold text-primary">
        <Flame className="h-4 w-4" aria-hidden="true" />
        {streak} {streak === 1 ? "week" : "weeks"}
      </span>
      {entry.trained_this_week ? (
        <span className="inline-flex items-center gap-1.5 text-sm font-medium text-success">
          <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
          Trained this week
        </span>
      ) : (
        <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
          <CalendarClock className="h-4 w-4" aria-hidden="true" />
          {streak > 0
            ? isViewer ? "Train this week to extend it" : "Can extend it this week"
            : isViewer ? "Complete a session to start" : "No active streak yet"}
        </span>
      )}
    </div>
  );
}

function RecentTrainingList({ trainings }: { trainings: RecentTraining[] }) {
  if (!trainings.length) {
    return <p className="mt-4 text-sm text-muted-foreground">No training sessions logged yet.</p>;
  }

  return (
    <div className="mt-5 border-t pt-4">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Recent training</h3>
      <ol className="mt-3 grid gap-2">
        {trainings.map((training, index) => (
          <li
            key={`${training.type}-${training.trained_on}-${training.name}-${index}`}
            className="flex items-start justify-between gap-3 rounded-lg bg-muted/50 px-3 py-2.5"
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{training.name}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">{training.type}</p>
            </div>
            <time className="shrink-0 text-xs text-muted-foreground" dateTime={training.trained_on}>
              {formatDate(training.trained_on)}
            </time>
          </li>
        ))}
      </ol>
    </div>
  );
}

function ConsistencyCard({
  entry,
  viewerSharingEnabled
}: {
  entry: SocialFeedEntry;
  viewerSharingEnabled: boolean;
}) {
  const trainings = parseRecentTrainings(entry.recent_trainings);
  const isPrivate = !entry.is_viewer && !entry.activity_visible;

  return (
    <article
      aria-label={entry.is_viewer ? "Your consistency" : `${entry.name}'s consistency`}
      className={entry.is_viewer
        ? "rounded-xl border border-primary/40 bg-primary/5 p-5 shadow-soft"
        : "rounded-xl border bg-card p-5 shadow-soft"}
    >
      <div className="flex items-center gap-3">
        <span
          className={entry.is_viewer
            ? "flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary/15 font-semibold text-primary"
            : "flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-secondary/15 font-semibold text-secondary-hover"}
          aria-hidden="true"
        >
          {getInitials(entry.name)}
        </span>
        <div className="min-w-0">
          <p className="truncate font-semibold">{entry.is_viewer ? "Your consistency" : entry.name}</p>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {entry.is_viewer ? entry.name : "Training alongside you"}
          </p>
        </div>
      </div>

      {isPrivate ? (
        <div className="mt-4 rounded-lg border border-dashed bg-muted/30 p-4 text-sm text-muted-foreground">
          <p className="flex items-center gap-2 font-medium text-foreground">
            <LockKeyhole className="h-4 w-4" aria-hidden="true" />
            Training activity is private
          </p>
          <p className="mt-1">
            {viewerSharingEnabled
              ? `${entry.name} has chosen not to share streaks or recent training.`
              : "Turn on your sharing to see activity from peers who also share."}
          </p>
        </div>
      ) : (
        <>
          <StreakSummary entry={entry} />
          <RecentTrainingList trainings={trainings} />
        </>
      )}
    </article>
  );
}

export default async function TraineePeersPage() {
  const { supabase } = await getTraineeOrRedirect();
  const { data, error } = await supabase.rpc("get_trainee_social_feed");

  if (error) throw new Error("Unable to load trainee peers.");

  const feed = (data ?? []) as SocialFeedEntry[];
  const viewer = feed.find((entry) => entry.is_viewer);
  if (!viewer) throw new Error("Unable to load your trainee community.");
  const peers = feed.filter((entry) => !entry.is_viewer);

  return (
    <>
      <PageHeader
        title="Peers"
        description="Build consistency alongside the other trainees working with your coach."
      />

      <div className="mb-6 rounded-lg border border-info/30 bg-info/5 px-4 py-3 text-sm text-muted-foreground">
        Sharing is limited to first names, streaks, and the name, type, and date of the last three training sessions.
        Measurements, results, duration, notes, contact details, and coach notes remain private.
      </div>

      <PeerSharingControl initialEnabled={viewer.sharing_enabled} />

      <section aria-labelledby="your-consistency-title">
        <h2 id="your-consistency-title" className="sr-only">Your consistency</h2>
        <ConsistencyCard entry={viewer} viewerSharingEnabled={viewer.sharing_enabled} />
      </section>

      {peers.length ? (
        <section className="mt-8" aria-labelledby="peer-list-title">
          <div className="mb-4 flex items-center justify-between gap-4">
            <h2 id="peer-list-title" className="flex items-center gap-2 text-lg font-semibold">
              <Users className="h-5 w-5 text-info" aria-hidden="true" />
              Your training community
            </h2>
            <span className="rounded-full bg-muted px-3 py-1 text-sm text-muted-foreground">
              {peers.length} {peers.length === 1 ? "peer" : "peers"}
            </span>
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            {peers.map((peer) => (
              <ConsistencyCard
                key={peer.client_id}
                entry={peer}
                viewerSharingEnabled={viewer.sharing_enabled}
              />
            ))}
          </div>
        </section>
      ) : (
        <div className="mt-8 rounded-xl border border-dashed bg-card p-10 text-center shadow-soft">
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
