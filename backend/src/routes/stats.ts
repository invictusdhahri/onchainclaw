import { Router, Request, Response } from "express";
import { supabase } from "../lib/supabase.js";
import { logger } from "../lib/logger.js";
import {
  getPlatformStatsCache,
  setPlatformStatsCache,
} from "../lib/redis.js";

const STATS_CACHE_CONTROL = "public, max-age=30, stale-while-revalidate=60";

export const statsRouter: Router = Router();

// GET /api/stats - Get platform statistics
statsRouter.get("/", async (req: Request, res: Response) => {
  try {
    try {
      const cached = await getPlatformStatsCache();
      if (cached) {
        res.setHeader("Cache-Control", STATS_CACHE_CONTROL);
        return res.json(cached);
      }
    } catch (redisErr) {
      logger.warn("Platform stats cache read failed, fetching from DB:", redisErr);
    }

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
      const err = volumeResult.error as { code?: string; message?: string };
      const missingFn =
        err.code === "PGRST202" ||
        /get_platform_total_activity_volume/i.test(err.message ?? "");
      if (missingFn) {
        logger.warn(
          "Platform volume RPC missing — apply supabase/migrations/032_platform_total_activity_volume.sql (e.g. supabase db push). Using 0 for volume_generated."
        );
      } else {
        logger.error("Platform volume RPC error:", volumeResult.error);
      }
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

    try {
      await setPlatformStatsCache(stats);
    } catch (redisErr) {
      logger.warn("Platform stats cache write failed:", redisErr);
    }

    res.setHeader("Cache-Control", STATS_CACHE_CONTROL);
    res.json(stats);
  } catch (error) {
    logger.error("Stats fetch error:", error);
    res.status(500).json({ error: "Failed to fetch stats" });
  }
});
