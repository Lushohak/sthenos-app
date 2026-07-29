"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getUserOrRedirect } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

type InviteAuthError = {
  code?: string;
  message: string;
  status?: number;
};

function getInviteErrorStatus(error: InviteAuthError) {
  if (error.status === 429) return "rate-limited";

  const message = error.message.toLowerCase();

  switch (error.code) {
    case "email_address_not_authorized":
      return "email-not-authorized";
    case "email_address_invalid":
    case "validation_failed":
      return "invalid-email";
    case "email_exists":
    case "user_already_exists":
      return "email-exists";
    case "email_provider_disabled":
      return "email-disabled";
    case "over_email_send_rate_limit":
    case "over_request_rate_limit":
      return "rate-limited";
    case "user_not_found":
      return "account-missing";
    default:
      if (message.includes("not authorized")) return "email-not-authorized";
      if (message.includes("already") || message.includes("registered")) {
        return "email-exists";
      }
      if (message.includes("invalid email")) return "invalid-email";
      if (message.includes("rate limit")) return "rate-limited";
      return "error";
  }
}

function redirectInviteError(
  clientId: string,
  error: InviteAuthError,
  operation: "invite" | "resend"
): never {
  const status = getInviteErrorStatus(error);

  console.error("Trainee authentication email failed.", {
    clientId,
    operation,
    code: error.code ?? "unknown",
    status: error.status ?? "unknown",
    message: error.message
  });

  redirect(`/dashboard/clients/${clientId}?invite=${status}`);
}

async function getAuthRedirectUrl() {
  const headerStore = await headers();
  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
    headerStore.get("origin")?.trim();

  if (!siteUrl) {
    throw new Error("Missing NEXT_PUBLIC_SITE_URL.");
  }

  return `${siteUrl.replace(/\/+$/, "")}/auth/callback?next=/trainee/setup`;
}

async function findAuthUserByEmail(
  admin: ReturnType<typeof createAdminClient>,
  email: string
) {
  const normalizedEmail = email.toLowerCase();

  for (let page = 1; page <= 100; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({
      page,
      perPage: 1000
    });

    if (error) {
      return { user: null, error };
    }

    const matchingUser = data.users.find(
      (authUser) => authUser.email?.toLowerCase() === normalizedEmail
    );

    if (matchingUser) {
      return { user: matchingUser, error: null };
    }

    if (data.users.length < 1000) break;
  }

  return { user: null, error: null };
}

export async function inviteTraineeAction(clientId: string) {
  const { supabase, user } = await getUserOrRedirect();
  const { data: client, error: clientError } = await supabase
    .from("clients")
    .select(
      "id, name, email, client_user_id, invited_at, invitation_accepted_at"
    )
    .eq("coach_id", user.id)
    .eq("id", clientId)
    .single();

  if (clientError || !client) {
    throw new Error("Client not found.");
  }

  if (!client.email) {
    redirect(`/dashboard/clients/${clientId}?invite=missing-email`);
  }

  const traineeId = client.id;
  const traineeEmail = client.email;
  const admin = createAdminClient();
  const redirectTo = await getAuthRedirectUrl();

  if (client.invitation_accepted_at) {
    redirect(`/dashboard/clients/${clientId}?invite=active`);
  }

  async function sendSetupEmail(authUserId: string): Promise<never> {
    const { error: recoveryError } =
      await admin.auth.resetPasswordForEmail(traineeEmail, {
        redirectTo
      });

    if (recoveryError) {
      redirectInviteError(clientId, recoveryError, "resend");
    }

    const { error: resendUpdateError } = await admin
      .from("clients")
      .update({ invited_at: new Date().toISOString() })
      .eq("id", traineeId)
      .eq("coach_id", user.id)
      .eq("client_user_id", authUserId);

    if (resendUpdateError) {
      throw new Error(resendUpdateError.message);
    }

    revalidatePath(`/dashboard/clients/${clientId}`);
    redirect(`/dashboard/clients/${clientId}?invite=resent`);
  }

  if (client.client_user_id) {
    const { data: authUserData, error: authUserError } =
      await admin.auth.admin.getUserById(client.client_user_id);

    if (authUserError) {
      redirectInviteError(clientId, authUserError, "resend");
    }

    if (
      !authUserData.user?.email ||
      authUserData.user.email.toLowerCase() !== client.email.toLowerCase()
    ) {
      redirect(`/dashboard/clients/${clientId}?invite=account-mismatch`);
    }

    await sendSetupEmail(client.client_user_id);
  }

  const { data, error } = await admin.auth.admin.inviteUserByEmail(client.email, {
    redirectTo,
    data: {
      full_name: client.name,
      role: "trainee",
      client_id: client.id,
      coach_id: user.id
    }
  });

  if (error) {
    if (getInviteErrorStatus(error) === "email-exists") {
      const {
        user: existingAuthUser,
        error: existingAuthUserError
      } = await findAuthUserByEmail(admin, client.email);

      if (existingAuthUserError) {
        redirectInviteError(clientId, existingAuthUserError, "invite");
      }

      const metadata = existingAuthUser?.user_metadata;
      const belongsToThisClient =
        metadata?.client_id === client.id && metadata?.coach_id === user.id;

      if (existingAuthUser && belongsToThisClient) {
        const { error: profileError } = await admin.from("profiles").upsert({
          id: existingAuthUser.id,
          full_name: client.name,
          role: "trainee"
        });

        if (profileError) {
          throw new Error(profileError.message);
        }

        const { error: linkError } = await admin
          .from("clients")
          .update({ client_user_id: existingAuthUser.id })
          .eq("id", client.id)
          .eq("coach_id", user.id)
          .is("client_user_id", null);

        if (linkError) {
          throw new Error(linkError.message);
        }

        await sendSetupEmail(existingAuthUser.id);
      }
    }

    redirectInviteError(clientId, error, "invite");
  }

  const invitedUserId = data.user?.id;

  if (!invitedUserId) {
    throw new Error("Supabase did not return the invited user.");
  }

  const { error: profileError } = await admin.from("profiles").upsert({
    id: invitedUserId,
    full_name: client.name,
    role: "trainee"
  });

  if (profileError) {
    throw new Error(profileError.message);
  }

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

  revalidatePath(`/dashboard/clients/${clientId}`);
  redirect(`/dashboard/clients/${clientId}?invite=sent`);
}
