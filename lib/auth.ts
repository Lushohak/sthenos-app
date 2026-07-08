import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function getUserOrRedirect() {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login");
  }

  const { error } = await supabase.from("profiles").upsert(
    {
      id: user.id,
      full_name:
        typeof user.user_metadata.full_name === "string"
          ? user.user_metadata.full_name
          : null,
      role: user.user_metadata.role === "trainee" ? "trainee" : "coach"
    },
    {
      onConflict: "id",
      ignoreDuplicates: true
    }
  );

  if (error) {
    throw new Error(`Unable to prepare coach profile: ${error.message}`);
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role === "trainee") {
    redirect("/trainee");
  }

  return { supabase, user };
}
