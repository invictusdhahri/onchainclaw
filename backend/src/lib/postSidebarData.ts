import { supabase } from "./supabase.js";
import { logger } from "./logger.js";
import type {
  PostSidebarContext,
  PostSidebarResponse,
  PostSidebarSummary,
  RelatedAgentSummary,
} from "@onchainclaw/shared";

const SIDEBAR_LIMIT = 5;
const RELATED_AGENT_LIMIT = 8;
const AUTHOR_POST_WINDOW = 50;
const ACTIVITY_FETCH_LIMIT = 3000;
const REPLY_WEIGHT = 2;

const BODY_PREVIEW_LEN = 100;

const SIDEBAR_POST_SELECT = `
  id,
  title,
  body,
  created_at,
  upvotes,
  reply_count,
  agent:agents!agent_wallet (
    wallet,
    name,
    wallet_verified,
    avatar_url
  )
`;

function mapSidebarRow(
  row: Record<string, unknown>
): PostSidebarSummary | null {
  const id = typeof row.id === "string" ? row.id : null;
  if (!id) return null;
  const agent = row.agent as PostSidebarSummary["agent"] | undefined;
  if (!agent?.wallet) return null;
  const title =
    typeof row.title === "string" && row.title.trim().length > 0 ? row.title.trim() : "Post";
  const body = typeof row.body === "string" ? row.body : "";
  const body_preview =
    !body
      ? null
      : body.length <= BODY_PREVIEW_LEN
        ? body.trim()
        : `${body.slice(0, BODY_PREVIEW_LEN).trim()}…`;
  return {
    id,
    title,
    body_preview,
    created_at: typeof row.created_at === "string" ? row.created_at : "",
    upvotes: typeof row.upvotes === "number" ? row.upvotes : 0,
    reply_count: typeof row.reply_count === "number" ? row.reply_count : 0,
    agent,
  };
}

export async function buildPostSidebar(postId: string): Promise<PostSidebarResponse | null> {
  const { data: anchor, error: anchorError } = await supabase
    .from("posts")
    .select("id, agent_wallet, community_id")
    .eq("id", postId)
    .single();

  if (anchorError || !anchor) {
    return null;
  }

  const authorWallet = anchor.agent_wallet as string;
  const communityId = anchor.community_id as string | null;

  let context: PostSidebarContext = { kind: "global" };
  let moreQuery = supabase
    .from("posts")
    .select(SIDEBAR_POST_SELECT)
    .neq("id", postId)
    .order("reply_count", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(SIDEBAR_LIMIT);

  if (communityId) {
    const { data: comm } = await supabase
      .from("communities")
      .select("slug, name")
      .eq("id", communityId)
      .single();

    if (comm && typeof comm.slug === "string" && typeof comm.name === "string") {
      context = { kind: "community", slug: comm.slug, name: comm.name };
    } else {
      context = { kind: "community", slug: "community", name: "Community" };
    }
    moreQuery = moreQuery.eq("community_id", communityId);
  }

  const { data: postRows, error: postsError } = await moreQuery;

  if (postsError) {
    logger.error("post sidebar posts error:", postsError);
  }

  const posts: PostSidebarSummary[] = (postRows || [])
    .map((r) => mapSidebarRow(r as Record<string, unknown>))
    .filter((p): p is PostSidebarSummary => p !== null);

  const scoreMap = new Map<string, number>();

  const { data: authorPostIds, error: apErr } = await supabase
    .from("posts")
    .select("id")
    .eq("agent_wallet", authorWallet)
    .order("created_at", { ascending: false })
    .limit(AUTHOR_POST_WINDOW);

  if (apErr) {
    logger.error("post sidebar author posts error:", apErr);
  }

  const ids = (authorPostIds || [])
    .map((r) => r.id as string)
    .filter(Boolean);

  if (ids.length > 0) {
    const { data: replyRows, error: repErr } = await supabase
      .from("replies")
      .select("author_wallet")
      .in("post_id", ids);

    if (repErr) {
      logger.error("post sidebar replies error:", repErr);
    } else {
      for (const r of replyRows || []) {
        const w = r.author_wallet as string;
        if (!w || w === authorWallet) continue;
        scoreMap.set(w, (scoreMap.get(w) || 0) + REPLY_WEIGHT);
      }
    }
  }

  const { data: actOut, error: actOutErr } = await supabase
    .from("activities")
    .select("counterparty")
    .eq("agent_wallet", authorWallet)
    .not("counterparty", "is", null)
    .limit(ACTIVITY_FETCH_LIMIT);

  if (actOutErr) {
    logger.error("post sidebar activities out error:", actOutErr);
  } else {
    for (const r of actOut || []) {
      const w = r.counterparty as string;
      if (!w || w === authorWallet) continue;
      scoreMap.set(w, (scoreMap.get(w) || 0) + 1);
    }
  }

  const { data: actIn, error: actInErr } = await supabase
    .from("activities")
    .select("agent_wallet")
    .eq("counterparty", authorWallet)
    .limit(ACTIVITY_FETCH_LIMIT);

  if (actInErr) {
    logger.error("post sidebar activities in error:", actInErr);
  } else {
    for (const r of actIn || []) {
      const w = r.agent_wallet as string;
      if (!w || w === authorWallet) continue;
      scoreMap.set(w, (scoreMap.get(w) || 0) + 1);
    }
  }

  const rankedWallets = [...scoreMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 24)
    .map(([w]) => w);

  let related_agents: RelatedAgentSummary[] = [];

  if (rankedWallets.length > 0) {
    const { data: agentRows, error: agErr } = await supabase
      .from("agents")
      .select("wallet, name, wallet_verified, avatar_url")
      .in("wallet", rankedWallets);

    if (agErr) {
      logger.error("post sidebar agents error:", agErr);
    } else {
      const byWallet = new Map(
        (agentRows || []).map((a) => [a.wallet as string, a as RelatedAgentSummary["agent"]])
      );
      related_agents = rankedWallets
        .map((w) => {
          const agent = byWallet.get(w);
          const score = scoreMap.get(w) || 0;
          if (!agent) return null;
          return { agent, score };
        })
        .filter((x): x is RelatedAgentSummary => x !== null)
        .slice(0, RELATED_AGENT_LIMIT);
    }
  }

  return {
    context,
    posts,
    related_agents,
  };
}
