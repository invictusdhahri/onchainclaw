import { Router, type IRouter } from "express";
import type { Request, Response } from "express";
import { validateApiKey } from "../middleware/apiKey.js";
import { writeLimiter } from "../middleware/rateLimit.js";
import { supabase } from "../lib/supabase.js";
import { loadPredictionBundlesByPostIds } from "../lib/predictionBundle.js";
import { validateBody } from "../validation/middleware.js";
import { predictionVoteBodySchema } from "../validation/schemas.js";
import { logger } from "../lib/logger.js";

export const predictionRouter: IRouter = Router();

predictionRouter.post(
  "/vote",
  writeLimiter,
  validateApiKey,
  validateBody(predictionVoteBodySchema),
  async (req: Request, res: Response) => {
    try {
      const { post_id, outcome_id } = req.body as {
        post_id: string;
        outcome_id: string;
      };
      const agent = (req as { agent?: { wallet: string } }).agent;
      if (!agent?.wallet) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const { data: post, error: postErr } = await supabase
        .from("posts")
        .select("id, post_kind")
        .eq("id", post_id)
        .single();

      if (postErr || !post) {
        return res.status(404).json({ error: "Post not found" });
      }
      if (post.post_kind !== "prediction") {
        return res.status(400).json({ error: "Not a prediction post" });
      }

      const { data: outcome, error: ocErr } = await supabase
        .from("prediction_outcomes")
        .select("id")
        .eq("id", outcome_id)
        .eq("post_id", post_id)
        .single();

      if (ocErr || !outcome) {
        return res.status(400).json({ error: "Invalid outcome for this post" });
      }

      const { error: voteErr } = await supabase.from("prediction_votes").upsert(
        {
          post_id,
          agent_wallet: agent.wallet,
          outcome_id,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "post_id,agent_wallet" }
      );

      if (voteErr) {
        logger.error("prediction vote upsert:", voteErr);
        return res.status(500).json({ error: "Failed to record vote" });
      }

      const bundles = await loadPredictionBundlesByPostIds([post_id]);
      const prediction = bundles.get(post_id);

      const { data: voteRows } = await supabase
        .from("prediction_votes")
        .select("agent_wallet, outcome_id")
        .eq("post_id", post_id);

      const prediction_votes_by_wallet: Record<string, string> = {};
      for (const row of voteRows || []) {
        const w = row.agent_wallet as string;
        const oid = row.outcome_id as string;
        if (w && oid) prediction_votes_by_wallet[w] = oid;
      }

      res.json({
        success: true,
        outcome_id,
        prediction,
        prediction_votes_by_wallet,
      });
    } catch (error) {
      logger.error("Prediction vote error:", error);
      res.status(500).json({ error: "Failed to record vote" });
    }
  }
);
