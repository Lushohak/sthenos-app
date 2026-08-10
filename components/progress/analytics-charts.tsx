"use client";

import { useMemo, useState, type ReactNode } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import {
  ACTIVITY_METRICS,
  formatActivityMetricValue,
  type ActivityMetricKey
} from "@/lib/activities";
import type {
  ActivityMetricPoint,
  BodyMetricKey,
  BodyProgressPoint,
  CoachClientActivitySummary,
  TrainingBucket
} from "@/lib/progress-analytics";
import { formatDate } from "@/lib/utils";
import { Select } from "@/components/ui/field";

const CHART_COLORS = {
  workout: "rgb(var(--chart-workout))",
  activity: "rgb(var(--chart-activity))",
  consistency: "rgb(var(--chart-consistency))",
  target: "rgb(var(--chart-target))",
  grid: "rgb(var(--chart-grid))",
  text: "rgb(var(--muted-foreground))",
  tooltip: "rgb(var(--elevated))",
  border: "rgb(var(--border-emphasis))"
};

const tooltipStyle = {
  backgroundColor: CHART_COLORS.tooltip,
  border: `1px solid ${CHART_COLORS.border}`,
  borderRadius: "0.5rem",
  color: "rgb(var(--foreground))"
};

function ChartCard({
  title,
  description,
  actions,
  children,
  summary
}: {
  title: string;
  description: string;
  actions?: ReactNode;
  children: ReactNode;
  summary: string;
}) {
  return (
    <section className="rounded-xl border bg-card p-4 shadow-soft sm:p-5">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="font-semibold">{title}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        </div>
        {actions}
      </div>
      <p className="sr-only">{summary}</p>
      {children}
    </section>
  );
}

function EmptyChart({ children }: { children: ReactNode }) {
  return (
    <div className="grid min-h-64 place-items-center rounded-lg border border-dashed bg-background-secondary p-6 text-center text-sm text-muted-foreground">
      {children}
    </div>
  );
}

export function TrainingTrendChart({
  buckets,
  variant = "sessions",
  title,
  description
}: {
  buckets: TrainingBucket[];
  variant?: "sessions" | "days";
  title: string;
  description: string;
}) {
  const totalWorkouts = buckets.reduce((total, bucket) => total + bucket.workoutSessions, 0);
  const totalActivities = buckets.reduce((total, bucket) => total + bucket.activitySessions, 0);
  const totalDays = buckets.reduce((total, bucket) => total + bucket.trainingDays, 0);
  const hasData = totalWorkouts + totalActivities > 0;
  const summary = variant === "days"
    ? `${totalDays} training days across the selected period, with ${totalWorkouts} workouts and ${totalActivities} activities.`
    : `${totalWorkouts} workouts and ${totalActivities} activities across the selected period.`;

  return (
    <ChartCard title={title} description={description} summary={summary}>
      {!hasData ? (
        <EmptyChart>No completed training is available in this date range.</EmptyChart>
      ) : (
        <div className="h-72 w-full" role="img" aria-label={summary}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={buckets} margin={{ top: 8, right: 8, left: -20, bottom: 4 }} accessibilityLayer>
              <CartesianGrid stroke={CHART_COLORS.grid} strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="label" stroke={CHART_COLORS.text} tickLine={false} axisLine={false} minTickGap={20} />
              <YAxis stroke={CHART_COLORS.text} tickLine={false} axisLine={false} allowDecimals={false} />
              <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "rgb(var(--secondary) / 0.1)" }} />
              {variant === "sessions" ? (
                <>
                  <Legend />
                  <Bar dataKey="workoutSessions" name="Workouts" stackId="training" fill={CHART_COLORS.workout} radius={[0, 0, 3, 3]} />
                  <Bar dataKey="activitySessions" name="Activities" stackId="training" fill={CHART_COLORS.activity} radius={[3, 3, 0, 0]} />
                </>
              ) : (
                <Bar dataKey="trainingDays" name="Training days" fill={CHART_COLORS.consistency} radius={[4, 4, 0, 0]} />
              )}
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </ChartCard>
  );
}

export function RosterActivityChart({
  clients,
  rangeLabel
}: {
  clients: CoachClientActivitySummary[];
  rangeLabel: string;
}) {
  const hasData = clients.some((client) => client.totalSessions > 0);
  const summary = `${clients.length} active clients are shown for ${rangeLabel}.`;

  return (
    <ChartCard
      title="Training days by client"
      description="Unique dates with at least one completed Workout or Activity."
      summary={summary}
    >
      {!hasData ? (
        <EmptyChart>No client training is available in this date range.</EmptyChart>
      ) : (
        <div
          className="w-full"
          style={{ height: Math.max(280, clients.length * 48) }}
          role="img"
          aria-label={summary}
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={clients} layout="vertical" margin={{ top: 4, right: 16, left: 16, bottom: 4 }} accessibilityLayer>
              <CartesianGrid stroke={CHART_COLORS.grid} strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" stroke={CHART_COLORS.text} tickLine={false} axisLine={false} allowDecimals={false} />
              <YAxis type="category" dataKey="name" width={105} stroke={CHART_COLORS.text} tickLine={false} axisLine={false} />
              <Tooltip
                contentStyle={tooltipStyle}
                cursor={{ fill: "rgb(var(--secondary) / 0.1)" }}
                formatter={(value, name, item) => {
                  if (name === "Training days") {
                    return [`${value} days · ${item.payload.totalSessions} sessions`, name];
                  }
                  return [value, name];
                }}
              />
              <Bar dataKey="trainingDays" name="Training days" fill={CHART_COLORS.consistency} radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </ChartCard>
  );
}

const BODY_METRICS: ReadonlyArray<{ key: BodyMetricKey; label: string; unit: string }> = [
  { key: "body_weight", label: "Weight", unit: "kg" },
  { key: "body_fat_percentage", label: "Body fat", unit: "%" },
  { key: "muscle_mass_percentage", label: "Muscle mass", unit: "%" },
  { key: "waist", label: "Waist", unit: "cm" },
  { key: "chest", label: "Chest", unit: "cm" },
  { key: "arms", label: "Arms", unit: "cm" },
  { key: "legs", label: "Legs", unit: "cm" }
];

export function BodyProgressChart({ points }: { points: BodyProgressPoint[] }) {
  const availableMetrics = BODY_METRICS.filter((metric) =>
    points.some((point) => point[metric.key] !== null)
  );
  const [selectedKey, setSelectedKey] = useState<BodyMetricKey>("body_weight");
  const metric = availableMetrics.find((item) => item.key === selectedKey) ?? availableMetrics[0];
  const chartData = metric
    ? points.flatMap((point) => {
        const value = point[metric.key];
        return value === null ? [] : [{ date: point.date, label: formatDate(point.date), value: Number(value) }];
      })
    : [];
  const first = chartData[0]?.value;
  const latest = chartData.at(-1)?.value;
  const delta = first !== undefined && latest !== undefined ? latest - first : null;
  const summary = metric && latest !== undefined
    ? `${metric.label} has ${chartData.length} entries. Latest value ${latest} ${metric.unit}${delta !== null ? `, a change of ${delta.toFixed(1)} ${metric.unit} in this range` : ""}.`
    : "No body measurements are available in this date range.";

  return (
    <ChartCard
      title="Body progress trend"
      description="Review one measurement at a time so each trend keeps a clear scale."
      summary={summary}
      actions={availableMetrics.length ? (
        <label className="grid min-w-44 gap-1 text-xs font-medium text-muted-foreground">
          Measurement
          <Select value={metric?.key} onChange={(event) => setSelectedKey(event.target.value as BodyMetricKey)} aria-label="Body measurement">
            {availableMetrics.map((item) => <option key={item.key} value={item.key}>{item.label}</option>)}
          </Select>
        </label>
      ) : null}
    >
      {!metric || !chartData.length ? (
        <EmptyChart>No body measurements are available in this date range.</EmptyChart>
      ) : (
        <>
          <div className="mb-3 flex flex-wrap gap-x-6 gap-y-1 text-sm">
            <span><span className="text-muted-foreground">Latest:</span> {latest} {metric.unit}</span>
            {delta !== null ? <span><span className="text-muted-foreground">Change:</span> {delta > 0 ? "+" : ""}{delta.toFixed(1)} {metric.unit}</span> : null}
          </div>
          <div className="h-72 w-full" role="img" aria-label={summary}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 8, right: 12, left: -12, bottom: 4 }} accessibilityLayer>
                <CartesianGrid stroke={CHART_COLORS.grid} strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="label" stroke={CHART_COLORS.text} tickLine={false} axisLine={false} minTickGap={24} />
                <YAxis stroke={CHART_COLORS.text} tickLine={false} axisLine={false} domain={["auto", "auto"]} unit={metric.unit} width={60} />
                <Tooltip contentStyle={tooltipStyle} formatter={(value) => [`${value} ${metric.unit}`, metric.label]} />
                <Line type="monotone" dataKey="value" name={metric.label} stroke={CHART_COLORS.workout} strokeWidth={3} dot={{ r: 4, fill: CHART_COLORS.workout }} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </>
      )}
    </ChartCard>
  );
}

export function ActivityResultsChart({ points }: { points: ActivityMetricPoint[] }) {
  const activities = useMemo(() => {
    const byId = new Map<string, string>();
    points.forEach((point) => byId.set(point.activityId, point.activityName));
    return [...byId.entries()].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [points]);
  const [selectedActivityId, setSelectedActivityId] = useState(activities[0]?.id ?? "");
  const selectedActivity = activities.some((activity) => activity.id === selectedActivityId)
    ? selectedActivityId
    : activities[0]?.id ?? "";
  const activityPoints = points.filter((point) => point.activityId === selectedActivity);
  const metricOptions = ACTIVITY_METRICS.filter((metric) =>
    activityPoints.some((point) => point.values[metric.key] !== undefined)
  );
  const [selectedMetricKey, setSelectedMetricKey] = useState<ActivityMetricKey>("duration_minutes");
  const metric = metricOptions.find((item) => item.key === selectedMetricKey) ?? metricOptions[0];
  const chartData = metric
    ? activityPoints.flatMap((point) => {
        const actual = point.values[metric.key];
        return actual === undefined ? [] : [{
          date: point.date,
          label: formatDate(point.date),
          actual,
          target: point.targets[metric.key]
        }];
      })
    : [];
  const hasTargets = chartData.some((point) => point.target !== undefined);
  const activityName = activities.find((activity) => activity.id === selectedActivity)?.name;
  const summary = metric && chartData.length
    ? `${activityName} has ${chartData.length} ${metric.label.toLowerCase()} results in this range.`
    : "No Activity metrics are available in this date range.";

  function selectActivity(activityId: string) {
    setSelectedActivityId(activityId);
    const nextPoints = points.filter((point) => point.activityId === activityId);
    const firstMetric = ACTIVITY_METRICS.find((item) =>
      nextPoints.some((point) => point.values[item.key] !== undefined)
    );
    if (firstMetric) setSelectedMetricKey(firstMetric.key);
  }

  return (
    <ChartCard
      title="Activity results"
      description="Compare recorded results with assignment targets when available."
      summary={summary}
      actions={activities.length ? (
        <div className="grid gap-2 sm:grid-cols-2">
          <label className="grid min-w-40 gap-1 text-xs font-medium text-muted-foreground">
            Activity
            <Select value={selectedActivity} onChange={(event) => selectActivity(event.target.value)} aria-label="Activity result">
              {activities.map((activity) => <option key={activity.id} value={activity.id}>{activity.name}</option>)}
            </Select>
          </label>
          <label className="grid min-w-40 gap-1 text-xs font-medium text-muted-foreground">
            Metric
            <Select value={metric?.key ?? ""} onChange={(event) => setSelectedMetricKey(event.target.value as ActivityMetricKey)} aria-label="Activity metric">
              {metricOptions.map((item) => <option key={item.key} value={item.key}>{item.label}</option>)}
            </Select>
          </label>
        </div>
      ) : null}
    >
      {!metric || !chartData.length ? (
        <EmptyChart>No Activity metrics are available in this date range.</EmptyChart>
      ) : (
        <div className="h-72 w-full" role="img" aria-label={summary}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 8, right: 12, left: -12, bottom: 4 }} accessibilityLayer>
              <CartesianGrid stroke={CHART_COLORS.grid} strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="label" stroke={CHART_COLORS.text} tickLine={false} axisLine={false} minTickGap={24} />
              <YAxis stroke={CHART_COLORS.text} tickLine={false} axisLine={false} domain={["auto", "auto"]} width={60} />
              <Tooltip
                contentStyle={tooltipStyle}
                formatter={(value, name) => [formatActivityMetricValue(metric.key, Number(value)), name]}
              />
              <Legend />
              <Line type="monotone" dataKey="actual" name="Actual" stroke={CHART_COLORS.activity} strokeWidth={3} dot={{ r: 4, fill: CHART_COLORS.activity }} activeDot={{ r: 6 }} />
              {hasTargets ? <Line type="monotone" dataKey="target" name="Target" stroke={CHART_COLORS.target} strokeWidth={2} strokeDasharray="6 4" connectNulls dot={false} /> : null}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </ChartCard>
  );
}
