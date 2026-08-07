"use client";

import { CheckCircle2, Footprints } from "lucide-react";
import { useRouter } from "next/navigation";
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
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { SubmitButton } from "@/components/ui/submit-button";
import { Toast } from "@/components/ui/toast";

type ActivityActionsProps = {
  assignmentId: string;
  activityName: string;
  trackedMetrics: ActivityMetricKey[];
  requiredMetrics: ActivityMetricKey[];
  targets: ActivityTargets;
  today: string;
};

const initialState: ActivityLogState = {
  status: "idle",
  message: "",
  completedOneTime: false
};

export function ActivityActions({
  assignmentId,
  activityName,
  trackedMetrics,
  requiredMetrics,
  targets,
  today
}: ActivityActionsProps) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [open, setOpen] = useState(false);
  const [toastOpen, setToastOpen] = useState(false);
  const [state, formAction] = useActionState(
    createActivityLogAction.bind(null, assignmentId),
    initialState
  );

  useEffect(() => {
    if (state.status !== "success") return;
    formRef.current?.reset();
    setOpen(false);
    setToastOpen(true);
    const timeout = window.setTimeout(() => router.refresh(), 1200);
    return () => window.clearTimeout(timeout);
  }, [router, state]);

  return (
    <>
      <div className="flex justify-end border-t bg-muted/20 p-4 sm:p-5">
        <Button type="button" onClick={() => setOpen(true)}>
          <Footprints className="h-4 w-4" aria-hidden="true" />
          Log Activity
        </Button>
      </div>
      <Modal
        open={open}
        onOpenChange={setOpen}
        title={`Log ${activityName}`}
        description="Record what you completed and share the result with your coach."
      >
        <form ref={formRef} action={formAction} className="grid gap-4 p-5">
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
          <Field label="Activity notes" hint="Optional — share how it felt or anything your coach should know.">
            <Textarea name="notes" placeholder="Conditions, result, intensity, or other details..." />
          </Field>
          {state.status === "error" ? (
            <p className="rounded-md border border-destructive/25 bg-destructive/5 px-3 py-2 text-sm text-destructive" role="alert">{state.message}</p>
          ) : null}
          <div className="flex flex-col-reverse gap-2 border-t pt-4 sm:flex-row sm:justify-end">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <SubmitButton pendingLabel="Saving Activity...">
              <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
              Complete Activity
            </SubmitButton>
          </div>
        </form>
      </Modal>
      <Toast
        open={toastOpen}
        onOpenChange={setToastOpen}
        title="Activity completed"
        description={state.completedOneTime ? `${activityName} was completed and moved to your history.` : `${activityName} was added to your training history.`}
        variant="success"
      />
    </>
  );
}
