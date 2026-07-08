import { notFound } from "next/navigation";
import { PageHeader } from "@/components/dashboard/page-header";
import { ClientForm } from "@/components/forms/client-form";
import { getUserOrRedirect } from "@/lib/auth";

type PageProps = {
  params: Promise<{ clientId: string }>;
};

export default async function EditClientPage({ params }: PageProps) {
  const { clientId } = await params;
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
      <ClientForm client={client} />
    </>
  );
}
