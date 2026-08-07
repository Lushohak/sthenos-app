"use client";

import { Eye, EyeOff, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { updatePeerActivitySharingAction } from "@/lib/actions/peers";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Spinner } from "@/components/ui/spinner";
import { Toast } from "@/components/ui/toast";

type PeerSharingControlProps = {
  initialEnabled: boolean;
};

export function PeerSharingControl({ initialEnabled }: PeerSharingControlProps) {
  const router = useRouter();
  const [enabled, setEnabled] = useState(initialEnabled);
  const [confirmationOpen, setConfirmationOpen] = useState(false);
  const [toastOpen, setToastOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);

  async function updateSharing(nextEnabled: boolean) {
    if (isPending) return;
    setError(null);
    setIsPending(true);
    try {
      const result = await updatePeerActivitySharingAction(nextEnabled);
      if (!result.success) {
        setError(result.message);
        return;
      }

      setEnabled(result.enabled);
      setConfirmationOpen(false);
      setToastOpen(true);
      router.refresh();
    } finally {
      setIsPending(false);
    }
  }

  function handleOpenChange(open: boolean) {
    if (!open && isPending) return;
    setConfirmationOpen(open);
    if (!open) setError(null);
  }

  return (
    <>
      <section className="mb-6 flex flex-col gap-4 rounded-xl border bg-card p-4 shadow-soft sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <div className="flex items-start gap-3 sm:flex-1">
          <span className="rounded-lg bg-primary/10 p-2 text-primary">
            <ShieldCheck className="h-5 w-5" aria-hidden="true" />
          </span>
          <div>
            <h2 className="font-semibold">Peer activity sharing</h2>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
              {enabled
                ? "Your streak and last three training names are visible to active peers."
                : "Your training is private, and peer training details are hidden from you."}
            </p>
          </div>
        </div>
        <Button
          type="button"
          variant="secondary"
          className="shrink-0"
          aria-pressed={enabled}
          disabled={isPending}
          onClick={() => enabled ? setConfirmationOpen(true) : updateSharing(true)}
        >
          {isPending ? (
            <Spinner className="h-4 w-4" />
          ) : enabled ? (
            <EyeOff className="h-4 w-4" aria-hidden="true" />
          ) : (
            <Eye className="h-4 w-4" aria-hidden="true" />
          )}
          {isPending
            ? "Updating sharing..."
            : enabled
              ? "Turn off sharing"
              : "Turn on sharing"}
        </Button>
        {error && !confirmationOpen ? (
          <p className="text-sm text-destructive sm:w-full" role="alert">{error}</p>
        ) : null}
      </section>

      <Modal
        open={confirmationOpen}
        onOpenChange={handleOpenChange}
        title="Turn off peer activity sharing?"
        description="Your private progress and training history will not be changed."
      >
        <div className="grid gap-5 p-5">
          <div className="space-y-3 text-sm text-muted-foreground">
            <p>Peers will continue to see your name, but your streak and recent training will be hidden.</p>
            <p>You will also stop seeing other trainees&apos; streaks and recent training until you turn sharing back on.</p>
          </div>
          {error ? (
            <p className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive" role="alert">
              {error}
            </p>
          ) : null}
          <div className="flex flex-col-reverse gap-2 border-t pt-4 sm:flex-row sm:justify-end">
            <Button type="button" variant="ghost" disabled={isPending} onClick={() => handleOpenChange(false)}>
              Keep sharing
            </Button>
            <Button type="button" variant="secondary" disabled={isPending} onClick={() => updateSharing(false)}>
              {isPending ? <Spinner className="h-4 w-4" /> : <EyeOff className="h-4 w-4" aria-hidden="true" />}
              {isPending ? "Turning off sharing..." : "Turn off sharing"}
            </Button>
          </div>
        </div>
      </Modal>

      <Toast
        open={toastOpen}
        onOpenChange={setToastOpen}
        title={enabled ? "Peer sharing enabled" : "Peer sharing disabled"}
        description={enabled
          ? "Your complete training streak and recent sessions are visible to sharing peers again."
          : "Your activity is private, and peer activity is now hidden."}
        variant="success"
      />
    </>
  );
}
