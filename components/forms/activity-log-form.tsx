"use client";

import { CheckCircle2 } from "lucide-react";
import { useActionState, useEffect, useRef, useState } from "react";
import {
  createActivityLogAction,
  type ActivityLogState
} from "@/lib/actions/activities";
import {
  ACTIVITY_METRICS,
  formatActivityMetricValue,
  type ActivityMetricKey,
  type ActivityTargets
} from "@/lib/activities";
import { Field, Input, Textarea } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { Toast } from "@/components/ui/toast";

type ActivityLogFormProps = {
  assignmentId: string;
  activityName: string;
  trackedMetrics: ActivityMetricKey[];
  requiredMetrics: ActivityMetricKey[];
  targets: ActivityTargets;
  today: string;
  completionBehavior?: "redirect" | "return";
  onSuccess?: () => void;
};

const initialState: ActivityLogState = {
  status: "idle",
  message: "",
  completedOneTime: false
};

export function ActivityLogForm({
  assignmentId,
  activityName,
  trackedMetrics,
  requiredMetrics,
  targets,
  today,
  completionBehavior = "redirect",
  onSuccess
}: ActivityLogFormProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const [toastOpen, setToastOpen] = useState(false);
  const [state, formAction] = useActionState(
    createActivityLogAction.bind(null, assignmentId, completionBehavior),
    initialState
  );

  useEffect(() => {
    if (state.status !== "success") return;
    formRef.current?.reset();
    setToastOpen(true);
    onSuccess?.();
  }, [onSuccess, state]);

  return (
    <>
      <form ref={formRef} action={formAction} className="grid gap-4 rounded-xl border bg-card p-4 shadow-soft sm:p-5">
        <Field label="Activity date">
          <Input name="performed_on" type="date" defaultValue={today} max={today} required />
        </Field>
        {ACTIVITY_METRICS.filter((metric) => trackedMetrics.includes(metric.key)).map((metric) => {
          const target = targets[metric.key];
          const required = requiredMetrics.includes(metric.key);
          return (
            <Field
              key={metric.key}
              label={`${metric.label} (${metric.unit})`}
              hint={`${required ? "Required" : "Optional"}${target !== undefined ? ` · Target ${formatActivityMetricValue(metric.key, target)}` : ""}`}
            >
              <Input
                name={metric.key}
                type="number"
                min={metric.min}
                max={metric.max}
                step={metric.step}
                inputMode="decimal"
                required={required}
              />
            </Field>
          );
        })}
        <Field label="Activity notes" hint="Optional">
          <Textarea name="notes" placeholder="Conditions, result, intensity, or other useful details..." />
        </Field>
        {state.status === "error" ? (
          <p className="rounded-md border border-destructive/25 bg-destructive/5 px-3 py-2 text-sm text-destructive" role="alert">
            {state.message}
          </p>
        ) : null}
        <SubmitButton className="w-fit" pendingLabel="Saving Activity...">
          <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
          Complete Activity
        </SubmitButton>
      </form>
      <Toast
        open={toastOpen}
        onOpenChange={setToastOpen}
        title="Activity completed"
        description={state.completedOneTime
          ? `${activityName} was completed and moved to the trainee's history.`
          : `${activityName} was added to the trainee's training history.`}
        variant="success"
      />
    </>
  );
}
