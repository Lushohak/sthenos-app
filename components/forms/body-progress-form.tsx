"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect, useRef, useState } from "react";
import {
  createBodyProgressAction,
  type BodyProgressState
} from "@/lib/actions/progress";
import { Field, Input, Textarea } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { Toast } from "@/components/ui/toast";

type BodyProgressFormProps = {
  clientId: string;
  today: string;
  submitter: "coach" | "trainee";
};

const initialState: BodyProgressState = {
  status: "idle",
  message: ""
};

export function BodyProgressForm({
  clientId,
  today,
  submitter
}: BodyProgressFormProps) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [toastOpen, setToastOpen] = useState(false);
  const [state, formAction] = useActionState(
    createBodyProgressAction.bind(null, clientId),
    initialState
  );

  useEffect(() => {
    if (state.status !== "success") return;
    formRef.current?.reset();
    setToastOpen(true);
    const timeout = window.setTimeout(() => router.refresh(), 1200);
    return () => window.clearTimeout(timeout);
  }, [router, state]);

  return (
    <>
      <form
        ref={formRef}
        action={formAction}
        className="grid gap-4 rounded-xl border bg-card p-4 shadow-soft sm:p-5"
      >
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Recorded on">
            <Input name="recorded_on" type="date" defaultValue={today} max={today} required />
          </Field>
          <Field label="Body weight (kg)">
            <Input name="body_weight" type="number" min="1" max="500" step="0.1" inputMode="decimal" required />
          </Field>
          <Field label="Body fat (%)" hint="Optional">
            <Input name="body_fat_percentage" type="number" min="0" max="100" step="0.1" inputMode="decimal" />
          </Field>
          <Field label="Muscle mass (%)" hint="Optional">
            <Input name="muscle_mass_percentage" type="number" min="0" max="100" step="0.1" inputMode="decimal" />
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Waist (cm)" hint="Optional">
            <Input name="waist" type="number" min="1" max="500" step="0.1" inputMode="decimal" />
          </Field>
          <Field label="Chest (cm)" hint="Optional">
            <Input name="chest" type="number" min="1" max="500" step="0.1" inputMode="decimal" />
          </Field>
          <Field label="Arms (cm)" hint="Optional">
            <Input name="arms" type="number" min="1" max="500" step="0.1" inputMode="decimal" />
          </Field>
          <Field label="Legs (cm)" hint="Optional">
            <Input name="legs" type="number" min="1" max="500" step="0.1" inputMode="decimal" />
          </Field>
        </div>
        <Field label="Notes" hint="Optional">
          <Textarea name="notes" placeholder="How you measured, how you feel, or anything useful for your coach..." />
        </Field>
        {state.status === "error" ? (
          <p className="rounded-md border border-destructive/25 bg-destructive/5 px-3 py-2 text-sm text-destructive" role="alert">
            {state.message}
          </p>
        ) : null}
        <SubmitButton className="w-fit" pendingLabel="Saving progress...">
          Add progress entry
        </SubmitButton>
      </form>
      <Toast
        open={toastOpen}
        onOpenChange={setToastOpen}
        title="Progress added"
        description={submitter === "trainee" ? "Your measurements are now visible to you and your coach." : "The measurements were added to the trainee's progress history."}
        variant="success"
      />
    </>
  );
}
