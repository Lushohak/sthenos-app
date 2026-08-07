"use client";

import { PauseCircle, PlayCircle } from "lucide-react";
import { useActionState, useEffect, useState } from "react";
import {
  updateActivityAssignmentsStatusAction,
  type UpdateActivityAssignmentsState
} from "@/lib/actions/activities";
import { RoutineMultiSelect } from "@/components/forms/routine-multi-select";
import { SubmitButton } from "@/components/ui/submit-button";
import { Toast } from "@/components/ui/toast";

type ActivityAssignment = {
  id: string;
  activityName: string;
  status: "active" | "paused";
  activityArchived: boolean;
};

type ManageActivityAssignmentsProps = {
  clientId: string;
  clientName: string;
  assignments: ActivityAssignment[];
};

const initialState: UpdateActivityAssignmentsState = {
  status: "idle",
  message: "",
  updatedCount: 0
};

export function ManageActivityAssignments({
  clientId,
  clientName,
  assignments
}: ManageActivityAssignmentsProps) {
  const active = assignments.filter((item) => item.status === "active");
  const paused = assignments.filter((item) => item.status === "paused");
  const [pauseSelection, setPauseSelection] = useState<string[]>([]);
  const [resumeSelection, setResumeSelection] = useState<string[]>([]);
  const [pauseVersion, setPauseVersion] = useState(0);
  const [resumeVersion, setResumeVersion] = useState(0);
  const [pauseToast, setPauseToast] = useState(false);
  const [resumeToast, setResumeToast] = useState(false);
  const [pauseState, pauseAction] = useActionState(
    updateActivityAssignmentsStatusAction.bind(null, clientId, "paused"),
    initialState
  );
  const [resumeState, resumeAction] = useActionState(
    updateActivityAssignmentsStatusAction.bind(null, clientId, "active"),
    initialState
  );

  useEffect(() => {
    if (pauseState.status !== "success") return;
    setPauseSelection([]);
    setPauseVersion((value) => value + 1);
    setPauseToast(true);
  }, [pauseState]);
  useEffect(() => {
    if (resumeState.status !== "success") return;
    setResumeSelection([]);
    setResumeVersion((value) => value + 1);
    setResumeToast(true);
  }, [resumeState]);

  if (!assignments.length) return null;

  return (
    <>
      <section className="rounded-xl border bg-card p-4 shadow-soft">
        <h2 className="font-semibold">Manage assigned Activities</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Pausing removes an Activity from {clientName}&apos;s active list while preserving history.
        </p>
        <div className="mt-4 grid gap-4 xl:grid-cols-2">
          <form action={pauseAction} className="grid content-start gap-3 rounded-lg border p-3">
            <h3 className="flex items-center gap-2 text-sm font-semibold">
              <PauseCircle className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
              Pause active Activities
            </h3>
            <RoutineMultiSelect
              key={pauseVersion}
              name="assignment_ids"
              options={active.map((item) => ({ id: item.id, name: item.activityName }))}
              placeholder="Select active Activities"
              emptyMessage="There are no active Activities to pause."
              onSelectionChange={setPauseSelection}
            />
            {pauseState.status === "error" ? <p className="text-sm text-destructive" role="alert">{pauseState.message}</p> : null}
            <SubmitButton variant="secondary" className="w-fit" disabled={!pauseSelection.length} pendingLabel="Pausing Activities...">
              Pause {pauseSelection.length || "selected"} {pauseSelection.length === 1 ? "Activity" : "Activities"}
            </SubmitButton>
          </form>
          <form action={resumeAction} className="grid content-start gap-3 rounded-lg border p-3">
            <h3 className="flex items-center gap-2 text-sm font-semibold">
              <PlayCircle className="h-4 w-4 text-primary" aria-hidden="true" />
              Resume paused Activities
            </h3>
            <RoutineMultiSelect
              key={resumeVersion}
              name="assignment_ids"
              options={paused.map((item) => ({
                id: item.id,
                name: item.activityName,
                disabled: item.activityArchived,
                disabledLabel: item.activityArchived ? "Activity archived" : undefined
              }))}
              placeholder="Select paused Activities"
              emptyMessage="There are no paused Activities to resume."
              onSelectionChange={setResumeSelection}
            />
            {resumeState.status === "error" ? <p className="text-sm text-destructive" role="alert">{resumeState.message}</p> : null}
            <SubmitButton className="w-fit" disabled={!resumeSelection.length} pendingLabel="Resuming Activities...">
              Resume {resumeSelection.length || "selected"} {resumeSelection.length === 1 ? "Activity" : "Activities"}
            </SubmitButton>
          </form>
        </div>
      </section>
      <Toast
        open={pauseToast}
        onOpenChange={setPauseToast}
        title={pauseState.updatedCount === 1 ? "Activity paused" : "Activities paused"}
        description={`${pauseState.updatedCount} ${pauseState.updatedCount === 1 ? "Activity is" : "Activities are"} no longer active for ${clientName}.`}
        variant="success"
      />
      <Toast
        open={resumeToast}
        onOpenChange={setResumeToast}
        title={resumeState.updatedCount === 1 ? "Activity resumed" : "Activities resumed"}
        description={`${resumeState.updatedCount} ${resumeState.updatedCount === 1 ? "Activity is" : "Activities are"} active again for ${clientName}.`}
        variant="success"
      />
    </>
  );
}
