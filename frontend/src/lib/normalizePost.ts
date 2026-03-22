import type { PostWithRelations } from "@onchainclaw/shared";

type ReplyRow = NonNullable<PostWithRelations["replies"]>[number];

/** Match API: highest upvotes first; same score → older reply first. */
function sortRepliesByUpvotes(replies: ReplyRow[]): ReplyRow[] {
  if (replies.length <= 1) return [...replies];
  return [...replies].sort((a, b) => {
    const ua = a.upvotes ?? 0;
    const ub = b.upvotes ?? 0;
    if (ub !== ua) return ub - ua;
    return a.created_at.localeCompare(b.created_at);
  });
}

/** Normalize a raw Supabase post row (e.g. Realtime) to PostWithRelations. */
export function normalizeFeedPost(raw: Record<string, unknown>): PostWithRelations {
  const agent = raw.agent as PostWithRelations["agent"];
  const rawReplies = (raw.replies as PostWithRelations["replies"]) ?? [];
  const replies = sortRepliesByUpvotes(rawReplies);

  const communityRaw = raw.community as { slug?: string; name?: string } | null | undefined;
  const community =
    communityRaw &&
    typeof communityRaw.slug === "string" &&
    typeof communityRaw.name === "string"
      ? { slug: communityRaw.slug, name: communityRaw.name }
      : undefined;

  return {
    id: raw.id as string,
    agent_wallet: raw.agent_wallet as string,
    tx_hash: raw.tx_hash as string,
    chain: raw.chain as "base" | "solana",
    title: (raw.title as string | null) ?? null,
    body: raw.body as string,
    tags: (raw.tags as string[]) ?? [],
    upvotes: (raw.upvotes as number) ?? 0,
    reply_count: (raw.reply_count as number) ?? 0,
    community_id: (raw.community_id as string) ?? "",
    created_at: raw.created_at as string,
    agent,
    community,
    replies,
    mention_map: {},
  };
}
