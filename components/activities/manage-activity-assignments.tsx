"use client";

import { PauseCircle, PlayCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { AssignmentSelectionList } from "@/components/clients/assignment-selection-list";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { SubmitButton } from "@/components/ui/submit-button";
import { Toast } from "@/components/ui/toast";
import {
  updateActivityAssignmentsStatusAction,
  type UpdateActivityAssignmentsState
} from "@/lib/actions/activities";

type ActivityAssignment = {
  id: string;
  activityName: string;
  status: "active" | "paused";
  activityArchived: boolean;
  notes?: string | null;
};

const initialState: UpdateActivityAssignmentsState = {
  status: "idle",
  message: "",
  updatedCount: 0
};

export function ManageActivityAssignments({
  clientId,
  clientName,
  assignments,
  action
}: {
  clientId: string;
  clientName: string;
  assignments: ActivityAssignment[];
  action?: ReactNode;
}) {
  const router = useRouter();
  const active = assignments.filter((assignment) => assignment.status === "active");
  const paused = assignments.filter((assignment) => assignment.status === "paused");
  const [pauseSelection, setPauseSelection] = useState<string[]>([]);
  const [resumeSelection, setResumeSelection] = useState<string[]>([]);
  const [pauseModalOpen, setPauseModalOpen] = useState(false);
  const [pauseToastOpen, setPauseToastOpen] = useState(false);
  const [resumeToastOpen, setResumeToastOpen] = useState(false);
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
    setPauseModalOpen(false);
    setPauseToastOpen(true);
    router.refresh();
  }, [pauseState, router]);

  useEffect(() => {
    if (resumeState.status !== "success") return;
    setResumeSelection([]);
    setResumeToastOpen(true);
    router.refresh();
  }, [resumeState, router]);

  const activeItems = active.map((assignment) => ({
    id: assignment.id,
    name: assignment.activityName,
    archived: assignment.activityArchived,
    notes: assignment.notes
  }));
  const pausedItems = paused.map((assignment) => ({
    id: assignment.id,
    name: assignment.activityName,
    archived: assignment.activityArchived,
    notes: assignment.notes
  }));

  return (
    <section className="rounded-xl border bg-card p-4 shadow-soft sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold">Activities</h2>
          <p className="mt-1 text-sm text-muted-foreground">Pause or resume Activity assignments while preserving their results.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="rounded-full bg-success/10 px-2.5 py-1 text-success">{active.length} active</span>
          <span className="rounded-full bg-muted px-2.5 py-1 text-muted-foreground">{paused.length} paused</span>
          {action}
        </div>
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-2">
        <form action={pauseAction} className="grid content-start gap-3">
          <h3 className="flex items-center gap-2 text-sm font-semibold">
            <PauseCircle className="h-4 w-4 text-muted-foreground" aria-hidden="true" /> Active Activities
          </h3>
          <AssignmentSelectionList
            label="Select active Activities to pause"
            items={activeItems}
            selectedIds={pauseSelection}
            onSelectionChange={setPauseSelection}
            emptyMessage="No active Activities."
          />
          <Button type="button" variant="secondary" className="w-fit" disabled={!pauseSelection.length} onClick={() => setPauseModalOpen(true)}>
            Pause {pauseSelection.length || "selected"} {pauseSelection.length === 1 ? "Activity" : "Activities"}
          </Button>
          <Modal
            open={pauseModalOpen}
            onOpenChange={setPauseModalOpen}
            title={`Pause ${pauseSelection.length === 1 ? "this Activity" : "these Activities"}?`}
            description={`They will no longer appear in ${clientName}'s active list.`}
          >
            <div className="grid gap-4 p-5">
              <ul className="max-h-48 space-y-2 overflow-y-auto rounded-lg border bg-muted/30 p-3 text-sm">
                {active.filter((assignment) => pauseSelection.includes(assignment.id)).map((assignment) => (
                  <li key={assignment.id}>{assignment.activityName}</li>
                ))}
              </ul>
              <p className="text-sm text-muted-foreground">Activity history, targets, and assignment notes will be preserved.</p>
              {pauseState.status === "error" ? <p className="text-sm text-destructive" role="alert">{pauseState.message}</p> : null}
              <div className="flex flex-col-reverse gap-2 border-t pt-4 sm:flex-row sm:justify-end">
                <Button type="button" variant="ghost" onClick={() => setPauseModalOpen(false)}>Keep active</Button>
                <SubmitButton variant="secondary" pendingLabel="Pausing Activities...">Pause {pauseSelection.length} {pauseSelection.length === 1 ? "Activity" : "Activities"}</SubmitButton>
              </div>
            </div>
          </Modal>
        </form>

        <form action={resumeAction} className="grid content-start gap-3">
          <h3 className="flex items-center gap-2 text-sm font-semibold">
            <PlayCircle className="h-4 w-4 text-primary" aria-hidden="true" /> Paused Activities
          </h3>
          <AssignmentSelectionList
            label="Select paused Activities to resume"
            items={pausedItems}
            selectedIds={resumeSelection}
            onSelectionChange={setResumeSelection}
            disabledArchived
            emptyMessage="No paused Activities."
          />
          {resumeState.status === "error" ? <p className="text-sm text-destructive" role="alert">{resumeState.message}</p> : null}
          <SubmitButton className="w-fit" disabled={!resumeSelection.length} pendingLabel="Resuming Activities...">
            Resume {resumeSelection.length || "selected"} {resumeSelection.length === 1 ? "Activity" : "Activities"}
          </SubmitButton>
        </form>
      </div>

      <Toast open={pauseToastOpen} onOpenChange={setPauseToastOpen} title={pauseState.updatedCount === 1 ? "Activity paused" : "Activities paused"} description={`${pauseState.updatedCount ?? 0} ${pauseState.updatedCount === 1 ? "Activity is" : "Activities are"} no longer active for ${clientName}.`} />
      <Toast open={resumeToastOpen} onOpenChange={setResumeToastOpen} title={resumeState.updatedCount === 1 ? "Activity resumed" : "Activities resumed"} description={`${resumeState.updatedCount ?? 0} ${resumeState.updatedCount === 1 ? "Activity is" : "Activities are"} active again for ${clientName}.`} />
    </section>
  );
}
