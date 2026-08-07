"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { assignActivityAction, type AssignActivityState } from "@/lib/actions/activities";
import { parseActivityTargets } from "@/lib/activities";
import { ActivityAssignmentFields } from "@/components/forms/activity-assignment-fields";
import { Field, Select } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { Toast } from "@/components/ui/toast";
import type { Database } from "@/types/database";

type Activity = Database["public"]["Tables"]["activities"]["Row"];

type AssignActivityFormProps = {
  clientId: string;
  clientName: string;
  activities: Activity[];
  assignedActivityIds: string[];
};

const initialState: AssignActivityState = {
  status: "idle",
  message: "",
  assignedCount: 0,
  skippedCount: 0
};

export function AssignActivityForm({
  clientId,
  clientName,
  activities,
  assignedActivityIds
}: AssignActivityFormProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const available = useMemo(
    () => activities.filter((activity) => !assignedActivityIds.includes(activity.id)),
    [activities, assignedActivityIds]
  );
  const [activityId, setActivityId] = useState(available[0]?.id ?? "");
  const [submittedActivityName, setSubmittedActivityName] = useState("Activity");
  const [isToastOpen, setIsToastOpen] = useState(false);
  const [state, formAction] = useActionState(
    assignActivityAction.bind(null, clientId),
    initialState
  );
  const activity = available.find((item) => item.id === activityId);

  useEffect(() => {
    if (state.status !== "success") return;
    formRef.current?.reset();
    setIsToastOpen(true);
  }, [state]);

  useEffect(() => {
    if (available.some((item) => item.id === activityId)) return;
    setActivityId(available[0]?.id ?? "");
  }, [activityId, available]);

  return (
    <>
      <form
        ref={formRef}
        action={formAction}
        className="grid gap-4"
        onSubmit={() => setSubmittedActivityName(activity?.name ?? "Activity")}
      >
        <section className="rounded-xl border bg-card p-4 shadow-soft">
          <Field label="Activity">
            <Select
              name="activity_id"
              value={activityId}
              disabled={!available.length}
              onChange={(event) => setActivityId(event.target.value)}
            >
              {!available.length ? <option value="">No Activities available</option> : null}
              {available.map((option) => (
                <option key={option.id} value={option.id}>{option.name}</option>
              ))}
            </Select>
          </Field>
        </section>
        {activity ? (
          <ActivityAssignmentFields
            key={activity.id}
            trackedMetrics={activity.tracked_metrics}
            requiredMetrics={activity.required_metrics}
            defaultTargets={parseActivityTargets(activity.default_targets)}
          />
        ) : null}
        {state.status === "error" ? (
          <p className="rounded-md border border-destructive/25 bg-destructive/5 px-3 py-2 text-sm text-destructive" role="alert">
            {state.message}
          </p>
        ) : null}
        <SubmitButton className="w-fit" disabled={!activity} pendingLabel="Assigning activity...">
          Assign activity
        </SubmitButton>
      </form>
      <Toast
        open={isToastOpen}
        onOpenChange={setIsToastOpen}
        title="Activity assigned"
        description={`${submittedActivityName} is now assigned to ${clientName}.`}
        variant="success"
      />
    </>
  );
}
