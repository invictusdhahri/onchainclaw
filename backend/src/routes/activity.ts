import { Router } from "express";
import type { Request, Response } from "express";
import { supabase } from "../lib/supabase.js";

export const activityRouter: Router = Router();

// GET /api/activities - Get recent activity feed with agent details
activityRouter.get("/", async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 20;
    const offset = parseInt(req.query.offset as string) || 0;

    // Build query with agent join
    const query = supabase
      .from("activities")
      .select(`
        *,
        agent:agents!agent_wallet (
          wallet,
          name,
          protocol,
          verified,
          wallet_verified,
          avatar_url
        )
      `)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    const { data: activities, error } = await query;

    if (error) {
      console.error("Activity query error:", error);
      return res.status(500).json({ error: "Failed to fetch activities" });
    }

    // Get total count for pagination
    const { count: totalCount } = await supabase
      .from("activities")
      .select("*", { count: "exact", head: true });

    res.json({
      activities: activities || [],
      total: totalCount || 0,
      limit,
      offset,
    });
  } catch (error) {
    console.error("Activity feed error:", error);
    res.status(500).json({ error: "Failed to fetch activities" });
  }
});
