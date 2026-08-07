"use client";

import { useState } from "react";
import {
  ACTIVITY_METRICS,
  type ActivityMetricKey,
  type ActivityTargets
} from "@/lib/activities";
import { createActivityAction } from "@/lib/actions/activities";
import { Field, Input, Textarea } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { ActivityThumbnail } from "@/components/activities/activity-thumbnail";

const MAX_THUMBNAIL_SIZE_BYTES = 1024 * 1024;

type ActivityFormProps = {
  action?: (formData: FormData) => void | Promise<void>;
  initialActivity?: {
    name: string;
    description: string | null;
    thumbnailUrl: string | null;
    trackedMetrics: ActivityMetricKey[];
    requiredMetrics: ActivityMetricKey[];
    defaultTargets: ActivityTargets;
  };
};

export function ActivityForm({
  action = createActivityAction,
  initialActivity
}: ActivityFormProps) {
  const [trackedMetrics, setTrackedMetrics] = useState<Set<ActivityMetricKey>>(
    new Set(initialActivity?.trackedMetrics ?? [])
  );
  const [thumbnailError, setThumbnailError] = useState<string | null>(null);

  function toggleMetric(key: ActivityMetricKey) {
    setTrackedMetrics((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function handleThumbnailChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (file && file.size > MAX_THUMBNAIL_SIZE_BYTES) {
      setThumbnailError("Thumbnail image must be 1 MB or smaller.");
      return;
    }
    setThumbnailError(null);
  }

  return (
    <form action={action} className="grid max-w-3xl gap-6">
      <section className="grid gap-4 rounded-xl border bg-card p-4 shadow-soft sm:p-5">
        <div>
          <h2 className="font-semibold">Activity details</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Create a reusable activity that can be prescribed to trainees.
          </p>
        </div>
        <Field label="Activity name">
          <Input
            name="name"
            defaultValue={initialActivity?.name}
            placeholder="e.g. Weekend hike"
            required
          />
        </Field>
        <Field label="Description" hint="Optional guidance shown to assigned trainees.">
          <Textarea
            name="description"
            defaultValue={initialActivity?.description ?? ""}
            placeholder="Describe the activity, preparation, or completion guidance."
          />
        </Field>
        {initialActivity?.thumbnailUrl ? (
          <ActivityThumbnail
            src={initialActivity.thumbnailUrl}
            alt="Current activity thumbnail"
            className="max-w-sm"
          />
        ) : null}
        <div className="grid gap-2 text-sm font-medium">
          <label htmlFor="activity-thumbnail">Activity thumbnail</label>
          <Input
            id="activity-thumbnail"
            name="thumbnail_file"
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            aria-invalid={Boolean(thumbnailError)}
            onChange={handleThumbnailChange}
          />
          <span className="text-xs font-normal text-muted-foreground">
            Optional PNG, JPEG, WebP, or GIF. Maximum size: 1 MB.
          </span>
          {thumbnailError ? (
            <span className="text-xs font-normal text-destructive">
              {thumbnailError}
            </span>
          ) : null}
          {initialActivity?.thumbnailUrl ? (
            <label className="mt-1 flex items-center gap-2 text-xs font-normal text-muted-foreground">
              <input name="remove_thumbnail" type="checkbox" className="h-4 w-4 accent-primary" />
              Remove the current thumbnail without replacing it
            </label>
          ) : null}
        </div>
      </section>

      <section className="grid gap-4 rounded-xl border bg-card p-4 shadow-soft sm:p-5">
        <div>
          <h2 className="font-semibold">Activity customizer</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Choose what trainees record. Date and notes are always available.
          </p>
        </div>
        <div className="grid gap-3">
          {ACTIVITY_METRICS.map((metric) => {
            const isTracked = trackedMetrics.has(metric.key);
            return (
              <article
                key={metric.key}
                className="grid gap-4 rounded-lg border p-4 sm:grid-cols-[minmax(0,1fr)_11rem]"
              >
                <div>
                  <label className="flex cursor-pointer items-start gap-3">
                    <input
                      name="tracked_metrics"
                      type="checkbox"
                      value={metric.key}
                      checked={isTracked}
                      className="mt-1 h-4 w-4 accent-primary"
                      onChange={() => toggleMetric(metric.key)}
                    />
                    <span>
                      <span className="block text-sm font-semibold">
                        {metric.label}
                      </span>
                      <span className="mt-1 block text-xs text-muted-foreground">
                        {metric.description}
                      </span>
                    </span>
                  </label>
                  {isTracked ? (
                    <label className="mt-3 flex items-center gap-2 pl-7 text-xs font-medium">
                      <input
                        name={`required_${metric.key}`}
                        type="checkbox"
                        defaultChecked={initialActivity?.requiredMetrics.includes(metric.key)}
                        className="h-4 w-4 accent-primary"
                      />
                      Require this value when logging completion
                    </label>
                  ) : null}
                </div>
                {isTracked ? (
                  <Field label={`Default target (${metric.unit})`} hint="Optional">
                    <Input
                      name={`target_${metric.key}`}
                      type="number"
                      min={metric.min}
                      max={metric.max}
                      step={metric.step}
                      inputMode="decimal"
                      defaultValue={initialActivity?.defaultTargets[metric.key]}
                    />
                  </Field>
                ) : null}
              </article>
            );
          })}
        </div>
        {!trackedMetrics.size ? (
          <p className="rounded-md border border-info/30 bg-info/5 p-3 text-sm text-muted-foreground">
            This Activity will use simple completion logging with a date and
            optional notes.
          </p>
        ) : null}
        {initialActivity ? (
          <p className="text-xs text-muted-foreground">
            These changes apply to future assignments. Existing trainee
            prescriptions keep their current metrics and targets.
          </p>
        ) : null}
      </section>

      <SubmitButton
        className="w-fit"
        disabled={Boolean(thumbnailError)}
        pendingLabel={initialActivity ? "Saving activity..." : "Creating activity..."}
      >
        {initialActivity ? "Save activity" : "Create activity"}
      </SubmitButton>
    </form>
  );
}
