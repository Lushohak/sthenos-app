"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Archive, ArchiveRestore, ExternalLink } from "lucide-react";
import {
  archiveRoutineAction,
  restoreRoutineAction
} from "@/lib/actions/routines";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Spinner } from "@/components/ui/spinner";

type AffectedClient = {
  id: string;
  name: string;
};

type ArchiveRoutineProps = {
  routineId: string;
  routineName: string;
  isArchived: boolean;
  affectedClients: AffectedClient[];
};

export function ArchiveRoutine({
  routineId,
  routineName,
  isArchived,
  affectedClients
}: ArchiveRoutineProps) {
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
      const result = await archiveRoutineAction(routineId);

      if (!result.success) {
        setError(result.message);
        return;
      }

      router.push(
        `/dashboard/routines?archived=${encodeURIComponent(routineName)}`
      );
      router.refresh();
    });
  }

  function handleRestore() {
    setError(null);
    startTransition(async () => {
      const result = await restoreRoutineAction(routineId);

      if (!result.success) {
        setError(result.message);
        return;
      }

      router.push(
        `/dashboard/routines?restored=${encodeURIComponent(routineName)}`
      );
      router.refresh();
    });
  }

  if (isArchived) {
    return (
      <section className="mt-8 rounded-lg border border-info/30 bg-info/5 p-4 shadow-soft">
        <h2 className="font-semibold">Archived routine</h2>
        <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
          Restore this routine to edit it or assign it to additional trainees.
          Existing assignments have remained unchanged.
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
          {isPending ? "Restoring routine..." : "Restore routine"}
        </Button>
      </section>
    );
  }

  return (
    <section className="mt-10 border-t pt-6">
      <div className="rounded-lg border bg-card p-4 shadow-soft">
        <h2 className="font-semibold">Archive routine</h2>
        <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
          Hide this routine from the active library and prevent new assignments.
          Existing trainee assignments will not be changed.
        </p>
        <Button
          type="button"
          variant="secondary"
          className="mt-4"
          onClick={() => setIsModalOpen(true)}
        >
          <Archive className="h-4 w-4" aria-hidden="true" />
          Archive routine
        </Button>
      </div>

      <Modal
        open={isModalOpen}
        onOpenChange={handleOpenChange}
        title={`Archive ${routineName}?`}
        description={
          affectedClients.length
            ? `${affectedClients.length} ${
                affectedClients.length === 1 ? "trainee has" : "trainees have"
              } this routine assigned.`
            : "This routine is not currently assigned to any trainees."
        }
      >
        <div className="grid gap-5 p-5">
          <p className="text-sm text-muted-foreground">
            Archiving prevents new assignments and editing until the routine is
            restored. Existing assignments remain available to trainees.
          </p>

          {affectedClients.length ? (
            <div>
              <h3 className="text-sm font-semibold">Existing assignments</h3>
              <ul className="mt-2 divide-y rounded-md border">
                {affectedClients.map((client) => (
                  <li key={client.id}>
                    <Link
                      href={`/dashboard/clients/${client.id}`}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center justify-between gap-3 px-3 py-2.5 text-sm font-medium transition-colors hover:bg-elevated"
                    >
                      <span className="min-w-0 truncate">{client.name}</span>
                      <span className="inline-flex shrink-0 items-center gap-1 text-xs text-info">
                        Review
                        <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

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
              {isPending ? "Archiving routine..." : "Archive routine"}
            </Button>
          </div>
        </div>
      </Modal>
    </section>
  );
}
