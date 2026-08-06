"use client";

import { Activity, CheckCircle2 } from "lucide-react";
import { useActionState, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { SubmitButton } from "@/components/ui/submit-button";
import { Toast } from "@/components/ui/toast";
import { RoutinePdfDownload } from "@/components/trainee/routine-pdf-download";
import {
  createTraineeWorkoutLogAction,
  type TraineeWorkoutLogState
} from "@/lib/actions/trainee";
import type { RoutinePdfData } from "@/types/routine-pdf";

type ActivityRoutineActionsProps = {
  assignmentId: string;
  routineName: string;
  today: string;
  pdfRoutine: RoutinePdfData;
};

const initialState: TraineeWorkoutLogState = {
  status: "idle",
  message: ""
};

export function ActivityRoutineActions({
  assignmentId,
  routineName,
  today,
  pdfRoutine
}: ActivityRoutineActionsProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isToastOpen, setIsToastOpen] = useState(false);
  const [state, formAction] = useActionState(
    createTraineeWorkoutLogAction.bind(null, assignmentId),
    initialState
  );

  useEffect(() => {
    if (state.status !== "success") return;

    formRef.current?.reset();
    setIsModalOpen(false);
    setIsToastOpen(true);
  }, [state]);

  return (
    <>
      <div className="flex flex-col gap-2 border-t bg-muted/20 p-4 sm:flex-row sm:justify-end sm:p-5">
        <RoutinePdfDownload routine={pdfRoutine} />
        <Button type="button" onClick={() => setIsModalOpen(true)}>
          <Activity className="h-4 w-4" aria-hidden="true" />
          Log activity
        </Button>
      </div>

      <Modal
        open={isModalOpen}
        onOpenChange={setIsModalOpen}
        title={`Log ${routineName}`}
        description="Record the completed activity for your workout history."
      >
        <form ref={formRef} action={formAction} className="grid gap-4 p-5">
          <Field label="Activity date">
            <Input
              name="trained_on"
              type="date"
              defaultValue={today}
              max={today}
              required
            />
          </Field>
          <Field
            label="Duration in minutes"
            hint="Optional — enter the approximate total activity time."
          >
            <Input
              name="duration_minutes"
              type="number"
              min={1}
              max={1440}
              inputMode="numeric"
              placeholder="e.g. 90"
            />
          </Field>
          <Field
            label="Activity notes"
            hint="Optional — share anything your coach should know."
          >
            <Textarea
              name="notes"
              placeholder="How it felt, intensity, result, or other details..."
            />
          </Field>
          {state.status === "error" ? (
            <p
              className="rounded-md border border-destructive/25 bg-destructive/5 px-3 py-2 text-sm text-destructive"
              role="alert"
            >
              {state.message}
            </p>
          ) : null}
          <div className="flex flex-col-reverse gap-2 border-t pt-4 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setIsModalOpen(false)}
            >
              Cancel
            </Button>
            <SubmitButton pendingLabel="Saving activity...">
              <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
              Complete activity
            </SubmitButton>
          </div>
        </form>
      </Modal>

      <Toast
        open={isToastOpen}
        onOpenChange={setIsToastOpen}
        title="Activity completed"
        description={`${routineName} was added to your workout history.`}
        variant="success"
      />
    </>
  );
}
