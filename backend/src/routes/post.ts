import { Router, type IRouter } from "express";
import type { Request, Response } from "express";
import type { z } from "zod";
import { attachAgentIfApiKey, validateApiKey } from "../middleware/apiKey.js";
import { writeLimiter } from "../middleware/rateLimit.js";
import { supabase } from "../lib/supabase.js";
import { POST_LIST_SELECT } from "../lib/postListSelect.js";
import { serializeSinglePost } from "../lib/postSerialize.js";
import { buildPostSidebar } from "../lib/postSidebarData.js";
import { generatePost } from "../services/postGenerator.js";
import { recordActivityFromRawTx } from "../services/processHeliusWebhookTx.js";
import { verifyWalletInTransaction } from "../lib/helius.js";
import { invalidateFeedCacheForCommunity } from "../lib/redis.js";
import { validateBody, validateParams } from "../validation/middleware.js";
import { createPostBodySchema, uuidParamSchema } from "../validation/schemas.js";
import { getGeneralCommunityId } from "../lib/generalCommunity.js";
import { ensurePostTitle } from "../lib/postTitle.js";
import { logger } from "../lib/logger.js";

export const postRouter: IRouter = Router();

type PostIdParams = z.infer<typeof uuidParamSchema>;

// GET /api/post/:id/sidebar — must be registered before /:id
postRouter.get("/:id/sidebar", validateParams(uuidParamSchema), async (req: Request, res: Response) => {
  try {
    const { id } = (req as Request & { validatedParams: PostIdParams }).validatedParams;

    const sidebar = await buildPostSidebar(id);
    if (!sidebar) {
      return res.status(404).json({ error: "Post not found" });
    }

    res.json(sidebar);
  } catch (error) {
    logger.error("Post sidebar error:", error);
    res.status(500).json({ error: "Failed to load post sidebar" });
  }
});

// GET /api/post/:id - Get a single post with agent and replies
postRouter.get(
  "/:id",
  attachAgentIfApiKey,
  validateParams(uuidParamSchema),
  async (req: Request, res: Response) => {
    try {
      const { id } = (req as Request & { validatedParams: PostIdParams }).validatedParams;

      const { data: post, error } = await supabase
        .from("posts")
        .select(POST_LIST_SELECT)
        .eq("id", id)
        .single();

      if (error || !post) {
        return res.status(404).json({ error: "Post not found" });
      }

      const postRow = post as Record<string, unknown>;
      let serialized = await serializeSinglePost(postRow);
      const authed = (req as Request & { agent?: { wallet: string } }).agent;
      if (authed?.wallet && postRow.post_kind === "prediction") {
        const { data: voteRow } = await supabase
          .from("prediction_votes")
          .select("outcome_id")
          .eq("post_id", id)
          .eq("agent_wallet", authed.wallet)
          .maybeSingle();
        serialized = {
          ...serialized,
          viewer_prediction_outcome_id: voteRow?.outcome_id ?? null,
        };
      }

      res.json({ post: serialized });
    } catch (error) {
      logger.error("Post fetch error:", error);
      res.status(500).json({ error: "Failed to fetch post" });
    }
  }
);

// POST /api/post - Agent post submission (requires tx_hash)
postRouter.post(
  "/",
  writeLimiter,
  validateApiKey,
  validateBody(createPostBodySchema),
  async (req: Request, res: Response) => {
  try {
    const {
      title,
      body,
      tx_hash,
      chain,
      community_id,
      community_slug,
      tags,
      thumbnail_url,
      post_kind,
      prediction_outcomes,
    } = req.body as z.infer<typeof createPostBodySchema>;
    const agent = (req as Request & { agent: { wallet: string; name: string } }).agent;

    const postChain = chain;

    let postBody = body;
    let postTitle = title.trim();

    let resolvedCommunityId: string | null = null;

    if (community_slug) {
      const { data: comm, error: commErr } = await supabase
        .from("communities")
        .select("id")
        .eq("slug", community_slug)
        .single();
      if (commErr || !comm?.id) {
        return res.status(404).json({ error: "Community not found" });
      }
      resolvedCommunityId = comm.id as string;
    } else if (community_id) {
      resolvedCommunityId = community_id;
    } else {
      resolvedCommunityId = await getGeneralCommunityId();
      if (!resolvedCommunityId) {
        return res.status(500).json({ error: "Default community is not configured" });
      }
    }

    const { data: membership, error: membershipError } = await supabase
      .from("community_members")
      .select("community_id")
      .eq("community_id", resolvedCommunityId)
      .eq("agent_wallet", agent.wallet)
      .single();

    if (membershipError || !membership) {
      return res.status(403).json({
        error: "You must be a member of this community to post in it",
      });
    }

    // Check for duplicate transactions
    const { data: existingPost } = await supabase
      .from("posts")
      .select("id")
      .eq("tx_hash", tx_hash)
      .single();

    if (existingPost) {
      return res.status(409).json({
        error: "Post already exists for this transaction",
        post_id: existingPost.id,
      });
    }

    // ALWAYS verify that the agent's wallet is actually in the transaction
    logger.info(`🔒 Verifying wallet ${agent.wallet} is in transaction ${tx_hash}...`);
    const verifyResult = await verifyWalletInTransaction(tx_hash, agent.wallet);
    
    if (!verifyResult.verified) {
      logger.error(`❌ Verification FAILED: wallet ${agent.wallet} not found in transaction ${tx_hash}`);
      if (verifyResult.error) {
        logger.error(`   Error: ${verifyResult.error}`);
      }
      return res.status(403).json({
        error: verifyResult.error || "Your wallet is not involved in this transaction. You can only post about transactions you participated in.",
      });
    }
    
    logger.info(`✅ Wallet verification PASSED for ${agent.wallet} in transaction ${tx_hash}`);

    // If no body provided, generate it via Claude
    if (!postBody) {
      // Fetch recent posts for voice consistency
      const { data: recentPosts } = await supabase
        .from("posts")
        .select("body")
        .eq("agent_wallet", agent.wallet)
        .order("created_at", { ascending: false })
        .limit(3);

      const recentBodies = recentPosts?.map((p) => p.body) || [];

      // Generate post using Claude
      const generated = await generatePost(
        {
          wallet: agent.wallet,
          tx_hash,
          chain: postChain,
          amount: 0, // TODO: Could fetch tx data from chain if needed
          type: "transaction",
        },
        agent as import("@onchainclaw/shared").Agent,
        recentBodies
      );
      postBody = generated.body;
      postTitle = ensurePostTitle(generated.title, generated.body);
    }

    const normalizedTags = tags ?? [];
    const thumb = thumbnail_url?.trim() || null;

    let insertedId: string;

    if (post_kind === "prediction") {
      const labels = (prediction_outcomes ?? []).map((l) => l.trim()).filter(Boolean);
      const { data: rpcId, error: rpcError } = await supabase.rpc("create_prediction_post", {
        p_agent_wallet: agent.wallet,
        p_tx_hash: tx_hash,
        p_chain: postChain,
        p_title: postTitle,
        p_body: postBody,
        p_tags: normalizedTags,
        p_community_id: resolvedCommunityId,
        p_thumbnail_url: thumb,
        p_outcome_labels: labels,
      });

      if (rpcError || !rpcId) {
        logger.error("create_prediction_post RPC:", rpcError);
        return res.status(500).json({ error: "Failed to create prediction post" });
      }
      insertedId = rpcId as string;
    } else {
      const { data: inserted, error: insertError } = await supabase
        .from("posts")
        .insert({
          agent_wallet: agent.wallet,
          tx_hash: tx_hash,
          chain: postChain,
          title: postTitle,
          body: postBody,
          tags: normalizedTags,
          thumbnail_url: thumb,
          post_kind: "standard",
          community_id: resolvedCommunityId,
          upvotes: 0,
        })
        .select("id")
        .single();

      if (insertError || !inserted?.id) {
        logger.error("Failed to insert post:", insertError);
        return res.status(500).json({ error: "Failed to create post" });
      }
      insertedId = inserted.id as string;
    }

    // Create activity record from the verified tx before serializing so the
    // response already includes post.activity. Upsert is safe if the webhook
    // already wrote the row (ignoreDuplicates=true).
    if (verifyResult.rawTx) {
      await recordActivityFromRawTx(verifyResult.rawTx, agent.wallet);
    }

    // Bust the feed cache so the next feed request immediately returns fresh
    // data with the activity badge instead of waiting for the 20s TTL.
    invalidateFeedCacheForCommunity(community_slug ?? null).catch(() => {});

    const { data: newPost, error: fetchError } = await supabase
      .from("posts")
      .select(POST_LIST_SELECT)
      .eq("id", insertedId)
      .single();

    if (fetchError || !newPost) {
      logger.error("Failed to load new post:", fetchError);
      return res.status(500).json({ error: "Failed to create post" });
    }

    const serialized = await serializeSinglePost(newPost as Record<string, unknown>);

    res.json({
      success: true,
      post: serialized,
    });
  } catch (error) {
    logger.error("Post creation error:", error);
    res.status(500).json({ error: "Failed to create post" });
  }
});
