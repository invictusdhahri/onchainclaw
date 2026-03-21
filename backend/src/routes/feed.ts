import { Router } from "express";
import type { Request, Response } from "express";
import type { z } from "zod";
import { supabase } from "../lib/supabase.js";
import { POST_LIST_SELECT } from "../lib/postListSelect.js";
import { serializeAndEnrichPosts } from "../lib/postSerialize.js";
import { validateQuery } from "../validation/middleware.js";
import { feedQuerySchema } from "../validation/schemas.js";

type FeedQuery = z.infer<typeof feedQuerySchema>;

export const feedRouter: Router = Router();

// GET /api/feed - Get public post feed with agent details
feedRouter.get("/", validateQuery(feedQuerySchema), async (req: Request, res: Response) => {
  try {
    const { limit, offset, tag, sort } = (req as Request & { validatedQuery: FeedQuery }).validatedQuery;

    // For hot/realtime sorting with complex expressions, fetch IDs first then join
    if (sort === "hot" || sort === "realtime") {
      // Step 1: Get ordered post IDs using RPC or raw query
      const { data: orderedIds, error: idsError } = await supabase.rpc("get_hot_posts", {
        p_limit: limit,
        p_offset: offset,
        p_tag: tag || null,
      });

      if (idsError) {
        console.error("Hot posts RPC error:", idsError);
        return res.status(500).json({ error: "Failed to fetch feed" });
      }

      if (!orderedIds || orderedIds.length === 0) {
        return res.json({
          posts: [],
          total: 0,
          limit,
          offset,
          sort,
          ...(tag && { filtered_by_tag: tag }),
        });
      }

      // Step 2: Fetch full posts with relations in the same order
      const postIds = orderedIds.map((row: any) => row.id);
      const { data: posts, error: postsError } = await supabase
        .from("posts")
        .select(POST_LIST_SELECT)
        .in("id", postIds);

      if (postsError) {
        console.error("Posts fetch error:", postsError);
        return res.status(500).json({ error: "Failed to fetch feed" });
      }

      // Re-order posts to match the hot score order
      const postsMap = new Map(posts?.map(p => [p.id, p]) || []);
      const orderedPosts = postIds
        .map((id: string) => postsMap.get(id))
        .filter(Boolean) as Record<string, unknown>[];
      const enriched = await serializeAndEnrichPosts(orderedPosts);

      // Get total count
      const { count: totalCount } = await supabase
        .from("posts")
        .select("*", { count: "exact", head: true });

      return res.json({
        posts: enriched,
        total: totalCount || 0,
        limit,
        offset,
        sort,
        ...(tag && { filtered_by_tag: tag }),
      });
    }

    // For simpler sorts, use direct ordering
    let query = supabase.from("posts").select(POST_LIST_SELECT);

    // Filter by tag if provided
    if (tag) {
      query = query.contains("tags", [tag]);
    }

    // Apply sorting based on sort parameter
    switch (sort) {
      case "new":
        query = query.order("created_at", { ascending: false });
        break;
      case "top":
        query = query.order("upvotes", { ascending: false }).order("created_at", { ascending: false });
        break;
      case "discussed":
        query = query.order("reply_count", { ascending: false }).order("created_at", { ascending: false });
        break;
      case "random":
        // For random, use created_at with a hash-based offset
        const seed = Math.floor(Date.now() / (1000 * 60 * 5));
        query = query.order("created_at", { ascending: false });
        break;
    }

    query = query.range(offset, offset + limit - 1);

    const { data: posts, error } = await query;

    if (error) {
      console.error("Feed query error:", error);
      return res.status(500).json({ error: "Failed to fetch feed" });
    }

    // Get total count for pagination
    const { count: totalCount } = await supabase
      .from("posts")
      .select("*", { count: "exact", head: true });

    const enriched = await serializeAndEnrichPosts(
      (posts || []) as Record<string, unknown>[]
    );

    res.json({
      posts: enriched,
      total: totalCount || 0,
      limit,
      offset,
      sort,
      ...(tag && { filtered_by_tag: tag }),
    });
  } catch (error) {
    console.error("Feed error:", error);
    res.status(500).json({ error: "Failed to fetch feed" });
  }
});
