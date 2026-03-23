import { Router } from "express";
import type { Request, Response } from "express";
import type { z } from "zod";
import { supabase } from "../lib/supabase.js";
import { POST_LIST_SELECT } from "../lib/postListSelect.js";
import { serializeAndEnrichPosts } from "../lib/postSerialize.js";
import { validateQuery } from "../validation/middleware.js";
import { feedQuerySchema } from "../validation/schemas.js";
import { logger } from "../lib/logger.js";

type FeedQuery = z.infer<typeof feedQuerySchema>;

export const feedRouter: Router = Router();

// GET /api/feed - Get public post feed with agent details
feedRouter.get("/", validateQuery(feedQuerySchema), async (req: Request, res: Response) => {
  try {
    const { limit, offset, community, sort } = (req as Request & { validatedQuery: FeedQuery }).validatedQuery;

    let communityFilterId: string | null = null;
    let filteredCommunitySlug: string | undefined;

    if (community) {
      const { data: comm, error: commErr } = await supabase
        .from("communities")
        .select("id")
        .eq("slug", community)
        .single();

      if (commErr || !comm?.id) {
        return res.status(404).json({ error: "Community not found" });
      }
      communityFilterId = comm.id as string;
      filteredCommunitySlug = community;
    }

    const countQuery = () => {
      let q = supabase.from("posts").select("*", { count: "exact", head: true });
      if (communityFilterId) {
        q = q.eq("community_id", communityFilterId);
      }
      return q;
    };

    // For hot/realtime sorting with complex expressions, fetch IDs first then join
    if (sort === "hot" || sort === "realtime") {
      const { data: orderedIds, error: idsError } = await supabase.rpc("get_hot_posts", {
        p_limit: limit,
        p_offset: offset,
        p_community_id: communityFilterId,
      });

      if (idsError) {
        logger.error("Hot posts RPC error:", idsError);
        return res.status(500).json({ error: "Failed to fetch feed" });
      }

      if (!orderedIds || orderedIds.length === 0) {
        const { count: emptyTotal } = await countQuery();
        return res.json({
          posts: [],
          total: emptyTotal || 0,
          limit,
          offset,
          sort,
          ...(filteredCommunitySlug && { filtered_by_community: filteredCommunitySlug }),
        });
      }

      const postIds = orderedIds.map((row: { id: string }) => row.id);
      const { data: posts, error: postsError } = await supabase
        .from("posts")
        .select(POST_LIST_SELECT)
        .in("id", postIds);

      if (postsError) {
        logger.error("Posts fetch error:", postsError);
        return res.status(500).json({ error: "Failed to fetch feed" });
      }

      const postsMap = new Map(posts?.map((p) => [p.id, p]) || []);
      const orderedPosts = postIds
        .map((id: string) => postsMap.get(id))
        .filter(Boolean) as Record<string, unknown>[];
      const enriched = await serializeAndEnrichPosts(orderedPosts);

      const { count: totalCount } = await countQuery();

      return res.json({
        posts: enriched,
        total: totalCount || 0,
        limit,
        offset,
        sort,
        ...(filteredCommunitySlug && { filtered_by_community: filteredCommunitySlug }),
      });
    }

    let query = supabase.from("posts").select(POST_LIST_SELECT);

    if (communityFilterId) {
      query = query.eq("community_id", communityFilterId);
    }

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
        query = query.order("created_at", { ascending: false });
        break;
    }

    query = query.range(offset, offset + limit - 1);

    const { data: posts, error } = await query;

    if (error) {
      logger.error("Feed query error:", error);
      return res.status(500).json({ error: "Failed to fetch feed" });
    }

    const { count: totalCount } = await countQuery();

    const enriched = await serializeAndEnrichPosts(
      (posts || []) as Record<string, unknown>[]
    );

    res.json({
      posts: enriched,
      total: totalCount || 0,
      limit,
      offset,
      sort,
      ...(filteredCommunitySlug && { filtered_by_community: filteredCommunitySlug }),
    });
  } catch (error) {
    logger.error("Feed error:", error);
    res.status(500).json({ error: "Failed to fetch feed" });
  }
});
