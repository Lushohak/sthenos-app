"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getUserOrRedirect } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

export async function inviteTraineeAction(clientId: string) {
  const { supabase, user } = await getUserOrRedirect();
  const { data: client, error: clientError } = await supabase
    .from("clients")
    .select("id, name, email, client_user_id")
    .eq("coach_id", user.id)
    .eq("id", clientId)
    .single();

  if (clientError || !client) {
    throw new Error("Client not found.");
  }

  if (!client.email) {
    redirect(`/dashboard/clients/${clientId}?invite=missing-email`);
  }

  const headerStore = await headers();
  const origin = headerStore.get("origin") ?? process.env.NEXT_PUBLIC_SITE_URL;
  const admin = createAdminClient();

  const { data, error } = await admin.auth.admin.inviteUserByEmail(client.email, {
    redirectTo: `${origin}/auth/callback?next=/trainee/setup`,
    data: {
      full_name: client.name,
      role: "trainee",
      client_id: client.id,
      coach_id: user.id
    }
  });

  if (error) {
    redirect(`/dashboard/clients/${clientId}?invite=error`);
  }

  const invitedUserId = data.user?.id ?? client.client_user_id;

  if (invitedUserId) {
    await admin.from("profiles").upsert({
      id: invitedUserId,
      full_name: client.name,
      role: "trainee"
    });

    const { error: updateError } = await admin
      .from("clients")
      .update({
        client_user_id: invitedUserId,
        invited_at: new Date().toISOString()
      })
      .eq("id", client.id)
      .eq("coach_id", user.id);

    if (updateError) {
      throw new Error(updateError.message);
    }
  }

  revalidatePath(`/dashboard/clients/${clientId}`);
  redirect(`/dashboard/clients/${clientId}?invite=sent`);
}
