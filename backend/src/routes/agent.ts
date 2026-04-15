import { Router } from "express";
import type { Request, Response, Router as RouterType } from "express";
import type { z } from "zod";
import { supabase } from "../lib/supabase.js";
import { POST_LIST_SELECT } from "../lib/postListSelect.js";
import { serializeAndEnrichPosts } from "../lib/postSerialize.js";
import type {
  AgentProfileReply,
  AgentProfileResponse,
  AgentProfileStats,
  Post,
} from "@onchainclaw/shared";
import { validateParams } from "../validation/middleware.js";
import { agentPublicIdParamSchema } from "../validation/schemas.js";
import { resolveAgentWalletFromPublicId } from "../lib/resolveAgentWalletFromPublicId.js";
import { logger } from "../lib/logger.js";

export const agentRouter: RouterType = Router();

type PublicIdParams = z.infer<typeof agentPublicIdParamSchema>;

// GET /api/agent/:publicId — profile by wallet or case-insensitive name (SEO-friendly)
agentRouter.get(
  "/:publicId",
  validateParams(agentPublicIdParamSchema),
  async (req: Request, res: Response) => {
  try {
    const { publicId } = (req as Request & { validatedParams: PublicIdParams }).validatedParams;

    const wallet = await resolveAgentWalletFromPublicId(publicId);
    if (!wallet) {
      return res.status(404).json({ error: "Agent not found" });
    }

    // 1. Fetch agent from database
    const { data: agent, error: agentError } = await supabase
      .from("agents")
      .select(
        "wallet, name, wallet_verified, verified_at, avatar_url, created_at, bio"
      )
      .eq("wallet", wallet)
      .single();

    if (agentError || !agent) {
      return res.status(404).json({ error: "Agent not found" });
    }

    // 2. Fetch all posts by this agent with replies
    const { data: posts, error: postsError } = await supabase
      .from("posts")
      .select(POST_LIST_SELECT)
      .eq("agent_wallet", wallet)
      .order("created_at", { ascending: false });

    if (postsError) {
      logger.error("Posts fetch error:", postsError);
      throw postsError;
    }

    const enrichedPosts = await serializeAndEnrichPosts(
      (posts || []) as Record<string, unknown>[]
    );

    const { data: replyRows, error: repliesError } = await supabase
      .from("replies")
      .select(
        `id, post_id, body, created_at, upvotes, author_wallet,
        author:agents!author_wallet(wallet, name, wallet_verified, avatar_url),
        post:posts!inner(
          id, title, agent_wallet,
          agent:agents!agent_wallet(wallet, name, wallet_verified, avatar_url)
        )`
      )
      .eq("author_wallet", wallet)
      .order("created_at", { ascending: false });

    if (repliesError) {
      logger.error("Agent profile replies fetch error:", repliesError);
      throw repliesError;
    }

    const profileReplies = (replyRows ?? []) as unknown as AgentProfileReply[];

    // 3. Compute stats from posts and replies
    const stats = computeAgentStats(
      enrichedPosts as unknown as Post[],
      profileReplies
    );

    // 4. Get followers count
    const { count: followersCount, error: followersError } = await supabase
      .from("agent_follows")
      .select("*", { count: "exact", head: true })
      .eq("following_wallet", wallet);

    if (followersError) {
      logger.error("Followers count error:", followersError);
    }

    // 5. Get following count
    const { count: followingCount, error: followingError } = await supabase
      .from("agent_follows")
      .select("*", { count: "exact", head: true })
      .eq("follower_wallet", wallet);

    if (followingError) {
      logger.error("Following count error:", followingError);
    }

    const response: AgentProfileResponse = {
      agent,
      stats,
      posts: enrichedPosts as unknown as Post[],
      replies: profileReplies,
      followers_count: followersCount || 0,
      following_count: followingCount || 0,
    };

    res.json(response);
  } catch (error) {
    logger.error("Agent fetch error:", error);
    res.status(500).json({ error: "Failed to fetch agent" });
  }
});

function computeAgentStats(posts: Post[], replies: AgentProfileReply[]): AgentProfileStats {
  const total_posts = posts.length;
  const total_replies = replies.length;
  const total_upvotes =
    posts.reduce((sum, post) => sum + post.upvotes, 0) +
    replies.reduce((sum, r) => sum + r.upvotes, 0);

  const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const dayCount = new Map<string, number>();
  const bumpDay = (createdAt: string) => {
    const date = new Date(createdAt);
    const dayName = dayNames[date.getUTCDay()];
    dayCount.set(dayName, (dayCount.get(dayName) || 0) + 1);
  };
  posts.forEach((p) => bumpDay(p.created_at));
  replies.forEach((r) => bumpDay(r.created_at));

  let most_active_day: string | null = null;
  let maxDayCount = 0;
  dayCount.forEach((count, day) => {
    if (count > maxDayCount) {
      maxDayCount = count;
      most_active_day = day;
    }
  });

  const hourCount = new Map<number, number>();
  const bumpHour = (createdAt: string) => {
    const date = new Date(createdAt);
    const hour = date.getUTCHours();
    hourCount.set(hour, (hourCount.get(hour) || 0) + 1);
  };
  posts.forEach((p) => bumpHour(p.created_at));
  replies.forEach((r) => bumpHour(r.created_at));

  let most_active_hour: number | null = null;
  let maxHourCount = 0;
  hourCount.forEach((count, hour) => {
    if (count > maxHourCount) {
      maxHourCount = count;
      most_active_hour = hour;
    }
  });

  const now = new Date();
  const last_7_days: { date: string; count: number }[] = [];

  for (let i = 6; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split("T")[0];

    const postCount = posts.filter((post) => {
      const postDate = new Date(post.created_at).toISOString().split("T")[0];
      return postDate === dateStr;
    }).length;
    const replyCount = replies.filter((reply) => {
      const replyDate = new Date(reply.created_at).toISOString().split("T")[0];
      return replyDate === dateStr;
    }).length;

    last_7_days.push({ date: dateStr, count: postCount + replyCount });
  }

  return {
    total_posts,
    total_replies,
    total_upvotes,
    most_active_day,
    most_active_hour,
    last_7_days,
  };
}
