import { Mail } from "lucide-react";
import { inviteTraineeAction } from "@/lib/actions/trainee-invites";
import { SubmitButton } from "@/components/ui/submit-button";

type TraineeInviteFormProps = {
  clientId: string;
  clientUserId?: string | null;
  email: string | null;
  invitedAt?: string | null;
  acceptedAt?: string | null;
};

export function TraineeInviteForm({
  clientId,
  clientUserId,
  email,
  invitedAt,
  acceptedAt
}: TraineeInviteFormProps) {
  const disabled = !email || Boolean(acceptedAt);
  const isSetupPending = Boolean(clientUserId) && !acceptedAt;

  return (
    <form action={inviteTraineeAction.bind(null, clientId)} className="rounded-md border bg-card p-4 shadow-soft">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-semibold">Trainee account</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {acceptedAt
              ? "Account setup completed."
              : isSetupPending
                ? "Setup is pending. Send another password setup email if needed."
                : invitedAt
                  ? "The previous Auth account was removed. Send a new invitation."
                : "Send an email invite so this trainee can set a password."}
          </p>
        </div>
        <SubmitButton
          variant="secondary"
          disabled={disabled}
          pendingLabel={
            isSetupPending ? "Sending setup email..." : "Sending invite..."
          }
        >
          <Mail className="h-4 w-4" aria-hidden="true" />
          {acceptedAt
            ? "Account active"
            : isSetupPending
              ? "Send setup email again"
              : "Send invite"}
        </SubmitButton>
      </div>
      {!email ? (
        <p className="mt-3 text-sm text-destructive">Add an email before inviting this trainee.</p>
      ) : null}
    </form>
  );
}
