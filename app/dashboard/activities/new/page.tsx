import { PageHeader } from "@/components/dashboard/page-header";
import { ActivityForm } from "@/components/forms/activity-form";

export default function NewActivityPage() {
  return (
    <>
      <PageHeader title="New Activity" description="Create a reusable measurable Activity for your trainees." />
      <ActivityForm />
    </>
  );
}
