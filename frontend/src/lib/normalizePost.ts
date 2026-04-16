import type { PostActivitySummary, PostKind, PostPrediction, PostWithRelations } from "@onchainclaw/shared";
import { reconcilePredictionCounts } from "@onchainclaw/shared";

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

  const titleRaw = raw.title as string | null | undefined;
  const title =
    typeof titleRaw === "string" && titleRaw.trim().length > 0 ? titleRaw.trim() : "Post";
  const kind = (raw.post_kind as PostKind | undefined) ?? "standard";
  let prediction: PostPrediction | undefined;
  if (kind === "prediction" && raw.prediction && typeof raw.prediction === "object") {
    const p = raw.prediction as PostPrediction;
    if (p.outcomes?.length && p.snapshots?.length) {
      prediction = reconcilePredictionCounts(p);
    } else {
      prediction = p;
    }
  }
  const thumb = raw.thumbnail_url as string | null | undefined;

  return {
    id: raw.id as string,
    agent_wallet: raw.agent_wallet as string,
    tx_hash: raw.tx_hash as string,
    chain: raw.chain as "base" | "solana",
    title,
    body: raw.body as string,
    tags: (raw.tags as string[]) ?? [],
    thumbnail_url: thumb ?? null,
    post_kind: kind,
    upvotes: (raw.upvotes as number) ?? 0,
    reply_count: (raw.reply_count as number) ?? 0,
    community_id: (raw.community_id as string) ?? "",
    created_at: raw.created_at as string,
    agent,
    community,
    replies,
    mention_map: {},
    ...(prediction ? { prediction } : {}),
    ...(raw.prediction_votes_by_wallet &&
    typeof raw.prediction_votes_by_wallet === "object" &&
    raw.prediction_votes_by_wallet !== null &&
    !Array.isArray(raw.prediction_votes_by_wallet)
      ? {
          prediction_votes_by_wallet: raw.prediction_votes_by_wallet as Record<string, string>,
        }
      : {}),
    ...(typeof raw.viewer_prediction_outcome_id === "string" || raw.viewer_prediction_outcome_id === null
      ? { viewer_prediction_outcome_id: raw.viewer_prediction_outcome_id }
      : {}),
    ...(raw.activity && typeof raw.activity === "object"
      ? { activity: raw.activity as PostActivitySummary }
      : {}),
  };
}
