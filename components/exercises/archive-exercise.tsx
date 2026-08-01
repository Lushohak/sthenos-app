"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Archive, ExternalLink } from "lucide-react";
import { archiveExerciseAction } from "@/lib/actions/exercises";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Spinner } from "@/components/ui/spinner";

type AffectedRoutine = {
  id: string;
  name: string;
};

type ArchiveExerciseProps = {
  exerciseId: string;
  exerciseName: string;
  affectedRoutines: AffectedRoutine[];
};

export function ArchiveExercise({
  exerciseId,
  exerciseName,
  affectedRoutines
}: ArchiveExerciseProps) {
  const router = useRouter();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const routineCount = affectedRoutines.length;

  function handleOpenChange(open: boolean) {
    if (!open && isPending) return;
    setIsModalOpen(open);
    if (!open) setError(null);
  }

  function handleArchive() {
    setError(null);
    startTransition(async () => {
      const result = await archiveExerciseAction(exerciseId);

      if (!result.success) {
        setError(result.message);
        return;
      }

      router.push(
        `/dashboard/exercises?archived=${encodeURIComponent(exerciseName)}`
      );
      router.refresh();
    });
  }

  return (
    <section className="mt-10 max-w-3xl border-t pt-6">
      <div className="rounded-md border border-destructive/25 bg-card p-4 shadow-soft">
        <h2 className="font-semibold">Archive exercise</h2>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Hide this exercise from the library and prevent it from being added to
          new routines. Existing routines will not be changed.
        </p>
        <Button
          type="button"
          variant="danger"
          className="mt-4"
          onClick={() => setIsModalOpen(true)}
        >
          <Archive className="h-4 w-4" aria-hidden="true" />
          Archive exercise
        </Button>
      </div>

      <Modal
        open={isModalOpen}
        onOpenChange={handleOpenChange}
        title={`Archive ${exerciseName}?`}
        description={
          routineCount
            ? `This exercise is used in ${routineCount} ${
                routineCount === 1 ? "routine" : "routines"
              }.`
            : "This exercise is not currently used in any routines."
        }
      >
        <div className="grid gap-5 p-5">
          <p className="text-sm text-muted-foreground">
            Archiving will prevent this exercise from appearing in the exercise
            library or being added to new routines. Existing routine assignments
            will keep it until you remove or replace it.
          </p>

          {routineCount ? (
            <div>
              <h3 className="text-sm font-semibold">Affected routines</h3>
              <ul className="mt-2 divide-y rounded-md border">
                {affectedRoutines.map((routine) => (
                  <li key={routine.id}>
                    <Link
                      href={`/dashboard/routines/${routine.id}`}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center justify-between gap-3 px-3 py-2.5 text-sm font-medium transition hover:bg-muted"
                    >
                      <span className="min-w-0 truncate">{routine.name}</span>
                      <span className="inline-flex shrink-0 items-center gap-1 text-xs text-info">
                        Review
                        <ExternalLink
                          className="h-3.5 w-3.5"
                          aria-hidden="true"
                        />
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {error ? (
            <p
              className="rounded-md border border-destructive/25 bg-destructive/5 px-3 py-2 text-sm text-destructive"
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
              disabled={isPending}
              onClick={handleArchive}
            >
              {isPending ? (
                <Spinner className="h-4 w-4" />
              ) : (
                <Archive className="h-4 w-4" aria-hidden="true" />
              )}
              {isPending ? "Archiving..." : "Archive exercise"}
            </Button>
          </div>
        </div>
      </Modal>
    </section>
  );
}
