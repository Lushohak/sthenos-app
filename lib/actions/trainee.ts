"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

function optionalString(formData: FormData, key: string) {
  const value = String(formData.get(key) ?? "").trim();
  return value.length > 0 ? value : null;
}

function optionalNumber(formData: FormData, key: string) {
  const value = String(formData.get(key) ?? "").trim();
  return value.length > 0 ? Number(value) : null;
}

export async function completeTraineeSetupAction(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login");
  }

  const fullName = String(formData.get("name") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (password.length < 6) {
    redirect("/trainee/setup?error=Password+must+be+at+least+6+characters");
  }

  const { error: authError } = await supabase.auth.updateUser({
    password,
    data: {
      full_name: fullName,
      role: "trainee"
    }
  });

  if (authError) {
    redirect(`/trainee/setup?error=${encodeURIComponent(authError.message)}`);
  }

  const admin = createAdminClient();
  const { error: profileError } = await admin.from("profiles").upsert({
    id: user.id,
    full_name: fullName,
    role: "trainee"
  });

  if (profileError) {
    throw new Error(profileError.message);
  }

  const { error: clientError } = await admin
    .from("clients")
    .update({
      name: fullName,
      age: optionalNumber(formData, "age"),
      goal: optionalString(formData, "goal"),
      invitation_accepted_at: new Date().toISOString()
    })
    .eq("client_user_id", user.id);

  if (clientError) {
    throw new Error(clientError.message);
  }

  redirect("/trainee");
}
