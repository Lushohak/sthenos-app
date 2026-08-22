"use client";

import { Plus } from "lucide-react";
import { useActionState, useEffect } from "react";
import {
  quickCreateAndAssignActivityAction,
  type QuickCreateActivityState
} from "@/lib/actions/activities";
import { ACTIVITY_METRICS } from "@/lib/activities";
import type { LoggableActivityAssignment } from "@/lib/client-roster";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";

const initialState: QuickCreateActivityState = {
  status: "idle",
  message: "",
  assignment: null
};

export function QuickCreateActivityForm({
  clientId,
  onCancel,
  onCreated
}: {
  clientId: string;
  onCancel: () => void;
  onCreated: (assignment: LoggableActivityAssignment, message: string) => void;
}) {
  const [state, formAction] = useActionState(
    quickCreateAndAssignActivityAction.bind(null, clientId),
    initialState
  );

  useEffect(() => {
    if (state.status === "success" && state.assignment) {
      onCreated(state.assignment, state.message);
    }
  }, [onCreated, state]);

  return (
    <form action={formAction} className="grid gap-5 rounded-xl border bg-card p-4 shadow-soft sm:p-5">
      <div>
        <h3 className="font-semibold">Create and assign a new Activity</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Set up the essentials now, then record the result immediately. You can add a thumbnail and reusable guidance later from Activities.
        </p>
      </div>
      <Field label="Activity name">
        <Input name="name" maxLength={120} placeholder="e.g. Pick-up soccer match" autoFocus required />
      </Field>
      <fieldset className="grid gap-3">
        <legend className="text-sm font-semibold">Results to track</legend>
        <p className="text-xs text-muted-foreground">
          Optional. Leave everything unchecked for simple completion logging.
        </p>
        <div className="grid gap-2 sm:grid-cols-2">
          {ACTIVITY_METRICS.map((metric) => (
            <label key={metric.key} className="flex cursor-pointer items-center gap-3 rounded-lg border bg-background-secondary px-3 py-3 text-sm hover:border-secondary">
              <input name="tracked_metrics" type="checkbox" value={metric.key} className="h-4 w-4 shrink-0 accent-primary" />
              <span>
                <span className="block font-medium">{metric.label}</span>
                <span className="text-xs text-muted-foreground">{metric.unit}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>
      {state.status === "error" ? (
        <p className="rounded-md border border-destructive/25 bg-destructive/5 px-3 py-2 text-sm text-destructive" role="alert">
          {state.message}
        </p>
      ) : null}
      <div className="flex flex-col-reverse gap-2 border-t pt-4 sm:flex-row sm:justify-end">
        <Button type="button" variant="ghost" onClick={onCancel}>Back to Activities</Button>
        <SubmitButton pendingLabel="Creating Activity...">
          <Plus className="h-4 w-4" aria-hidden="true" /> Create and assign
        </SubmitButton>
      </div>
    </form>
  );
}
