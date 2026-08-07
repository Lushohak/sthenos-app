"use client";

import Link from "next/link";
import { Archive, ArchiveRestore, ExternalLink } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  archiveActivityAction,
  restoreActivityAction
} from "@/lib/actions/activities";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Spinner } from "@/components/ui/spinner";

type ArchiveActivityProps = {
  activityId: string;
  activityName: string;
  isArchived: boolean;
  affectedClients: Array<{ id: string; name: string }>;
};

export function ArchiveActivity({
  activityId,
  activityName,
  isArchived,
  affectedClients
}: ArchiveActivityProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit() {
    setError(null);
    startTransition(async () => {
      const result = isArchived
        ? await restoreActivityAction(activityId)
        : await archiveActivityAction(activityId);
      if (!result.success) {
        setError(result.message);
        return;
      }
      setOpen(false);
      router.push(
        `/dashboard/activities?${isArchived ? "restored" : "archived"}=${encodeURIComponent(activityName)}`
      );
    });
  }

  return (
    <section className="mt-8 border-t pt-6">
      <Button type="button" variant={isArchived ? "secondary" : "danger"} onClick={() => setOpen(true)}>
        {isArchived ? <ArchiveRestore className="h-4 w-4" aria-hidden="true" /> : <Archive className="h-4 w-4" aria-hidden="true" />}
        {isArchived ? "Restore activity" : "Archive activity"}
      </Button>
      <Modal
        open={open}
        onOpenChange={setOpen}
        title={isArchived ? `Restore ${activityName}?` : `Archive ${activityName}?`}
        description={isArchived ? "The Activity can be edited and assigned again." : "New assignments will be disabled until this Activity is restored."}
      >
        <div className="grid gap-4 p-5">
          {!isArchived && affectedClients.length ? (
            <div>
              <h3 className="text-sm font-semibold">Existing assignments</h3>
              <ul className="mt-2 max-h-48 divide-y overflow-y-auto rounded-md border">
                {affectedClients.map((client) => (
                  <li key={client.id}>
                    <Link href={`/dashboard/clients/${client.id}`} target="_blank" className="flex items-center justify-between px-3 py-2 text-sm hover:bg-elevated">
                      {client.name}
                      <ExternalLink className="h-3.5 w-3.5 text-info" aria-hidden="true" />
                    </Link>
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-xs text-muted-foreground">Active assignments remain available. Paused assignments cannot resume until restoration.</p>
            </div>
          ) : null}
          {error ? <p className="text-sm text-destructive" role="alert">{error}</p> : null}
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="ghost" disabled={pending} onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="button" variant={isArchived ? "primary" : "danger"} disabled={pending} onClick={submit}>
              {pending ? <Spinner className="h-4 w-4" label={isArchived ? "Restoring activity" : "Archiving activity"} /> : null}
              {isArchived ? "Restore activity" : "Archive activity"}
            </Button>
          </div>
        </div>
      </Modal>
    </section>
  );
}
