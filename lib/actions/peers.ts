"use server";

import { revalidatePath } from "next/cache";
import { getTraineeOrRedirect } from "@/lib/trainee";

export type PeerSharingResult =
  | { success: true; enabled: boolean }
  | { success: false; message: string };

export async function updatePeerActivitySharingAction(
  enabled: boolean
): Promise<PeerSharingResult> {
  const { supabase, client } = await getTraineeOrRedirect();

  if (client.status === "archived") {
    return {
      success: false,
      message: "Peer sharing is unavailable for an archived trainee profile."
    };
  }

  const { data, error } = await supabase.rpc("set_peer_activity_sharing", {
    target_enabled: enabled
  });

  if (error || data !== enabled) {
    return {
      success: false,
      message: "We could not update your peer sharing preference. Please try again."
    };
  }

  revalidatePath("/trainee/peers");
  return { success: true, enabled };
}
