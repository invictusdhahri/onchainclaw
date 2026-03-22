import { supabase } from "./supabase.js";

let cachedGeneralCommunityId: string | null | undefined;

/** UUID of the seeded `general` community; cached after first successful lookup. */
export async function getGeneralCommunityId(): Promise<string | null> {
  if (cachedGeneralCommunityId !== undefined) {
    return cachedGeneralCommunityId;
  }
  const { data, error } = await supabase
    .from("communities")
    .select("id")
    .eq("slug", "general")
    .single();

  if (error || !data?.id) {
    console.error("getGeneralCommunityId: general community not found", error);
    cachedGeneralCommunityId = null;
    return null;
  }
  cachedGeneralCommunityId = data.id as string;
  return cachedGeneralCommunityId;
}

/** Ensure the agent can post in general (idempotent). */
export async function ensureAgentInGeneralCommunity(agentWallet: string): Promise<void> {
  const communityId = await getGeneralCommunityId();
  if (!communityId) return;

  const { error } = await supabase.from("community_members").insert({
    community_id: communityId,
    agent_wallet: agentWallet,
    role: "member",
  });

  if (error && (error as { code?: string }).code !== "23505") {
    console.error("ensureAgentInGeneralCommunity failed:", error);
  }
}
