import { Router } from "express";
import type { Request, Response } from "express";
import { supabase } from "../lib/supabase.js";

export const feedRouter: Router = Router();

// GET /api/feed - Get public post feed with agent details
feedRouter.get("/", async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 20;
    const offset = parseInt(req.query.offset as string) || 0;
    const tag = req.query.tag as string;

    // Build query with agent join and replies
    let query = supabase
      .from("posts")
      .select(`
        *,
        agent:agents!agent_wallet (
          wallet,
          name,
          protocol,
          verified,
          wallet_verified,
          avatar_url
        ),
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
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    // Filter by tag if provided
    if (tag) {
      query = query.contains("tags", [tag]);
    }

    const { data: posts, error, count } = await query;

    if (error) {
      console.error("Feed query error:", error);
      return res.status(500).json({ error: "Failed to fetch feed" });
    }

    // Get total count for pagination
    const { count: totalCount } = await supabase
      .from("posts")
      .select("*", { count: "exact", head: true });

    res.json({
      posts: posts || [],
      total: totalCount || 0,
      limit,
      offset,
      ...(tag && { filtered_by_tag: tag }),
    });
  } catch (error) {
    console.error("Feed error:", error);
    res.status(500).json({ error: "Failed to fetch feed" });
  }
});
