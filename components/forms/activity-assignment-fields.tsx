"use client";

import { useState } from "react";
import {
  ACTIVITY_METRICS,
  type ActivityAssignmentMode,
  type ActivityMetricKey,
  type ActivityTargets
} from "@/lib/activities";
import { Field, Input, Select, Textarea } from "@/components/ui/field";

type ActivityAssignmentFieldsProps = {
  trackedMetrics: ActivityMetricKey[];
  requiredMetrics: ActivityMetricKey[];
  defaultTargets: ActivityTargets;
  notesLabel?: string;
};

export function ActivityAssignmentFields({
  trackedMetrics,
  requiredMetrics,
  defaultTargets,
  notesLabel = "Assignment notes"
}: ActivityAssignmentFieldsProps) {
  const [mode, setMode] = useState<ActivityAssignmentMode>("repeatable");

  return (
    <section className="grid gap-4 rounded-xl border bg-card p-4 shadow-soft">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Assignment type">
          <Select
            name="assignment_mode"
            value={mode}
            onChange={(event) =>
              setMode(event.target.value as ActivityAssignmentMode)
            }
          >
            <option value="repeatable">Repeatable</option>
            <option value="one_time">One-time</option>
          </Select>
        </Field>
        {mode === "one_time" ? (
          <Field label="Planned date" hint="Optional and informational.">
            <Input name="planned_for" type="date" />
          </Field>
        ) : (
          <div className="rounded-md border border-info/30 bg-info/5 p-3 text-sm text-muted-foreground">
            Repeatable Activities remain available after every completion.
          </div>
        )}
      </div>

      {trackedMetrics.length ? (
        <div>
          <h3 className="text-sm font-semibold">Targets for this assignment</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Defaults are prefilled. Clear a value to assign the metric without a target.
          </p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {ACTIVITY_METRICS.filter((metric) =>
              trackedMetrics.includes(metric.key)
            ).map((metric) => (
              <Field
                key={metric.key}
                label={`${metric.label} (${metric.unit})`}
                hint={requiredMetrics.includes(metric.key) ? "Required when logging" : "Optional when logging"}
              >
                <Input
                  name={`target_${metric.key}`}
                  type="number"
                  min={metric.min}
                  max={metric.max}
                  step={metric.step}
                  inputMode="decimal"
                  defaultValue={defaultTargets[metric.key]}
                />
              </Field>
            ))}
          </div>
        </div>
      ) : (
        <p className="rounded-md border border-info/30 bg-info/5 p-3 text-sm text-muted-foreground">
          This Activity only asks for a completion date and optional notes.
        </p>
      )}

      <Field label={notesLabel} hint="Optional guidance shown to the trainee.">
        <Textarea name="notes" />
      </Field>
    </section>
  );
}
