import type { Json, Database } from "@/types/database";

export type ActivityMetricKey =
  Database["public"]["Enums"]["activity_metric"];
export type ActivityAssignmentMode =
  Database["public"]["Enums"]["activity_assignment_mode"];
export type ActivityTargets = Partial<Record<ActivityMetricKey, number>>;
export type ActivityMetricValues = ActivityTargets;

export const ACTIVITY_METRICS: ReadonlyArray<{
  key: ActivityMetricKey;
  label: string;
  shortLabel: string;
  unit: string;
  description: string;
  step: string;
  min: number;
  max?: number;
  integer: boolean;
}> = [
  {
    key: "duration_minutes",
    label: "Duration",
    shortLabel: "Duration",
    unit: "min",
    description: "Total time spent completing the activity.",
    step: "1",
    min: 1,
    max: 1440,
    integer: true
  },
  {
    key: "distance_km",
    label: "Distance",
    shortLabel: "Distance",
    unit: "km",
    description: "Total distance covered in kilometers.",
    step: "0.01",
    min: 0.01,
    integer: false
  },
  {
    key: "elevation_gain_m",
    label: "Elevation gain",
    shortLabel: "Elevation",
    unit: "m",
    description: "Total vertical elevation gained in meters.",
    step: "1",
    min: 1,
    integer: false
  },
  {
    key: "calories_burned",
    label: "Estimated calories",
    shortLabel: "Calories",
    unit: "kcal",
    description: "An approximate calorie total entered by the trainee.",
    step: "1",
    min: 1,
    integer: true
  },
  {
    key: "perceived_intensity",
    label: "Perceived intensity",
    shortLabel: "Intensity",
    unit: "RPE",
    description: "Rate the effort from 1 (very light) to 10 (maximum).",
    step: "1",
    min: 1,
    max: 10,
    integer: true
  }
];

export const ACTIVITY_METRIC_KEYS = ACTIVITY_METRICS.map(
  (metric) => metric.key
);

export function isActivityMetricKey(value: string): value is ActivityMetricKey {
  return ACTIVITY_METRIC_KEYS.includes(value as ActivityMetricKey);
}

export function activityMetricDefinition(key: ActivityMetricKey) {
  return ACTIVITY_METRICS.find((metric) => metric.key === key)!;
}

export function parseActivityTargets(value: Json | null): ActivityTargets {
  if (!value || Array.isArray(value) || typeof value !== "object") return {};

  return Object.entries(value).reduce<ActivityTargets>((targets, [key, raw]) => {
    if (!isActivityMetricKey(key) || typeof raw !== "number") return targets;
    targets[key] = raw;
    return targets;
  }, {});
}

export function validateActivityMetricValue(
  key: ActivityMetricKey,
  value: number
) {
  const metric = activityMetricDefinition(key);
  if (!Number.isFinite(value) || value < metric.min) {
    return `${metric.label} must be at least ${metric.min} ${metric.unit}.`;
  }
  if (metric.max !== undefined && value > metric.max) {
    return `${metric.label} must be no more than ${metric.max} ${metric.unit}.`;
  }
  if (metric.integer && !Number.isInteger(value)) {
    return `${metric.label} must be a whole number.`;
  }
  return null;
}

export function readActivityMetricValue(
  formData: FormData,
  name: string,
  key: ActivityMetricKey
) {
  const raw = String(formData.get(name) ?? "").trim();
  if (!raw) return null;

  const value = Number(raw);
  const error = validateActivityMetricValue(key, value);
  if (error) throw new Error(error);
  return value;
}

export function readActivityConfiguration(formData: FormData) {
  const trackedMetrics = Array.from(
    new Set(
      formData
        .getAll("tracked_metrics")
        .map(String)
        .filter(isActivityMetricKey)
    )
  );
  const requiredMetrics = trackedMetrics.filter(
    (key) => formData.get(`required_${key}`) === "on"
  );
  const defaultTargets = trackedMetrics.reduce<ActivityTargets>((targets, key) => {
    const value = readActivityMetricValue(formData, `target_${key}`, key);
    if (value !== null) targets[key] = value;
    return targets;
  }, {});

  return { trackedMetrics, requiredMetrics, defaultTargets };
}

export function readAssignmentTargets(
  formData: FormData,
  trackedMetrics: ActivityMetricKey[]
) {
  return trackedMetrics.reduce<ActivityTargets>((targets, key) => {
    const value = readActivityMetricValue(formData, `target_${key}`, key);
    if (value !== null) targets[key] = value;
    return targets;
  }, {});
}

export function formatActivityMetricValue(
  key: ActivityMetricKey,
  value: number
) {
  const metric = activityMetricDefinition(key);
  const formatted = new Intl.NumberFormat("en", {
    maximumFractionDigits: metric.integer ? 0 : 2
  }).format(value);
  return key === "perceived_intensity"
    ? `${formatted}/10 RPE`
    : `${formatted} ${metric.unit}`;
}

export function formatActivityMetricResult(
  key: ActivityMetricKey,
  actual: number,
  targets: ActivityTargets
) {
  const actualLabel = formatActivityMetricValue(key, actual);
  const target = targets[key];
  return target === undefined
    ? actualLabel
    : `${actualLabel} / ${formatActivityMetricValue(key, target)} target`;
}

export function activityMetricValuesFromLog(log: {
  duration_minutes: number | null;
  distance_km: number | null;
  elevation_gain_m: number | null;
  calories_burned: number | null;
  perceived_intensity: number | null;
}) {
  return ACTIVITY_METRIC_KEYS.reduce<ActivityMetricValues>((values, key) => {
    const value = log[key];
    if (value !== null) values[key] = Number(value);
    return values;
  }, {});
}

export function summarizeActivityLogs(
  logs: Array<{
    duration_minutes: number | null;
    distance_km: number | null;
    elevation_gain_m: number | null;
    calories_burned: number | null;
    perceived_intensity: number | null;
  }>
) {
  const intensities = logs.flatMap((log) =>
    log.perceived_intensity === null ? [] : [Number(log.perceived_intensity)]
  );

  return {
    completions: logs.length,
    durationMinutes: logs.reduce(
      (total, log) => total + Number(log.duration_minutes ?? 0),
      0
    ),
    distanceKm: logs.reduce(
      (total, log) => total + Number(log.distance_km ?? 0),
      0
    ),
    elevationGainM: logs.reduce(
      (total, log) => total + Number(log.elevation_gain_m ?? 0),
      0
    ),
    caloriesBurned: logs.reduce(
      (total, log) => total + Number(log.calories_burned ?? 0),
      0
    ),
    averageIntensity: intensities.length
      ? intensities.reduce((total, value) => total + value, 0) /
        intensities.length
      : null
  };
}
