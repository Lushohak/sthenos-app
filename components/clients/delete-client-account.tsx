"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ShieldAlert, Trash2 } from "lucide-react";
import { deleteClientAccountAction } from "@/lib/actions/clients";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { Spinner } from "@/components/ui/spinner";

type DeleteClientAccountProps = {
  clientId: string;
  clientName: string;
  hasLoginAccount: boolean;
};

export function DeleteClientAccount({
  clientId,
  clientName,
  hasLoginAccount
}: DeleteClientAccountProps) {
  const router = useRouter();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [confirmationName, setConfirmationName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const actionLabel = hasLoginAccount ? "Delete trainee account" : "Delete client";
  const isConfirmed = confirmationName.trim() === clientName;

  function handleOpenChange(open: boolean) {
    if (!open && isPending) return;
    setIsModalOpen(open);

    if (!open) {
      setConfirmationName("");
      setError(null);
    }
  }

  function handleDelete() {
    if (!isConfirmed || isPending) return;

    setError(null);
    startTransition(async () => {
      const result = await deleteClientAccountAction(
        clientId,
        confirmationName
      );

      if (!result.success) {
        setError(result.message);
        return;
      }

      router.push(
        `/dashboard/clients?deleted=${encodeURIComponent(result.clientName)}`
      );
      router.refresh();
    });
  }

  return (
    <section className="mt-10 border-t pt-6">
      <div className="rounded-lg border border-destructive/35 bg-destructive/5 p-4 shadow-soft">
        <div className="flex items-start gap-3">
          <ShieldAlert
            className="mt-0.5 h-5 w-5 shrink-0 text-destructive"
            aria-hidden="true"
          />
          <div>
            <h2 className="font-semibold">Danger zone</h2>
            <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
              Permanently remove this client, their training history, progress
              records, routine assignments, and
              {hasLoginAccount ? " linked login account" : " profile"}.
            </p>
          </div>
        </div>
        <Button
          type="button"
          variant="danger"
          className="mt-4"
          onClick={() => setIsModalOpen(true)}
        >
          <Trash2 className="h-4 w-4" aria-hidden="true" />
          {actionLabel}
        </Button>
      </div>

      <Modal
        open={isModalOpen}
        onOpenChange={handleOpenChange}
        title={`Delete ${clientName}?`}
        description="This action is permanent and cannot be undone."
      >
        <div className="grid gap-5 p-5">
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm">
            <p className="font-semibold text-destructive">
              The following information will be permanently deleted:
            </p>
            <ul className="mt-3 list-disc space-y-1 pl-5 text-muted-foreground">
              <li>Client profile and coach notes</li>
              <li>Routine assignments and workout history</li>
              <li>Body measurements and progress entries</li>
              {hasLoginAccount ? <li>Trainee login and account access</li> : null}
            </ul>
            <p className="mt-3 text-muted-foreground">
              Your routine templates and exercise library will not be affected.
            </p>
          </div>

          <Field
            label={`Type ${clientName} to confirm`}
            hint="The name must match exactly."
          >
            <Input
              value={confirmationName}
              autoComplete="off"
              disabled={isPending}
              onChange={(event) => setConfirmationName(event.target.value)}
            />
          </Field>

          {error ? (
            <p
              className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive"
              role="alert"
            >
              {error}
            </p>
          ) : null}

          <div className="flex flex-col-reverse gap-2 border-t pt-4 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="ghost"
              disabled={isPending}
              onClick={() => handleOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="danger"
              disabled={!isConfirmed || isPending}
              onClick={handleDelete}
            >
              {isPending ? (
                <Spinner className="h-4 w-4" />
              ) : (
                <Trash2 className="h-4 w-4" aria-hidden="true" />
              )}
              {isPending ? "Deleting account..." : "Permanently delete account"}
            </Button>
          </div>
        </div>
      </Modal>
    </section>
  );
}
