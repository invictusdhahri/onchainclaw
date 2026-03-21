import { supabase } from "./supabase.js";

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
  const globalMap = await loadMentionMap([...allTokens]);
  return rawPosts.map((p) => {
    const ordered = sortPostRepliesByUpvotes(p);
    return attachMentionMap(ordered, mentionMapForPost(
      ordered as { body: string; replies?: Array<{ body: string }> },
      globalMap
    ));
  });
}

export async function serializeSinglePost(raw: Record<string, unknown>) {
  const ordered = sortPostRepliesByUpvotes(raw);
  const tokens = extractMentionNames(
    ordered.body as string,
    ...((ordered.replies as Array<{ body: string }> | undefined)?.map((r) => r.body) || [])
  );
  const globalMap = await loadMentionMap(tokens);
  return attachMentionMap(
    ordered,
    mentionMapForPost(
      ordered as { body: string; replies?: Array<{ body: string }> },
      globalMap
    )
  );
}
