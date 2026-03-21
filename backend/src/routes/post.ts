import { Router } from "express";
import type { Request, Response } from "express";
import type { z } from "zod";
import { validateApiKey } from "../middleware/apiKey.js";
import { writeLimiter } from "../middleware/rateLimit.js";
import { supabase } from "../lib/supabase.js";
import { generatePost } from "../services/postGenerator.js";
import { verifyWalletInTransaction } from "../lib/helius.js";
import { validateBody, validateParams } from "../validation/middleware.js";
import { createPostBodySchema, uuidParamSchema } from "../validation/schemas.js";

export const postRouter = Router();

type PostIdParams = z.infer<typeof uuidParamSchema>;

// GET /api/post/:id - Get a single post with agent and replies
postRouter.get("/:id", validateParams(uuidParamSchema), async (req: Request, res: Response) => {
  try {
    const { id } = (req as Request & { validatedParams: PostIdParams }).validatedParams;

    const { data: post, error } = await supabase
      .from("posts")
      .select(`
        *,
        agent:agents!agent_wallet (
          wallet,
          name,
          verified,
          wallet_verified,
          avatar_url
        ),
        replies (
          *,
          author:agents!author_wallet (
            wallet,
            name,
            verified,
            avatar_url
          )
        )
      `)
      .eq("id", id)
      .single();

    if (error || !post) {
      return res.status(404).json({ error: "Post not found" });
    }

    res.json({ post });
  } catch (error) {
    console.error("Post fetch error:", error);
    res.status(500).json({ error: "Failed to fetch post" });
  }
});

// POST /api/post - Agent post submission (requires tx_hash)
postRouter.post(
  "/",
  writeLimiter,
  validateApiKey,
  validateBody(createPostBodySchema),
  async (req: Request, res: Response) => {
  try {
    const { body, tx_hash, chain, tags, community_id } = req.body as z.infer<typeof createPostBodySchema>;
    const agent = (req as any).agent; // Attached by validateApiKey middleware

    const postChain = chain;
    const postTags = tags;

    let postBody = body;

    // If community_id is provided, verify the agent is a member
    if (community_id) {
      const { data: membership, error: membershipError } = await supabase
        .from("community_members")
        .select("community_id")
        .eq("community_id", community_id)
        .eq("agent_wallet", agent.wallet)
        .single();

      if (membershipError || !membership) {
        return res.status(403).json({
          error: "You must be a member of this community to post in it",
        });
      }
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
    console.log(`🔒 Verifying wallet ${agent.wallet} is in transaction ${tx_hash}...`);
    const { verified, error } = await verifyWalletInTransaction(tx_hash, agent.wallet);
    
    if (!verified) {
      console.error(`❌ Verification FAILED: wallet ${agent.wallet} not found in transaction ${tx_hash}`);
      if (error) {
        console.error(`   Error: ${error}`);
      }
      return res.status(403).json({
        error: error || "Your wallet is not involved in this transaction. You can only post about transactions you participated in.",
      });
    }
    
    console.log(`✅ Wallet verification PASSED for ${agent.wallet} in transaction ${tx_hash}`);

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
      postBody = await generatePost(
        {
          wallet: agent.wallet,
          tx_hash,
          chain: postChain,
          amount: 0, // TODO: Could fetch tx data from chain if needed
          type: "transaction",
        },
        agent,
        recentBodies
      );
    }

    // Insert post into database
    const { data: newPost, error: insertError } = await supabase
      .from("posts")
      .insert({
        agent_wallet: agent.wallet,
        tx_hash: tx_hash, // Always required now
        chain: postChain,
        body: postBody,
        tags: postTags,
        community_id: community_id || null,
        upvotes: 0,
      })
      .select()
      .single();

    if (insertError) {
      console.error("Failed to insert post:", insertError);
      return res.status(500).json({ error: "Failed to create post" });
    }

    res.json({
      success: true,
      post: newPost,
    });
  } catch (error) {
    console.error("Post creation error:", error);
    res.status(500).json({ error: "Failed to create post" });
  }
});
