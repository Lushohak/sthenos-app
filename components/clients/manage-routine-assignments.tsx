"use client";

import { PauseCircle, PlayCircle } from "lucide-react";
import { useActionState, useEffect, useState } from "react";
import { RoutineMultiSelect } from "@/components/forms/routine-multi-select";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { SubmitButton } from "@/components/ui/submit-button";
import { Toast } from "@/components/ui/toast";
import {
  updateRoutineAssignmentsStatusAction,
  type UpdateRoutineAssignmentsState
} from "@/lib/actions/clients";

type RoutineAssignment = {
  id: string;
  routineName: string;
  status: "active" | "paused";
  routineArchived: boolean;
};

type ManageRoutineAssignmentsProps = {
  clientId: string;
  clientName: string;
  assignments: RoutineAssignment[];
};

const initialState: UpdateRoutineAssignmentsState = {
  status: "idle",
  message: "",
  updatedCount: 0
};

export function ManageRoutineAssignments({
  clientId,
  clientName,
  assignments
}: ManageRoutineAssignmentsProps) {
  const activeAssignments = assignments.filter(
    (assignment) => assignment.status === "active"
  );
  const pausedAssignments = assignments.filter(
    (assignment) => assignment.status === "paused"
  );
  const [pauseSelection, setPauseSelection] = useState<string[]>([]);
  const [resumeSelection, setResumeSelection] = useState<string[]>([]);
  const [pauseVersion, setPauseVersion] = useState(0);
  const [resumeVersion, setResumeVersion] = useState(0);
  const [isPauseModalOpen, setIsPauseModalOpen] = useState(false);
  const [isPauseToastOpen, setIsPauseToastOpen] = useState(false);
  const [isResumeToastOpen, setIsResumeToastOpen] = useState(false);
  const [pauseState, pauseAction] = useActionState(
    updateRoutineAssignmentsStatusAction.bind(null, clientId, "paused"),
    initialState
  );
  const [resumeState, resumeAction] = useActionState(
    updateRoutineAssignmentsStatusAction.bind(null, clientId, "active"),
    initialState
  );

  useEffect(() => {
    if (pauseState.status !== "success") return;

    setPauseSelection([]);
    setPauseVersion((current) => current + 1);
    setIsPauseModalOpen(false);
    setIsPauseToastOpen(true);
  }, [pauseState]);

  useEffect(() => {
    if (resumeState.status !== "success") return;

    setResumeSelection([]);
    setResumeVersion((current) => current + 1);
    setIsResumeToastOpen(true);
  }, [resumeState]);

  const selectedPauseNames = activeAssignments
    .filter((assignment) => pauseSelection.includes(assignment.id))
    .map((assignment) => assignment.routineName);

  if (!assignments.length) return null;

  return (
    <>
      <section className="rounded-md border bg-card p-4 shadow-soft">
        <div>
          <h2 className="font-semibold">Manage assigned routines</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Pausing removes a routine from {clientName}&apos;s active workout
            list without deleting workout history or assignment notes.
          </p>
        </div>

        <div className="mt-4 grid gap-4 xl:grid-cols-2">
          <form action={pauseAction} className="grid content-start gap-3 rounded-lg border p-3">
            <div className="flex items-center gap-2">
              <PauseCircle className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
              <h3 className="text-sm font-semibold">Pause active routines</h3>
            </div>
            <RoutineMultiSelect
              key={pauseVersion}
              name="assignment_ids"
              options={activeAssignments.map((assignment) => ({
                id: assignment.id,
                name: assignment.routineName
              }))}
              placeholder="Select active routines"
              emptyMessage="There are no active routines to pause."
              onSelectionChange={setPauseSelection}
            />
            <p className="text-xs text-muted-foreground">
              Paused routines can be resumed at any time.
            </p>
            <Button
              type="button"
              variant="secondary"
              className="w-fit"
              disabled={!pauseSelection.length}
              onClick={() => setIsPauseModalOpen(true)}
            >
              {pauseSelection.length === 1
                ? "Pause 1 routine"
                : `Pause ${pauseSelection.length} routines`}
            </Button>

            <Modal
              open={isPauseModalOpen}
              onOpenChange={setIsPauseModalOpen}
              title={`Pause ${pauseSelection.length === 1 ? "this routine" : "these routines"}?`}
              description={`They will no longer appear in ${clientName}'s active workout list.`}
            >
              <div className="grid gap-4 p-5">
                <ul className="max-h-48 space-y-2 overflow-y-auto rounded-lg border bg-muted/30 p-3 text-sm">
                  {selectedPauseNames.map((name) => (
                    <li key={name}>{name}</li>
                  ))}
                </ul>
                <p className="text-sm text-muted-foreground">
                  Existing workout history and coach notes will be preserved.
                </p>
                {pauseState.status === "error" ? (
                  <p
                    className="rounded-md border border-destructive/25 bg-destructive/5 px-3 py-2 text-sm text-destructive"
                    role="alert"
                  >
                    {pauseState.message}
                  </p>
                ) : null}
                <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setIsPauseModalOpen(false)}
                  >
                    Keep active
                  </Button>
                  <SubmitButton
                    variant="secondary"
                    pendingLabel="Pausing routines..."
                  >
                    {pauseSelection.length === 1
                      ? "Pause routine"
                      : `Pause ${pauseSelection.length} routines`}
                  </SubmitButton>
                </div>
              </div>
            </Modal>
          </form>

          <form action={resumeAction} className="grid content-start gap-3 rounded-lg border p-3">
            <div className="flex items-center gap-2">
              <PlayCircle className="h-4 w-4 text-primary" aria-hidden="true" />
              <h3 className="text-sm font-semibold">Resume paused routines</h3>
            </div>
            <RoutineMultiSelect
              key={resumeVersion}
              name="assignment_ids"
              options={pausedAssignments.map((assignment) => ({
                id: assignment.id,
                name: assignment.routineName,
                disabled: assignment.routineArchived,
                disabledLabel: assignment.routineArchived
                  ? "Routine archived"
                  : undefined
              }))}
              placeholder="Select paused routines"
              emptyMessage="There are no paused routines to resume."
              onSelectionChange={setResumeSelection}
            />
            <p className="text-xs text-muted-foreground">
              Archived routine templates must be restored before they can be resumed.
            </p>
            {resumeState.status === "error" ? (
              <p
                className="rounded-md border border-destructive/25 bg-destructive/5 px-3 py-2 text-sm text-destructive"
                role="alert"
              >
                {resumeState.message}
              </p>
            ) : null}
            <SubmitButton
              className="w-fit"
              disabled={!resumeSelection.length}
              pendingLabel="Resuming routines..."
            >
              {resumeSelection.length === 1
                ? "Resume 1 routine"
                : `Resume ${resumeSelection.length} routines`}
            </SubmitButton>
          </form>
        </div>
      </section>

      <Toast
        open={isPauseToastOpen}
        onOpenChange={setIsPauseToastOpen}
        title={pauseState.updatedCount === 1 ? "Routine paused" : "Routines paused"}
        description={`${pauseState.updatedCount ?? 0} ${
          pauseState.updatedCount === 1 ? "routine is" : "routines are"
        } no longer shown in ${clientName}'s active workout list.`}
        variant="success"
      />
      <Toast
        open={isResumeToastOpen}
        onOpenChange={setIsResumeToastOpen}
        title={resumeState.updatedCount === 1 ? "Routine resumed" : "Routines resumed"}
        description={`${resumeState.updatedCount ?? 0} ${
          resumeState.updatedCount === 1 ? "routine is" : "routines are"
        } active again for ${clientName}.`}
        variant="success"
      />
    </>
  );
}
