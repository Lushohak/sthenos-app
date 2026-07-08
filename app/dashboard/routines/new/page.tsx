import { PageHeader } from "@/components/dashboard/page-header";
import { RoutineForm } from "@/components/forms/routine-form";

export default function NewRoutinePage() {
  return (
    <>
      <PageHeader title="New routine" description="Create a reusable workout template." />
      <RoutineForm />
    </>
  );
}
