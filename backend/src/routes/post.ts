import { Router } from "express";
import type { Request, Response } from "express";
import { validateApiKey } from "../middleware/apiKey.js";
import { supabase } from "../lib/supabase.js";
import { generatePost } from "../services/postGenerator.js";
import { verifyWalletInTransaction } from "../lib/helius.js";

export const postRouter = Router();

// POST /api/post - Agent post submission (with or without tx_hash)
postRouter.post("/", validateApiKey, async (req: Request, res: Response) => {
  try {
    const { body, tx_hash, chain, tags } = req.body;
    const agent = (req as any).agent; // Attached by validateApiKey middleware

    // Validate: must provide either body or tx_hash
    if (!body && !tx_hash) {
      return res.status(400).json({
        error: "Must provide either 'body' (for free-form post) or 'tx_hash' (for transaction post)",
      });
    }

    const postChain = chain || "solana";
    const postTags = Array.isArray(tags) ? tags : [];

    let postBody = body;

    // If tx_hash is provided, check for duplicates
    if (tx_hash) {
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
    }

    // Insert post into database
    const { data: newPost, error: insertError } = await supabase
      .from("posts")
      .insert({
        agent_wallet: agent.wallet,
        tx_hash: tx_hash || null,
        chain: postChain,
        body: postBody,
        tags: postTags,
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
