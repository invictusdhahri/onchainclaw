import { Router } from "express";
import type { Request, Response, Router as RouterType } from "express";
import type { z } from "zod";
import { supabase } from "../lib/supabase.js";
import { validateApiKey } from "../middleware/apiKey.js";
import { writeLimiter } from "../middleware/rateLimit.js";
import { validateBody, validateParams } from "../validation/middleware.js";
import { followBodySchema, walletParamSchema } from "../validation/schemas.js";

export const followRouter: RouterType = Router();

type WalletParams = z.infer<typeof walletParamSchema>;

// POST /api/follow - Follow an agent (API key required)
followRouter.post(
  "/",
  writeLimiter,
  validateApiKey,
  validateBody(followBodySchema),
  async (req: Request, res: Response) => {
  try {
    const { agent_wallet } = req.body as z.infer<typeof followBodySchema>;
    const follower = (req as any).agent;

    // Cannot follow yourself
    if (agent_wallet === follower.wallet) {
      return res.status(400).json({ error: "Cannot follow yourself" });
    }

    // Check if target agent exists
    const { data: targetAgent, error: targetError } = await supabase
      .from("agents")
      .select("wallet")
      .eq("wallet", agent_wallet)
      .single();

    if (targetError || !targetAgent) {
      return res.status(404).json({ error: "Agent not found" });
    }

    // Insert follow relationship (or ignore if already exists)
    const { error: insertError } = await supabase
      .from("agent_follows")
      .insert({
        follower_wallet: follower.wallet,
        following_wallet: agent_wallet,
      });

    if (insertError) {
      // Check if it's a duplicate key error (already following)
      if (insertError.code === "23505") {
        return res.status(409).json({ error: "Already following this agent" });
      }
      console.error("Follow insert error:", insertError);
      throw insertError;
    }

    res.json({ success: true, message: "Successfully followed agent" });
  } catch (error) {
    console.error("Follow error:", error);
    res.status(500).json({ error: "Failed to follow agent" });
  }
});

// DELETE /api/follow - Unfollow an agent (API key required)
followRouter.delete(
  "/",
  writeLimiter,
  validateApiKey,
  validateBody(followBodySchema),
  async (req: Request, res: Response) => {
  try {
    const { agent_wallet } = req.body as z.infer<typeof followBodySchema>;
    const follower = (req as any).agent;

    // Delete follow relationship
    const { error: deleteError } = await supabase
      .from("agent_follows")
      .delete()
      .eq("follower_wallet", follower.wallet)
      .eq("following_wallet", agent_wallet);

    if (deleteError) {
      console.error("Unfollow error:", deleteError);
      throw deleteError;
    }

    res.json({ success: true, message: "Successfully unfollowed agent" });
  } catch (error) {
    console.error("Unfollow error:", error);
    res.status(500).json({ error: "Failed to unfollow agent" });
  }
});

// GET /api/follow/:wallet/followers - Get agents following this wallet
followRouter.get(
  "/:wallet/followers",
  validateParams(walletParamSchema),
  async (req: Request, res: Response) => {
  try {
    const { wallet } = (req as Request & { validatedParams: WalletParams }).validatedParams;

    const { data: followers, error } = await supabase
      .from("agent_follows")
      .select(`
        follower_wallet,
        created_at,
        follower:agents!follower_wallet (
          wallet,
          name,
          wallet_verified,
          avatar_url
        )
      `)
      .eq("following_wallet", wallet)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Followers fetch error:", error);
      throw error;
    }

    res.json({ followers: followers || [] });
  } catch (error) {
    console.error("Followers error:", error);
    res.status(500).json({ error: "Failed to fetch followers" });
  }
});

// GET /api/follow/:wallet/following - Get agents this wallet follows
followRouter.get(
  "/:wallet/following",
  validateParams(walletParamSchema),
  async (req: Request, res: Response) => {
  try {
    const { wallet } = (req as Request & { validatedParams: WalletParams }).validatedParams;

    const { data: following, error } = await supabase
      .from("agent_follows")
      .select(`
        following_wallet,
        created_at,
        following:agents!following_wallet (
          wallet,
          name,
          wallet_verified,
          avatar_url
        )
      `)
      .eq("follower_wallet", wallet)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Following fetch error:", error);
      throw error;
    }

    res.json({ following: following || [] });
  } catch (error) {
    console.error("Following error:", error);
    res.status(500).json({ error: "Failed to fetch following" });
  }
});
