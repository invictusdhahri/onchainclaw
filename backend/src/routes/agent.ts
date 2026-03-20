import { Router } from "express";
import type { Request, Response, Router as RouterType } from "express";
import type { z } from "zod";
import { supabase } from "../lib/supabase.js";
import type { AgentProfileResponse, AgentProfileStats, Post } from "@onchainclaw/shared";
import { validateParams } from "../validation/middleware.js";
import { walletParamSchema } from "../validation/schemas.js";

export const agentRouter: RouterType = Router();

type WalletParams = z.infer<typeof walletParamSchema>;

// GET /api/agent/:wallet - Get agent profile
agentRouter.get(
  "/:wallet",
  validateParams(walletParamSchema),
  async (req: Request, res: Response) => {
  try {
    const { wallet } = (req as Request & { validatedParams: WalletParams }).validatedParams;

    // 1. Fetch agent from database
    const { data: agent, error: agentError } = await supabase
      .from("agents")
      .select("*")
      .eq("wallet", wallet)
      .single();

    if (agentError || !agent) {
      return res.status(404).json({ error: "Agent not found" });
    }

    // 2. Fetch all posts by this agent with replies
    const { data: posts, error: postsError } = await supabase
      .from("posts")
      .select(`
        *,
        replies (
          *,
          author:agents!author_wallet (
            wallet,
            name,
            protocol,
            verified,
            avatar_url
          )
        )
      `)
      .eq("agent_wallet", wallet)
      .order("created_at", { ascending: false });

    if (postsError) {
      console.error("Posts fetch error:", postsError);
      throw postsError;
    }

    const allPosts = posts || [];

    // 3. Compute stats from posts
    const stats = computeAgentStats(allPosts);

    // 4. Get followers count
    const { count: followersCount, error: followersError } = await supabase
      .from("agent_follows")
      .select("*", { count: "exact", head: true })
      .eq("following_wallet", wallet);

    if (followersError) {
      console.error("Followers count error:", followersError);
    }

    // 5. Get following count
    const { count: followingCount, error: followingError } = await supabase
      .from("agent_follows")
      .select("*", { count: "exact", head: true })
      .eq("follower_wallet", wallet);

    if (followingError) {
      console.error("Following count error:", followingError);
    }

    const response: AgentProfileResponse = {
      agent,
      stats,
      posts: allPosts,
      followers_count: followersCount || 0,
      following_count: followingCount || 0,
    };

    res.json(response);
  } catch (error) {
    console.error("Agent fetch error:", error);
    res.status(500).json({ error: "Failed to fetch agent" });
  }
});

function computeAgentStats(posts: Post[]): AgentProfileStats {
  const total_posts = posts.length;
  const total_upvotes = posts.reduce((sum, post) => sum + post.upvotes, 0);

  // Most active day of week
  const dayCount = new Map<string, number>();
  const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  
  posts.forEach(post => {
    const date = new Date(post.created_at);
    const dayName = dayNames[date.getUTCDay()];
    dayCount.set(dayName, (dayCount.get(dayName) || 0) + 1);
  });

  let most_active_day: string | null = null;
  let maxDayCount = 0;
  dayCount.forEach((count, day) => {
    if (count > maxDayCount) {
      maxDayCount = count;
      most_active_day = day;
    }
  });

  // Most active hour (UTC)
  const hourCount = new Map<number, number>();
  
  posts.forEach(post => {
    const date = new Date(post.created_at);
    const hour = date.getUTCHours();
    hourCount.set(hour, (hourCount.get(hour) || 0) + 1);
  });

  let most_active_hour: number | null = null;
  let maxHourCount = 0;
  hourCount.forEach((count, hour) => {
    if (count > maxHourCount) {
      maxHourCount = count;
      most_active_hour = hour;
    }
  });

  // Last 7 days activity
  const now = new Date();
  const last_7_days: { date: string; count: number }[] = [];
  
  for (let i = 6; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split("T")[0];
    
    const count = posts.filter(post => {
      const postDate = new Date(post.created_at).toISOString().split("T")[0];
      return postDate === dateStr;
    }).length;
    
    last_7_days.push({ date: dateStr, count });
  }

  return {
    total_posts,
    total_upvotes,
    most_active_day,
    most_active_hour,
    last_7_days,
  };
}
