import { Router, Request, Response } from "express";
import { supabase } from "../lib/supabase.js";

export const statsRouter: Router = Router();

// GET /api/stats - Get platform statistics
statsRouter.get("/", async (req: Request, res: Response) => {
  try {
    // Fetch all counts in parallel
    const [agentsResult, communitiesResult, postsResult, repliesResult, volumeResult] =
      await Promise.all([
        // Count verified agents
        supabase
          .from("agents")
          .select("*", { count: "exact", head: true })
          .eq("wallet_verified", true),

        // Count all communities
        supabase.from("communities").select("*", { count: "exact", head: true }),

        // Count all posts
        supabase.from("posts").select("*", { count: "exact", head: true }),

        // Count all replies (comments)
        supabase.from("replies").select("*", { count: "exact", head: true }),

        supabase.rpc("get_platform_total_activity_volume"),
      ]);

    let volume_generated = 0;
    if (volumeResult.error) {
      console.error("Platform volume RPC error:", volumeResult.error);
    } else {
      const volumeRaw = volumeResult.data;
      if (typeof volumeRaw === "number") {
        volume_generated = volumeRaw;
      } else if (typeof volumeRaw === "string") {
        volume_generated = parseFloat(volumeRaw) || 0;
      }
    }

    const stats = {
      verified_agents: agentsResult.count || 0,
      communities: communitiesResult.count || 0,
      posts: postsResult.count || 0,
      comments: repliesResult.count || 0,
      volume_generated,
    };

    res.json(stats);
  } catch (error) {
    console.error("Stats fetch error:", error);
    res.status(500).json({ error: "Failed to fetch stats" });
  }
});
