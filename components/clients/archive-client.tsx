"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Archive, ArchiveRestore } from "lucide-react";
import {
  archiveClientAction,
  restoreClientAction
} from "@/lib/actions/clients";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Spinner } from "@/components/ui/spinner";

type ArchiveClientProps = {
  clientId: string;
  clientName: string;
  isArchived: boolean;
  assignmentCount: number;
};

export function ArchiveClient({
  clientId,
  clientName,
  isArchived,
  assignmentCount
}: ArchiveClientProps) {
  const router = useRouter();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleOpenChange(open: boolean) {
    if (!open && isPending) return;
    setIsModalOpen(open);
    if (!open) setError(null);
  }

  function handleArchive() {
    setError(null);
    startTransition(async () => {
      const result = await archiveClientAction(clientId);

      if (!result.success) {
        setError(result.message);
        return;
      }

      router.push(
        `/dashboard/clients?archived=${encodeURIComponent(clientName)}`
      );
      router.refresh();
    });
  }

  function handleRestore() {
    setError(null);
    startTransition(async () => {
      const result = await restoreClientAction(clientId);

      if (!result.success) {
        setError(result.message);
        return;
      }

      router.push(
        `/dashboard/clients?restored=${encodeURIComponent(clientName)}`
      );
      router.refresh();
    });
  }

  if (isArchived) {
    return (
      <section className="mt-8 rounded-lg border border-info/30 bg-info/5 p-4 shadow-soft">
        <h2 className="font-semibold">Archived client</h2>
        <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
          Restore this client to the active list so they can receive new routine
          assignments again.
        </p>
        {error ? (
          <p className="mt-3 text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : null}
        <Button
          type="button"
          variant="secondary"
          className="mt-4"
          disabled={isPending}
          onClick={handleRestore}
        >
          {isPending ? (
            <Spinner className="h-4 w-4" />
          ) : (
            <ArchiveRestore className="h-4 w-4" aria-hidden="true" />
          )}
          {isPending ? "Restoring client..." : "Restore client"}
        </Button>
      </section>
    );
  }

  return (
    <section className="mt-8 border-t pt-6">
      <div className="rounded-lg border bg-card p-4 shadow-soft">
        <h2 className="font-semibold">Archive client</h2>
        <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
          Remove this client from active coaching workflows without deleting
          their login, assignments, history, or progress data.
        </p>
        <Button
          type="button"
          variant="secondary"
          className="mt-4"
          onClick={() => setIsModalOpen(true)}
        >
          <Archive className="h-4 w-4" aria-hidden="true" />
          Archive client
        </Button>
      </div>

      <Modal
        open={isModalOpen}
        onOpenChange={handleOpenChange}
        title={`Archive ${clientName}?`}
        description="This preserves the trainee's account and historical data."
      >
        <div className="grid gap-5 p-5">
          <div className="space-y-3 text-sm text-muted-foreground">
            <p>
              The client will be hidden from the active client list and cannot
              receive new routine assignments until restored.
            </p>
            <p>
              Their login and {assignmentCount}{" "}
              {assignmentCount === 1 ? "existing assignment" : "existing assignments"}
              {" "}will remain available. No history or progress data will be deleted.
            </p>
          </div>

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
              variant="secondary"
              disabled={isPending}
              onClick={handleArchive}
            >
              {isPending ? (
                <Spinner className="h-4 w-4" />
              ) : (
                <Archive className="h-4 w-4" aria-hidden="true" />
              )}
              {isPending ? "Archiving client..." : "Archive client"}
            </Button>
          </div>
        </div>
      </Modal>
    </section>
  );
}
