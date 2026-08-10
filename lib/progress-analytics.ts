import type { ActivityMetricKey, ActivityTargets } from "@/lib/activities";

export const PROGRESS_RANGES = ["30d", "12w", "6m", "1y", "all"] as const;

export type ProgressRange = (typeof PROGRESS_RANGES)[number];
export type TrainingType = "workout" | "activity";
export type BodyMetricKey =
  | "body_weight"
  | "body_fat_percentage"
  | "muscle_mass_percentage"
  | "waist"
  | "chest"
  | "arms"
  | "legs";

export type TrainingLogPoint = {
  clientId: string;
  date: string;
  type: TrainingType;
};

export type TrainingBucket = {
  key: string;
  label: string;
  startDate: string;
  workoutSessions: number;
  activitySessions: number;
  trainingDays: number;
};

export type BodyProgressPoint = {
  date: string;
  body_weight: number;
  body_fat_percentage: number | null;
  muscle_mass_percentage: number | null;
  waist: number | null;
  chest: number | null;
  arms: number | null;
  legs: number | null;
};

export type ActivityMetricPoint = {
  id: string;
  activityId: string;
  activityName: string;
  date: string;
  values: Partial<Record<ActivityMetricKey, number>>;
  targets: ActivityTargets;
};

export type CoachClientActivitySummary = {
  id: string;
  name: string;
  trainingDays: number;
  totalSessions: number;
  lastTrainingDate: string | null;
  lastBodyProgressDate: string | null;
  trainingNeedsAttention: boolean;
  bodyNeedsAttention: boolean;
  inactivityDays: number;
};

type BucketKind = "day" | "week" | "month";

const DAY_MS = 86_400_000;

function parseDateOnly(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

function toDateOnly(date: Date) {
  return date.toISOString().slice(0, 10);
}

function addDays(date: Date, days: number) {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

function addMonths(date: Date, months: number) {
  const result = new Date(date);
  result.setUTCMonth(result.getUTCMonth() + months, 1);
  return result;
}

function startOfWeek(date: Date) {
  const day = date.getUTCDay();
  return addDays(date, -(day === 0 ? 6 : day - 1));
}

function startOfMonth(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

function differenceInDays(later: Date, earlier: Date) {
  return Math.max(0, Math.floor((later.getTime() - earlier.getTime()) / DAY_MS));
}

export function parseProgressRange(
  value: string | string[] | undefined,
  fallback: ProgressRange
): ProgressRange {
  const candidate = Array.isArray(value) ? value[0] : value;
  return PROGRESS_RANGES.includes(candidate as ProgressRange)
    ? (candidate as ProgressRange)
    : fallback;
}

export function progressRangeLabel(range: ProgressRange) {
  return {
    "30d": "30 days",
    "12w": "12 weeks",
    "6m": "6 months",
    "1y": "1 year",
    all: "All time"
  }[range];
}

export function getProgressRangeStart(range: ProgressRange, todayValue: string) {
  const today = parseDateOnly(todayValue);
  if (range === "30d") return toDateOnly(addDays(today, -29));
  if (range === "12w") return toDateOnly(addDays(startOfWeek(today), -11 * 7));
  if (range === "6m") return toDateOnly(addDays(startOfWeek(today), -25 * 7));
  if (range === "1y") return toDateOnly(addMonths(startOfMonth(today), -11));
  return null;
}

function bucketKindForRange(range: ProgressRange): BucketKind {
  if (range === "30d") return "day";
  if (range === "12w" || range === "6m") return "week";
  return "month";
}

function bucketStart(date: Date, kind: BucketKind) {
  if (kind === "week") return startOfWeek(date);
  if (kind === "month") return startOfMonth(date);
  return date;
}

function bucketLabel(date: Date, kind: BucketKind) {
  if (kind === "month") {
    return new Intl.DateTimeFormat("en", {
      month: "short",
      year: "2-digit",
      timeZone: "UTC"
    }).format(date);
  }
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    timeZone: "UTC"
  }).format(date);
}

export function createTrainingBuckets(
  logs: TrainingLogPoint[],
  range: ProgressRange,
  todayValue: string
) {
  const today = parseDateOnly(todayValue);
  const kind = bucketKindForRange(range);
  const validLogs = logs.filter((log) => log.date <= todayValue);
  const configuredStart = getProgressRangeStart(range, todayValue);
  const earliestLog = validLogs.reduce<string | null>(
    (earliest, log) => (!earliest || log.date < earliest ? log.date : earliest),
    null
  );
  const firstDate = configuredStart
    ? parseDateOnly(configuredStart)
    : earliestLog
      ? startOfMonth(parseDateOnly(earliestLog))
      : startOfMonth(today);
  const lastDate = bucketStart(today, kind);
  const buckets = new Map<string, TrainingBucket & { dates: Set<string> }>();

  for (let cursor = bucketStart(firstDate, kind); cursor <= lastDate; ) {
    const key = toDateOnly(cursor);
    buckets.set(key, {
      key,
      label: bucketLabel(cursor, kind),
      startDate: key,
      workoutSessions: 0,
      activitySessions: 0,
      trainingDays: 0,
      dates: new Set<string>()
    });
    cursor = kind === "day" ? addDays(cursor, 1) : kind === "week" ? addDays(cursor, 7) : addMonths(cursor, 1);
  }

  for (const log of validLogs) {
    if (configuredStart && log.date < configuredStart) continue;
    const key = toDateOnly(bucketStart(parseDateOnly(log.date), kind));
    const bucket = buckets.get(key);
    if (!bucket) continue;
    if (log.type === "workout") bucket.workoutSessions += 1;
    else bucket.activitySessions += 1;
    bucket.dates.add(log.date);
  }

  return [...buckets.values()].map(({ dates, ...bucket }) => ({
    ...bucket,
    trainingDays: dates.size
  }));
}

export function createCoachClientSummaries(
  clients: Array<{ id: string; name: string; status: string; created_at: string }>,
  logs: TrainingLogPoint[],
  bodyEntries: Array<{ clientId: string; date: string }>,
  range: ProgressRange,
  todayValue: string
) {
  const today = parseDateOnly(todayValue);
  const rangeStart = getProgressRangeStart(range, todayValue);
  const validLogs = logs.filter((log) => log.date <= todayValue);
  const validBodyEntries = bodyEntries.filter((entry) => entry.date <= todayValue);

  return clients
    .filter((client) => client.status === "active")
    .map<CoachClientActivitySummary>((client) => {
      const clientLogs = validLogs.filter((log) => log.clientId === client.id);
      const visibleLogs = clientLogs.filter((log) => !rangeStart || log.date >= rangeStart);
      const bodyDates = validBodyEntries
        .filter((entry) => entry.clientId === client.id)
        .map((entry) => entry.date)
        .sort();
      const trainingDates = clientLogs.map((log) => log.date).sort();
      const lastTrainingDate = trainingDates.at(-1) ?? null;
      const lastBodyProgressDate = bodyDates.at(-1) ?? null;
      const createdDate = client.created_at.slice(0, 10);
      const clientAgeDays = differenceInDays(today, parseDateOnly(createdDate));
      const inactivityDays = lastTrainingDate
        ? differenceInDays(today, parseDateOnly(lastTrainingDate))
        : clientAgeDays;
      const bodyInactivityDays = lastBodyProgressDate
        ? differenceInDays(today, parseDateOnly(lastBodyProgressDate))
        : clientAgeDays;

      return {
        id: client.id,
        name: client.name,
        trainingDays: new Set(visibleLogs.map((log) => log.date)).size,
        totalSessions: visibleLogs.length,
        lastTrainingDate,
        lastBodyProgressDate,
        trainingNeedsAttention: clientAgeDays >= 7 && inactivityDays > 7,
        bodyNeedsAttention: clientAgeDays >= 30 && bodyInactivityDays > 30,
        inactivityDays
      };
    })
    .sort((a, b) => b.inactivityDays - a.inactivityDays || a.name.localeCompare(b.name));
}

export function filterBodyProgressPoints(
  points: BodyProgressPoint[],
  range: ProgressRange,
  todayValue: string
) {
  const start = getProgressRangeStart(range, todayValue);
  return points
    .filter((point) => point.date <= todayValue && (!start || point.date >= start))
    .sort((a, b) => a.date.localeCompare(b.date));
}

export function filterActivityMetricPoints(
  points: ActivityMetricPoint[],
  range: ProgressRange,
  todayValue: string
) {
  const start = getProgressRangeStart(range, todayValue);
  return points
    .filter((point) => point.date <= todayValue && (!start || point.date >= start))
    .sort((a, b) => a.date.localeCompare(b.date));
}
