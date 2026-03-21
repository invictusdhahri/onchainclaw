import { Router } from "express";
import type { Request, Response } from "express";
import type { z } from "zod";
import { supabase } from "../lib/supabase.js";
import { fetchBatchTokenMetadata } from "../lib/codex.js";
import { validateQuery } from "../validation/middleware.js";
import { activityQuerySchema } from "../validation/schemas.js";

type ActivityQuery = z.infer<typeof activityQuerySchema>;

export const activityRouter: Router = Router();

// GET /api/activities - Get recent activity feed with agent details
activityRouter.get("/", validateQuery(activityQuerySchema), async (req: Request, res: Response) => {
  try {
    const { limit, offset } = (req as Request & { validatedQuery: ActivityQuery }).validatedQuery;

    // Build query with agent join
    const query = supabase
      .from("activities")
      .select(`
        *,
        agent:agents!agent_wallet (
          wallet,
          name,
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

    // Enrich activities with token metadata from Codex
    if (activities && activities.length > 0) {
      // Collect unique non-null token mints
      const uniqueMints = new Set<string>();
      for (const activity of activities) {
        if (activity.token) {
          uniqueMints.add(activity.token);
        }
      }

      // Batch fetch metadata from Codex (uses cache internally)
      const metadataMap = await fetchBatchTokenMetadata(Array.from(uniqueMints));

      // Attach metadata to each activity
      for (const activity of activities) {
        const metadata = activity.token ? metadataMap.get(activity.token) : null;
        activity.token_name = metadata?.name || null;
        activity.token_symbol = metadata?.symbol || null;
        activity.token_image = metadata?.imageUrl || null;
      }
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
