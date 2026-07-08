import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function getTraineeOrRedirect() {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login");
  }

  const { data: client, error } = await supabase
    .from("clients")
    .select("*")
    .eq("client_user_id", user.id)
    .single();

  if (error || !client) {
    redirect("/dashboard");
  }

  return { supabase, user, client };
}
