import { createClientAction, updateClientAction } from "@/lib/actions/clients";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import type { Database } from "@/types/database";

type Client = Database["public"]["Tables"]["clients"]["Row"];

type ClientFormProps = {
  client?: Client;
  returnTo?: string;
};

export function ClientForm({ client, returnTo }: ClientFormProps) {
  const action = client ? updateClientAction.bind(null, client.id, returnTo) : createClientAction;
  const today = new Date().toISOString().slice(0, 10);
  const minimumBirthDate = new Date(`${today}T12:00:00Z`);
  minimumBirthDate.setUTCFullYear(minimumBirthDate.getUTCFullYear() - 120);

  return (
    <form action={action} className="grid max-w-2xl gap-4">
      <Field label="Name">
        <Input name="name" defaultValue={client?.name} required />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Email">
          <Input name="email" type="email" defaultValue={client?.email ?? ""} />
        </Field>
        <Field label="Gender">
          <Select name="gender" defaultValue={client?.gender ?? ""}>
            <option value="">Not set</option>
            <option value="male">Male</option>
            <option value="female">Female</option>
            <option value="prefer_not_to_say">Prefer not to say</option>
          </Select>
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Date of birth" hint="Age is calculated automatically.">
          <Input
            name="date_of_birth"
            type="date"
            min={minimumBirthDate.toISOString().slice(0, 10)}
            max={today}
            defaultValue={client?.date_of_birth ?? ""}
          />
        </Field>
        <Field label="Height (cm)" hint="Optional">
          <Input
            name="height_cm"
            type="number"
            min="30"
            max="300"
            step="0.1"
            inputMode="decimal"
            defaultValue={client?.height_cm ?? ""}
          />
        </Field>
      </div>
      <Field label="Goal">
        <Input name="goal" defaultValue={client?.goal ?? ""} />
      </Field>
      <Field label="Status">
        <Select name="status" defaultValue={client?.status ?? "active"}>
          <option value="active">Active</option>
          <option value="paused">Paused</option>
          <option value="archived">Archived</option>
        </Select>
      </Field>
      <Field label="Notes">
        <Textarea name="notes" defaultValue={client?.notes ?? ""} />
      </Field>
      {!client ? (
        <div className="flex items-start gap-3 rounded-xl border bg-card p-4 shadow-soft">
          <input
            id="send-invite-on-create"
            name="send_invite"
            type="checkbox"
            defaultChecked
            aria-describedby="send-invite-on-create-description"
            className="mt-0.5 h-4 w-4 shrink-0 accent-primary"
          />
          <span>
            <label htmlFor="send-invite-on-create" className="block text-sm font-semibold text-foreground">Send account invitation after creation</label>
            <span id="send-invite-on-create-description" className="mt-1 block text-sm text-muted-foreground">
              When an email is provided, Sthenos will immediately send the trainee their password setup link. Uncheck this if you want to invite them later.
            </span>
          </span>
        </div>
      ) : null}
      <SubmitButton
        className="w-fit"
        pendingLabel={client ? "Saving client..." : "Creating client..."}
      >
        {client ? "Save client" : "Create client"}
      </SubmitButton>
    </form>
  );
}
