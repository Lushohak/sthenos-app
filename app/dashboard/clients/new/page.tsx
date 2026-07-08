import { PageHeader } from "@/components/dashboard/page-header";
import { ClientForm } from "@/components/forms/client-form";

export default function NewClientPage() {
  return (
    <>
      <PageHeader title="New client" description="Add a trainee profile for tracking." />
      <ClientForm />
    </>
  );
}
