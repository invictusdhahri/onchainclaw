import { supabase } from "./supabase.js";
import {
  loadPredictionBundlesByPostIds,
  loadPredictionVoteMapsByPostIds,
} from "./predictionBundle.js";
import {
  getActivityTxCache,
  mgetActivityTxCache,
  setActivityTxCache,
  type CachedActivityPayload,
} from "./redis.js";
import { fetchBatchTokenMetadata } from "./codex.js";

/** @mentions: @AgentName — no spaces in registered names; match up to next whitespace or @ */
const MENTION_RE = /@([^\s@]{1,120})/g;

export function extractMentionNames(
  ...texts: (string | null | undefined)[]
): string[] {
  const set = new Set<string>();
  for (const t of texts) {
    if (!t) continue;
    const r = new RegExp(MENTION_RE.source, MENTION_RE.flags);
    let m: RegExpExecArray | null;
    while ((m = r.exec(t)) !== null) {
      const raw = m[1]!.trim();
      if (raw.length > 0) set.add(raw);
    }
  }
  return [...set];
}

export async function loadMentionMap(
  names: string[]
): Promise<Record<string, string>> {
  if (names.length === 0) return {};
  const { data, error } = await supabase.rpc("resolve_mention_names", {
    p_names: names,
  });
  if (error || !data || !Array.isArray(data)) return {};
  const map: Record<string, string> = {};
  for (const row of data as { name_key: string; wallet: string }[]) {
    if (row.name_key && row.wallet) map[row.name_key] = row.wallet;
  }
  return map;
}

export function mentionMapForPost(
  post: { body: string; replies?: Array<{ body: string }> },
  global: Record<string, string>
): Record<string, string> {
  const tokens = extractMentionNames(
    post.body,
    ...(post.replies?.map((r) => r.body) || [])
  );
  const out: Record<string, string> = {};
  for (const t of tokens) {
    const key = t.trim().toLowerCase();
    if (global[key]) out[key] = global[key]!;
  }
  return out;
}

export function attachMentionMap<T extends Record<string, unknown>>(
  raw: T,
  mention_map: Record<string, string>
): T & { mention_map: Record<string, string> } {
  return { ...raw, mention_map };
}

/** Higher upvotes first; ties broken by older reply first (conversation order). */
export function sortPostRepliesByUpvotes(post: Record<string, unknown>): Record<string, unknown> {
  const replies = post.replies;
  if (!Array.isArray(replies) || replies.length === 0) {
    return post;
  }
  const sorted = [...replies].sort((a, b) => {
    const ra = a as Record<string, unknown>;
    const rb = b as Record<string, unknown>;
    const ua = typeof ra.upvotes === "number" ? ra.upvotes : 0;
    const ub = typeof rb.upvotes === "number" ? rb.upvotes : 0;
    if (ub !== ua) return ub - ua;
    const ca = typeof ra.created_at === "string" ? ra.created_at : "";
    const cb = typeof rb.created_at === "string" ? rb.created_at : "";
    return ca.localeCompare(cb);
  });
  return { ...post, replies: sorted };
}

/**
 * Batch-load activity summaries for a list of tx_hashes.
 * Redis MGET → DB fallback for misses → Codex token symbol enrichment → Redis backfill.
 */
async function loadActivityMap(
  txHashes: string[]
): Promise<Map<string, CachedActivityPayload>> {
  const map = new Map<string, CachedActivityPayload>();
  if (txHashes.length === 0) return map;

  // 1. Single Redis MGET round-trip
  const cached = await mgetActivityTxCache(txHashes);
  const misses: string[] = [];

  for (let i = 0; i < txHashes.length; i++) {
    const hit = cached[i];
    if (hit) {
      map.set(txHashes[i]!, hit);
    } else {
      misses.push(txHashes[i]!);
    }
  }

  if (misses.length === 0) return map;

  // 2. DB query only for misses (include counterparty for memo text)
  try {
    const { data } = await supabase
      .from("activities")
      .select("tx_hash, action, amount, token, counterparty")
      .in("tx_hash", misses);

    if (data && data.length > 0) {
      // 3. Batch Codex token symbol enrichment for unique non-null mints
      const uniqueMints = [
        ...new Set(
          data
            .map((r) => r.token as string | null)
            .filter((t): t is string => !!t)
        ),
      ];
      const symbolMap =
        uniqueMints.length > 0
          ? await fetchBatchTokenMetadata(uniqueMints)
          : new Map();

      const backfills: Promise<void>[] = [];
      for (const row of data) {
        const action = row.action as string;
        const token = row.token as string | null;
        const counterparty = row.counterparty as string | null;

        const tokenSymbol = token ? (symbolMap.get(token)?.symbol ?? null) : null;
        // For memo actions, counterparty stores the memo text (not a wallet address)
        const memoText = action === "memo" ? counterparty : null;

        const payload: CachedActivityPayload = {
          action,
          amount: row.amount as number,
          token,
          ...(tokenSymbol ? { token_symbol: tokenSymbol } : {}),
          ...(memoText ? { memo_text: memoText } : {}),
        };
        map.set(row.tx_hash as string, payload);
        // 4. Backfill Redis so next request is a cache hit
        backfills.push(setActivityTxCache(row.tx_hash as string, payload));
      }
      await Promise.allSettled(backfills);
    }
  } catch {
    // Non-fatal: activity data is optional on posts
  }

  return map;
}

export async function serializeAndEnrichPosts(
  rawPosts: Record<string, unknown>[]
): Promise<Array<Record<string, unknown> & { mention_map: Record<string, string> }>> {
  const allTokens = new Set<string>();
  for (const p of rawPosts) {
    extractMentionNames(
      p.body as string,
      ...((p.replies as Array<{ body: string }> | undefined)?.map((r) => r.body) || [])
    ).forEach((t) => allTokens.add(t));
  }

  // Collect non-null tx_hashes for activity batch lookup
  const txHashes = rawPosts
    .map((p) => p.tx_hash as string | undefined)
    .filter((h): h is string => typeof h === "string" && h.length > 0);

  const [globalMap, predictionBundles, predictionVoteMaps, activityMap] =
    await Promise.all([
      loadMentionMap([...allTokens]),
      loadPredictionBundlesByPostIds(
        rawPosts
          .filter((p) => p.post_kind === "prediction" && typeof p.id === "string")
          .map((p) => p.id as string)
      ),
      loadPredictionVoteMapsByPostIds(
        rawPosts
          .filter((p) => p.post_kind === "prediction" && typeof p.id === "string")
          .map((p) => p.id as string)
      ),
      loadActivityMap(txHashes),
    ]);

  return rawPosts.map((p) => {
    const ordered = sortPostRepliesByUpvotes(p);
    const withMentions = attachMentionMap(
      ordered,
      mentionMapForPost(
        ordered as { body: string; replies?: Array<{ body: string }> },
        globalMap
      )
    );

    const txHash = p.tx_hash as string | undefined;
    const activity = txHash ? (activityMap.get(txHash) ?? null) : null;

    const withActivity = activity ? { ...withMentions, activity } : withMentions;

    const pid = p.id as string | undefined;
    if (p.post_kind === "prediction" && pid && predictionBundles.has(pid)) {
      const voteMap = predictionVoteMaps.get(pid);
      return {
        ...withActivity,
        prediction: predictionBundles.get(pid),
        ...(voteMap && Object.keys(voteMap).length > 0
          ? { prediction_votes_by_wallet: voteMap }
          : {}),
      };
    }
    return withActivity;
  });
}

export async function serializeSinglePost(raw: Record<string, unknown>) {
  const ordered = sortPostRepliesByUpvotes(raw);
  const tokens = extractMentionNames(
    ordered.body as string,
    ...((ordered.replies as Array<{ body: string }> | undefined)?.map((r) => r.body) || [])
  );

  const txHash = raw.tx_hash as string | undefined;

  const [globalMap, activity] = await Promise.all([
    loadMentionMap(tokens),
    txHash ? getActivityTxCache(txHash) : Promise.resolve(null),
  ]);

  // DB fallback for single-post activity on a Redis miss
  let resolvedActivity = activity;
  if (!resolvedActivity && txHash) {
    try {
      const { data } = await supabase
        .from("activities")
        .select("tx_hash, action, amount, token, counterparty")
        .eq("tx_hash", txHash)
        .maybeSingle();
      if (data) {
        const action = data.action as string;
        const token = data.token as string | null;
        const counterparty = data.counterparty as string | null;
        const memoText = action === "memo" ? counterparty : null;

        // Single-mint Codex lookup for token symbol
        let tokenSymbol: string | null = null;
        if (token) {
          try {
            const symbolMap = await fetchBatchTokenMetadata([token]);
            tokenSymbol = symbolMap.get(token)?.symbol ?? null;
          } catch {
            // Non-fatal
          }
        }

        resolvedActivity = {
          action,
          amount: data.amount as number,
          token,
          ...(tokenSymbol ? { token_symbol: tokenSymbol } : {}),
          ...(memoText ? { memo_text: memoText } : {}),
        };
        setActivityTxCache(txHash, resolvedActivity).catch(() => {});
      }
    } catch {
      // Non-fatal
    }
  }

  const withMentions = attachMentionMap(
    ordered,
    mentionMapForPost(
      ordered as { body: string; replies?: Array<{ body: string }> },
      globalMap
    )
  );

  const withActivity = resolvedActivity
    ? { ...withMentions, activity: resolvedActivity }
    : withMentions;

  const pid = raw.id as string | undefined;
  if (raw.post_kind === "prediction" && pid) {
    const bundles = await loadPredictionBundlesByPostIds([pid]);
    const voteMaps = await loadPredictionVoteMapsByPostIds([pid]);
    const b = bundles.get(pid);
    const voteMap = voteMaps.get(pid);
    if (b) {
      return {
        ...withActivity,
        prediction: b,
        ...(voteMap && Object.keys(voteMap).length > 0
          ? { prediction_votes_by_wallet: voteMap }
          : {}),
      };
    }
  }
  return withActivity;
}
