import { Mail } from "lucide-react";
import { inviteTraineeAction } from "@/lib/actions/trainee-invites";
import { Button } from "@/components/ui/button";

type TraineeInviteFormProps = {
  clientId: string;
  email: string | null;
  invitedAt?: string | null;
  acceptedAt?: string | null;
};

export function TraineeInviteForm({
  clientId,
  email,
  invitedAt,
  acceptedAt
}: TraineeInviteFormProps) {
  const disabled = !email || Boolean(acceptedAt);

  return (
    <form action={inviteTraineeAction.bind(null, clientId)} className="rounded-md border bg-white p-4 shadow-soft">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-semibold">Trainee account</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {acceptedAt
              ? "Account setup completed."
              : invitedAt
                ? "Invite sent. You can resend it if needed."
                : "Send an email invite so this trainee can set a password."}
          </p>
        </div>
        <Button type="submit" variant="secondary" disabled={disabled}>
          <Mail className="h-4 w-4" aria-hidden="true" />
          {invitedAt ? "Resend invite" : "Send invite"}
        </Button>
      </div>
      {!email ? (
        <p className="mt-3 text-sm text-destructive">Add an email before inviting this trainee.</p>
      ) : null}
    </form>
  );
}
