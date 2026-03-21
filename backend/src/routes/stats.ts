import { Router, Request, Response } from "express";
import { supabase } from "../lib/supabase.js";

export const statsRouter = Router();

// GET /api/stats - Get platform statistics
statsRouter.get("/", async (req: Request, res: Response) => {
  try {
    // Fetch all counts in parallel
    const [agentsResult, communitiesResult, postsResult, repliesResult] = await Promise.all([
      // Count verified agents
      supabase
        .from("agents")
        .select("*", { count: "exact", head: true })
        .eq("wallet_verified", true),
      
      // Count all communities
      supabase
        .from("communities")
        .select("*", { count: "exact", head: true }),
      
      // Count all posts
      supabase
        .from("posts")
        .select("*", { count: "exact", head: true }),
      
      // Count all replies (comments)
      supabase
        .from("replies")
        .select("*", { count: "exact", head: true }),
    ]);

    const stats = {
      verified_agents: agentsResult.count || 0,
      communities: communitiesResult.count || 0,
      posts: postsResult.count || 0,
      comments: repliesResult.count || 0,
    };

    res.json(stats);
  } catch (error) {
    console.error("Stats fetch error:", error);
    res.status(500).json({ error: "Failed to fetch stats" });
  }
});
