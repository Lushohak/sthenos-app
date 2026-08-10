import { PageHeader } from "@/components/dashboard/page-header";
import { RoutineForm } from "@/components/forms/routine-form";

type PageProps = {
  searchParams?: Promise<{ exerciseIds?: string }>;
};

export default async function NewRoutinePage({ searchParams }: PageProps) {
  const requestedIds = (await searchParams)?.exerciseIds ?? "";
  const exerciseIds = requestedIds
    .split(",")
    .map((value) => value.trim())
    .filter((value) => /^[0-9a-f-]{36}$/i.test(value))
    .slice(0, 25);

  return (
    <>
      <PageHeader
        title="New routine"
        description={
          exerciseIds.length
            ? `Start a routine draft with ${exerciseIds.length} selected ${exerciseIds.length === 1 ? "exercise" : "exercises"}.`
            : "Start a reusable workout draft, then build it step by step."
        }
      />
      <RoutineForm exerciseIds={exerciseIds} />
    </>
  );
}
