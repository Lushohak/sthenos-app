import { completeTraineeSetupAction } from "@/lib/actions/trainee";
import { PageHeader } from "@/components/dashboard/page-header";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { getTraineeOrRedirect } from "@/lib/trainee";

type PageProps = {
  searchParams?: Promise<{ error?: string }>;
};

export default async function TraineeSetupPage({ searchParams }: PageProps) {
  const [{ client }, params] = await Promise.all([getTraineeOrRedirect(), searchParams]);

  return (
    <>
      <PageHeader
        title="Finish your account"
        description="Set your password and confirm the profile details your coach started."
      />
      <form action={completeTraineeSetupAction} className="grid max-w-xl gap-4 rounded-md border bg-white p-4 shadow-soft">
        {params?.error ? (
          <div className="rounded-md border border-destructive/25 px-3 py-2 text-sm text-destructive">
            {params.error}
          </div>
        ) : null}
        <Field label="Name">
          <Input name="name" defaultValue={client.name} required />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Age">
            <Input name="age" type="number" min={1} max={120} defaultValue={client.age ?? ""} />
          </Field>
          <Field label="Goal">
            <Input name="goal" defaultValue={client.goal ?? ""} />
          </Field>
        </div>
        <Field label="Password" hint="Use at least 6 characters.">
          <Input name="password" type="password" autoComplete="new-password" minLength={6} required />
        </Field>
        <Button type="submit" className="w-fit">
          Complete setup
        </Button>
      </form>
    </>
  );
}
