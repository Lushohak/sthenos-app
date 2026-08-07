import {
  ACTIVITY_METRICS,
  formatActivityMetricValue,
  type ActivityMetricKey,
  type ActivityTargets
} from "@/lib/activities";
import { cn } from "@/lib/utils";

type ActivityMetricsProps = {
  trackedMetrics: ActivityMetricKey[];
  requiredMetrics?: ActivityMetricKey[];
  targets?: ActivityTargets;
  className?: string;
};

export function ActivityMetrics({
  trackedMetrics,
  requiredMetrics = [],
  targets = {},
  className
}: ActivityMetricsProps) {
  if (!trackedMetrics.length) {
    return (
      <p className={cn("text-sm text-muted-foreground", className)}>
        Simple completion with date and optional notes.
      </p>
    );
  }

  return (
    <dl className={cn("grid gap-2 sm:grid-cols-2", className)}>
      {ACTIVITY_METRICS.filter((metric) =>
        trackedMetrics.includes(metric.key)
      ).map((metric) => (
        <div key={metric.key} className="rounded-md border bg-muted/30 p-3">
          <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {metric.label}
            {requiredMetrics.includes(metric.key) ? " · Required" : " · Optional"}
          </dt>
          <dd className="mt-1 text-sm font-semibold">
            {targets[metric.key] !== undefined
              ? `Target: ${formatActivityMetricValue(metric.key, targets[metric.key]!)}`
              : "No target"}
          </dd>
        </div>
      ))}
    </dl>
  );
}
