import { createClientAction, updateClientAction } from "@/lib/actions/clients";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import type { Database } from "@/types/database";

type Client = Database["public"]["Tables"]["clients"]["Row"];

type ClientFormProps = {
  client?: Client;
};

export function ClientForm({ client }: ClientFormProps) {
  const action = client ? updateClientAction.bind(null, client.id) : createClientAction;

  return (
    <form action={action} className="grid max-w-2xl gap-4">
      <Field label="Name">
        <Input name="name" defaultValue={client?.name} required />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Email">
          <Input name="email" type="email" defaultValue={client?.email ?? ""} />
        </Field>
        <Field label="Age">
          <Input name="age" type="number" min={1} max={120} defaultValue={client?.age ?? ""} />
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
      <Button type="submit" className="w-fit">
        {client ? "Save client" : "Create client"}
      </Button>
      {/* TODO: Add client login invitation and portal access controls here. */}
    </form>
  );
}
