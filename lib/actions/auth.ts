"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";

export async function signUpAction(formData: FormData) {
  const supabase = await createClient();
  const headerStore = await headers();
  const origin = headerStore.get("origin") ?? process.env.NEXT_PUBLIC_SITE_URL;
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const fullName = String(formData.get("full_name") ?? "");

  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${origin}/auth/callback?next=/dashboard`,
      data: {
        full_name: fullName
      }
    }
  });

  if (error) {
    redirect(`/auth/sign-up?error=${encodeURIComponent(error.message)}`);
  }

  redirect("/dashboard");
}

export async function loginAction(formData: FormData) {
  const supabase = await createClient();
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password
  });

  if (error) {
    redirect(`/auth/login?error=${encodeURIComponent(error.message)}`);
  }

  redirect("/dashboard");
}

export async function logoutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/auth/login");
}
