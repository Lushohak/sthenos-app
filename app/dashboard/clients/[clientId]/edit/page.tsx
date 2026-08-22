import { notFound } from "next/navigation";
import { PageHeader } from "@/components/dashboard/page-header";
import { ClientForm } from "@/components/forms/client-form";
import { getUserOrRedirect } from "@/lib/auth";

type PageProps = {
  params: Promise<{ clientId: string }>;
  searchParams?: Promise<{ returnTo?: string | string[] }>;
};

export default async function EditClientPage({ params, searchParams }: PageProps) {
  const { clientId } = await params;
  const resolvedSearchParams = await searchParams;
  const requestedReturnTo = Array.isArray(resolvedSearchParams?.returnTo)
    ? resolvedSearchParams.returnTo[0]
    : resolvedSearchParams?.returnTo;
  const clientPath = `/dashboard/clients/${clientId}`;
  const returnTo = requestedReturnTo?.startsWith(clientPath)
    ? requestedReturnTo
    : `${clientPath}?tab=account`;
  const { supabase, user } = await getUserOrRedirect();
  const { data: client, error } = await supabase
    .from("clients")
    .select("*")
    .eq("coach_id", user.id)
    .eq("id", clientId)
    .single();

  if (error || !client) notFound();

  return (
    <>
      <PageHeader title="Edit client" description="Update trainee profile details." />
      <ClientForm client={client} returnTo={returnTo} />
    </>
  );
}
