import type { ActivityMetricKey } from "@/lib/activities";
import type { Database, Json } from "@/types/database";

type Client = Database["public"]["Tables"]["clients"]["Row"];

export type ClientRosterSort = "name" | "recent" | "inactive";
export type ClientRosterStatus = "active" | "paused";

export type ClientRosterItem = Client & {
  lastTrainedOn: string | null;
};

export type RoutineLogAssignment = {
  id: string;
  routineId: string;
  routineName: string;
};

export type LoggableActivityAssignment = {
  id: string;
  activityName: string;
  trackedMetrics: ActivityMetricKey[];
  requiredMetrics: ActivityMetricKey[];
  targets: Json | null;
};

export type ScheduledLogOption = {
  id: string;
  kind: "routine" | "activity" | "open";
  scheduledOn: string;
  title: string;
  routineAssignmentId: string | null;
  activityAssignmentId: string | null;
};

export type ClientLoggingOptions = {
  client: Pick<Client, "id" | "name">;
  routineAssignments: RoutineLogAssignment[];
  activityAssignments: LoggableActivityAssignment[];
  scheduledSessions: ScheduledLogOption[];
};

export type ClientLoggingOptionsResult =
  | { success: true; options: ClientLoggingOptions }
  | { success: false; message: string };
