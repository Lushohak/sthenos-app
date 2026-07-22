"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Check, CheckCircle2 } from "lucide-react";
import {
  createTraineeWorkoutLogAction,
  type TraineeWorkoutLogState
} from "@/lib/actions/trainee";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { Spinner } from "@/components/ui/spinner";
import { Toast } from "@/components/ui/toast";

type CompleteWorkoutFormProps = {
  routineId: string;
  routineName: string;
  today: string;
};

const initialState: TraineeWorkoutLogState = {
  status: "idle",
  message: ""
};

function getLocalDateValue() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function CompleteWorkoutForm({
  routineId,
  routineName,
  today
}: CompleteWorkoutFormProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isToastOpen, setIsToastOpen] = useState(false);
  const [isErrorVisible, setIsErrorVisible] = useState(false);
  const [localToday, setLocalToday] = useState(today);
  const [trainingDate, setTrainingDate] = useState(today);
  const [state, formAction, isPending] = useActionState(
    createTraineeWorkoutLogAction.bind(null, routineId),
    initialState
  );

  useEffect(() => {
    const currentLocalDate = getLocalDateValue();
    setLocalToday(currentLocalDate);
    setTrainingDate(currentLocalDate);
  }, []);

  useEffect(() => {
    if (state.status === "error") {
      setIsErrorVisible(true);
      return;
    }

    if (state.status !== "success") return;

    formRef.current?.reset();
    setTrainingDate(getLocalDateValue());
    setIsErrorVisible(false);
    setIsModalOpen(false);
    setIsToastOpen(true);
  }, [state]);

  function handleModalOpenChange(open: boolean) {
    if (!open && isPending) return;
    setIsModalOpen(open);
  }

  return (
    <>
      <Button
        type="button"
        className="w-full sm:w-auto"
        onClick={() => {
          setIsErrorVisible(false);
          setIsToastOpen(false);
          setIsModalOpen(true);
        }}
      >
        <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
        Complete workout
      </Button>

      <Modal
        open={isModalOpen}
        onOpenChange={handleModalOpenChange}
        title={`Complete ${routineName}`}
        description="Record this session while keeping the routine active for your next training day."
      >
        <form
          ref={formRef}
          action={formAction}
          className="grid gap-5 p-5"
          onSubmit={() => setIsErrorVisible(false)}
        >
          <Field label="Training date">
            <Input
              name="trained_on"
              type="date"
              value={trainingDate}
              max={localToday}
              onChange={(event) => setTrainingDate(event.target.value)}
              required
            />
          </Field>
          <Field label="Notes" hint="Optional — add anything your coach should know.">
            <Textarea
              name="notes"
              className="min-h-24"
              placeholder="How did the workout feel?"
            />
          </Field>
          {state.status === "error" && isErrorVisible ? (
            <p className="rounded-md border border-destructive/25 bg-destructive/5 px-3 py-2 text-sm text-destructive" role="alert">
              {state.message}
            </p>
          ) : null}
          <div className="flex flex-col-reverse gap-2 border-t pt-4 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="ghost"
              disabled={isPending}
              onClick={() => handleModalOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? (
                <Spinner className="h-4 w-4" />
              ) : (
                <Check className="h-4 w-4" aria-hidden="true" />
              )}
              {isPending ? "Registering..." : "Confirm workout"}
            </Button>
          </div>
        </form>
      </Modal>

      <Toast
        open={isToastOpen}
        onOpenChange={setIsToastOpen}
        title="Workout completed"
        description="Nice work! Your session was added to your workout history."
        variant="success"
      />
    </>
  );
}
