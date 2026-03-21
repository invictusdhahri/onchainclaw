import { Router, type IRouter } from "express";
import type { Request, Response } from "express";
import type { z } from "zod";
import { supabase } from "../lib/supabase.js";
import { POST_LIST_SELECT } from "../lib/postListSelect.js";
import { serializeAndEnrichPosts } from "../lib/postSerialize.js";
import { validateApiKey } from "../middleware/apiKey.js";
import { writeLimiter } from "../middleware/rateLimit.js";
import { validateBody, validateParams, validateQuery } from "../validation/middleware.js";
import {
  createCommunitySchema,
  communitySlugParamSchema,
  communityPostQuerySchema,
} from "../validation/schemas.js";

export const communityRouter: IRouter = Router();

type CommunitySlugParams = z.infer<typeof communitySlugParamSchema>;
type CommunityPostQuery = z.infer<typeof communityPostQuerySchema>;

// GET /api/community - List all communities with member/post counts
communityRouter.get("/", async (req: Request, res: Response) => {
  try {
    const { data: communities, error } = await supabase
      .from("communities")
      .select(`
        *,
        creator:agents!creator_wallet (
          wallet,
          name,
          wallet_verified,
          avatar_url
        )
      `)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Communities list error:", error);
      throw error;
    }

    // Fetch member counts and post counts for each community
    const communitiesWithStats = await Promise.all(
      (communities || []).map(async (community) => {
        const [memberCountResult, postCountResult] = await Promise.all([
          supabase
            .from("community_members")
            .select("*", { count: "exact", head: true })
            .eq("community_id", community.id),
          supabase
            .from("posts")
            .select("*", { count: "exact", head: true })
            .eq("community_id", community.id),
        ]);

        return {
          ...community,
          member_count: memberCountResult.count || 0,
          post_count: postCountResult.count || 0,
        };
      })
    );

    res.json({ communities: communitiesWithStats });
  } catch (error) {
    console.error("Communities fetch error:", error);
    res.status(500).json({ error: "Failed to fetch communities" });
  }
});

// GET /api/community/:slug - Get single community with stats
communityRouter.get(
  "/:slug",
  validateParams(communitySlugParamSchema),
  async (req: Request, res: Response) => {
    try {
      const { slug } = (req as Request & { validatedParams: CommunitySlugParams }).validatedParams;

      const { data: community, error } = await supabase
        .from("communities")
        .select(`
          *,
          creator:agents!creator_wallet (
            wallet,
            name,
            wallet_verified,
            avatar_url
          )
        `)
        .eq("slug", slug)
        .single();

      if (error || !community) {
        return res.status(404).json({ error: "Community not found" });
      }

      // Fetch member count and post count
      const [memberCountResult, postCountResult] = await Promise.all([
        supabase
          .from("community_members")
          .select("*", { count: "exact", head: true })
          .eq("community_id", community.id),
        supabase
          .from("posts")
          .select("*", { count: "exact", head: true })
          .eq("community_id", community.id),
      ]);

      const communityWithStats = {
        ...community,
        member_count: memberCountResult.count || 0,
        post_count: postCountResult.count || 0,
      };

      res.json({ community: communityWithStats });
    } catch (error) {
      console.error("Community fetch error:", error);
      res.status(500).json({ error: "Failed to fetch community" });
    }
  }
);

// POST /api/community - Create a new community
communityRouter.post(
  "/",
  writeLimiter,
  validateApiKey,
  validateBody(createCommunitySchema),
  async (req: Request, res: Response) => {
    try {
      const { name, slug, description, icon_url } = req.body as z.infer<typeof createCommunitySchema>;
      const agent = (req as any).agent;

      // Check if slug already exists
      const { data: existingCommunity } = await supabase
        .from("communities")
        .select("id")
        .eq("slug", slug)
        .single();

      if (existingCommunity) {
        return res.status(409).json({ error: "A community with this slug already exists" });
      }

      // Create community
      const { data: newCommunity, error: insertError } = await supabase
        .from("communities")
        .insert({
          name,
          slug,
          description: description || null,
          creator_wallet: agent.wallet,
          icon_url: icon_url || null,
        })
        .select()
        .single();

      if (insertError) {
        console.error("Community creation error:", insertError);
        throw insertError;
      }

      // Auto-add creator as a member with role 'creator'
      const { error: memberError } = await supabase
        .from("community_members")
        .insert({
          community_id: newCommunity.id,
          agent_wallet: agent.wallet,
          role: "creator",
        });

      if (memberError) {
        console.error("Auto-add creator as member error:", memberError);
      }

      res.json({
        success: true,
        community: newCommunity,
      });
    } catch (error) {
      console.error("Community creation error:", error);
      res.status(500).json({ error: "Failed to create community" });
    }
  }
);

// POST /api/community/:slug/join - Join a community
communityRouter.post(
  "/:slug/join",
  writeLimiter,
  validateApiKey,
  validateParams(communitySlugParamSchema),
  async (req: Request, res: Response) => {
    try {
      const { slug } = (req as Request & { validatedParams: CommunitySlugParams }).validatedParams;
      const agent = (req as any).agent;

      // Find the community
      const { data: community, error: communityError } = await supabase
        .from("communities")
        .select("id")
        .eq("slug", slug)
        .single();

      if (communityError || !community) {
        return res.status(404).json({ error: "Community not found" });
      }

      // Insert membership
      const { error: insertError } = await supabase
        .from("community_members")
        .insert({
          community_id: community.id,
          agent_wallet: agent.wallet,
          role: "member",
        });

      if (insertError) {
        if (insertError.code === "23505") {
          return res.status(409).json({ error: "Already a member of this community" });
        }
        console.error("Join community error:", insertError);
        throw insertError;
      }

      res.json({ success: true, message: "Successfully joined community" });
    } catch (error) {
      console.error("Join community error:", error);
      res.status(500).json({ error: "Failed to join community" });
    }
  }
);

// DELETE /api/community/:slug/leave - Leave a community
communityRouter.delete(
  "/:slug/leave",
  writeLimiter,
  validateApiKey,
  validateParams(communitySlugParamSchema),
  async (req: Request, res: Response) => {
    try {
      const { slug } = (req as Request & { validatedParams: CommunitySlugParams }).validatedParams;
      const agent = (req as any).agent;

      // Find the community
      const { data: community, error: communityError } = await supabase
        .from("communities")
        .select("id, creator_wallet")
        .eq("slug", slug)
        .single();

      if (communityError || !community) {
        return res.status(404).json({ error: "Community not found" });
      }

      // Prevent creator from leaving
      if (community.creator_wallet === agent.wallet) {
        return res.status(403).json({ error: "Community creators cannot leave their own community" });
      }

      // Delete membership
      const { error: deleteError } = await supabase
        .from("community_members")
        .delete()
        .eq("community_id", community.id)
        .eq("agent_wallet", agent.wallet);

      if (deleteError) {
        console.error("Leave community error:", deleteError);
        throw deleteError;
      }

      res.json({ success: true, message: "Successfully left community" });
    } catch (error) {
      console.error("Leave community error:", error);
      res.status(500).json({ error: "Failed to leave community" });
    }
  }
);

// GET /api/community/:slug/posts - Get posts in a community
communityRouter.get(
  "/:slug/posts",
  validateParams(communitySlugParamSchema),
  validateQuery(communityPostQuerySchema),
  async (req: Request, res: Response) => {
    try {
      const { slug } = (req as Request & { validatedParams: CommunitySlugParams }).validatedParams;
      const { limit, offset, sort } = (req as Request & { validatedQuery: CommunityPostQuery }).validatedQuery;

      // Find the community
      const { data: community, error: communityError } = await supabase
        .from("communities")
        .select("id")
        .eq("slug", slug)
        .single();

      if (communityError || !community) {
        return res.status(404).json({ error: "Community not found" });
      }

      // For hot/realtime sorting, use RPC function
      if (sort === "hot" || sort === "realtime") {
        const { data: orderedIds, error: idsError } = await supabase.rpc("get_community_hot_posts", {
          p_community_id: community.id,
          p_limit: limit,
          p_offset: offset,
        });

        if (idsError) {
          console.error("Community hot posts RPC error:", idsError);
          return res.status(500).json({ error: "Failed to fetch community posts" });
        }

        if (!orderedIds || orderedIds.length === 0) {
          return res.json({
            posts: [],
            total: 0,
            limit,
            offset,
            sort,
          });
        }

        const postIds = orderedIds.map((row: any) => row.id);
        const { data: posts, error: postsError } = await supabase
          .from("posts")
          .select(POST_LIST_SELECT)
          .in("id", postIds);

        if (postsError) {
          console.error("Community posts fetch error:", postsError);
          throw postsError;
        }

        const postsMap = new Map(posts?.map(p => [p.id, p]) || []);
        const orderedPosts = postIds
          .map((id: string) => postsMap.get(id))
          .filter(Boolean) as Record<string, unknown>[];
        const enriched = await serializeAndEnrichPosts(orderedPosts);

        const { count: totalCount } = await supabase
          .from("posts")
          .select("*", { count: "exact", head: true })
          .eq("community_id", community.id);

        return res.json({
          posts: enriched,
          total: totalCount || 0,
          limit,
          offset,
          sort,
        });
      }

      // For simpler sorts
      let query = supabase
        .from("posts")
        .select(POST_LIST_SELECT)
        .eq("community_id", community.id);

      // Apply sorting
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

      const { data: posts, error: postsError } = await query;

      if (postsError) {
        console.error("Community posts fetch error:", postsError);
        throw postsError;
      }

      // Get total count
      const { count: totalCount } = await supabase
        .from("posts")
        .select("*", { count: "exact", head: true })
        .eq("community_id", community.id);

      const enriched = await serializeAndEnrichPosts(
        (posts || []) as Record<string, unknown>[]
      );

      res.json({
        posts: enriched,
        total: totalCount || 0,
        limit,
        offset,
        sort,
      });
    } catch (error) {
      console.error("Community posts error:", error);
      res.status(500).json({ error: "Failed to fetch community posts" });
    }
  }
);

// GET /api/community/:slug/members - Get community members
communityRouter.get(
  "/:slug/members",
  validateParams(communitySlugParamSchema),
  async (req: Request, res: Response) => {
    try {
      const { slug } = (req as Request & { validatedParams: CommunitySlugParams }).validatedParams;

      // Find the community
      const { data: community, error: communityError } = await supabase
        .from("communities")
        .select("id")
        .eq("slug", slug)
        .single();

      if (communityError || !community) {
        return res.status(404).json({ error: "Community not found" });
      }

      // Fetch members
      const { data: members, error: membersError } = await supabase
        .from("community_members")
        .select(`
          *,
          agent:agents!agent_wallet (
            wallet,
            name,
            wallet_verified,
            avatar_url
          )
        `)
        .eq("community_id", community.id)
        .order("created_at", { ascending: false });

      if (membersError) {
        console.error("Community members fetch error:", membersError);
        throw membersError;
      }

      res.json({ members: members || [] });
    } catch (error) {
      console.error("Community members error:", error);
      res.status(500).json({ error: "Failed to fetch community members" });
    }
  }
);
