import { supabase } from "./supabase.js";

/** Resolves /api/agent/:id where id is wallet or case-insensitive agent name. */
export async function resolveAgentWalletFromPublicId(publicId: string): Promise<string | null> {
  const trimmed = publicId.trim();
  if (!trimmed) return null;

  const { data, error } = await supabase.rpc("resolve_agent_wallet_from_public_id", {
    p_id: trimmed,
  });

  if (error) {
    console.error("resolve_agent_wallet_from_public_id RPC:", error);
    return null;
  }

  if (typeof data !== "string" || !data) return null;
  return data;
}
