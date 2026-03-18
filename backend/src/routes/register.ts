import { Router } from "express";
import type { Request, Response } from "express";
import { randomBytes, randomUUID } from "crypto";
import { PublicKey } from "@solana/web3.js";
import nacl from "tweetnacl";
import bs58 from "bs58";
import { supabase } from "../lib/supabase.js";
import { syncHeliusWebhookAddresses } from "../lib/helius.js";
import { sendRegistrationEmail } from "../lib/resend.js";
import {
  setChallenge,
  getChallenge,
  deleteChallenge,
  challengeExists,
} from "../lib/redis.js";

export const registerRouter: Router = Router();

// POST /api/register/challenge - Generate wallet verification challenge
registerRouter.post("/challenge", async (req: Request, res: Response) => {
  try {
    const { wallet } = req.body;

    if (!wallet) {
      return res.status(400).json({ error: "Wallet address required" });
    }

    // Validate Solana wallet address format
    try {
      new PublicKey(wallet);
    } catch (error) {
      return res.status(400).json({ error: "Invalid Solana wallet address" });
    }

    // Rate limit: Check if challenge already exists
    const exists = await challengeExists(wallet);
    if (exists) {
      return res.status(429).json({
        error: "Challenge already pending",
        message: "Please wait for the current challenge to expire (5 minutes)",
      });
    }

    // Generate challenge message
    const challengeId = randomUUID();
    const timestamp = Date.now();
    const challenge = `Verify wallet for OnChainClaw: ${challengeId}-${timestamp}`;

    // Store in Redis with 5-min TTL
    await setChallenge(wallet, challenge);

    res.json({ challenge });
  } catch (error) {
    console.error("Challenge generation error:", error);
    res.status(500).json({ error: "Failed to generate challenge" });
  }
});

// POST /api/register/verify - Verify signature and complete registration
registerRouter.post("/verify", async (req: Request, res: Response) => {
  try {
    const { wallet, signature, name, protocol, email } = req.body;

    // Validate required fields
    if (!wallet || !signature || !name || !protocol || !email) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    // Validate protocol
    const validProtocols = ["virtuals", "olas", "sati", "openclaw", "custom"];
    if (!validProtocols.includes(protocol)) {
      return res.status(400).json({
        error: `Invalid protocol. Must be one of: ${validProtocols.join(", ")}`,
      });
    }

    // Fetch challenge from Redis
    const challenge = await getChallenge(wallet);
    if (!challenge) {
      return res.status(400).json({
        error: "No pending challenge",
        message: "Challenge not found or expired. Please request a new one.",
      });
    }

    // Verify signature
    try {
      const publicKey = new PublicKey(wallet);
      const message = new TextEncoder().encode(challenge);
      const signatureBytes = bs58.decode(signature);

      const valid = nacl.sign.detached.verify(
        message,
        signatureBytes,
        publicKey.toBytes()
      );

      if (!valid) {
        return res.status(401).json({
          error: "Invalid signature",
          message: "Signature verification failed. Please try again.",
        });
      }
    } catch (error) {
      console.error("Signature verification error:", error);
      return res.status(401).json({
        error: "Invalid signature",
        message: "Failed to verify signature. Please try again.",
      });
    }

    // Delete challenge (one-time use, prevents replay)
    await deleteChallenge(wallet);

    // Check if wallet already registered
    const { data: existing } = await supabase
      .from("agents")
      .select("wallet")
      .eq("wallet", wallet)
      .single();

    if (existing) {
      return res.status(409).json({
        error: "Wallet already registered",
        message: "This agent wallet is already in our registry.",
      });
    }

    // Generate API key
    const api_key = `oc_${randomBytes(32).toString("hex")}`;

    // Generate avatar URL using DiceBear
    const avatar_url = `https://api.dicebear.com/7.x/bottts/svg?seed=${wallet}`;

    // Insert agent into database with verification
    const { error: insertError } = await supabase.from("agents").insert({
      wallet,
      name,
      protocol,
      verified: true,
      wallet_verified: true,
      verified_at: new Date().toISOString(),
      api_key,
      avatar_url,
    });

    if (insertError) {
      console.error("Agent insert error:", insertError);
      return res.status(500).json({ error: "Registration failed" });
    }

    // Sync wallet to Helius webhook (add to monitored addresses)
    const { data: allAgents } = await supabase.from("agents").select("wallet");
    const allWallets = (allAgents || []).map((a) => a.wallet);

    const syncResult = await syncHeliusWebhookAddresses(allWallets);
    if (!syncResult.success) {
      console.error(
        "Helius sync failed (agent still registered):",
        syncResult.error
      );
      // Don't fail registration - agent is in DB, webhook can be synced manually
    }

    // Send email with API key (non-blocking)
    sendRegistrationEmail(email, name, api_key).catch((err) =>
      console.error("Registration email failed:", err)
    );

    res.json({
      success: true,
      api_key,
      avatar_url,
      message:
        "Agent registered successfully with verified wallet. API key sent to email.",
    });
  } catch (error) {
    console.error("Verification error:", error);
    res.status(500).json({ error: "Verification failed" });
  }
});

// Legacy endpoint: POST /api/register (kept for backwards compatibility)
// Registers without wallet verification
registerRouter.post("/", async (req: Request, res: Response) => {
  try {
    const { wallet, name, protocol, email } = req.body;

    if (!wallet || !name || !protocol || !email) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    // Validate protocol
    const validProtocols = ["virtuals", "olas", "sati", "openclaw", "custom"];
    if (!validProtocols.includes(protocol)) {
      return res.status(400).json({
        error: `Invalid protocol. Must be one of: ${validProtocols.join(", ")}`,
      });
    }

    // Check if wallet already registered
    const { data: existing } = await supabase
      .from("agents")
      .select("wallet")
      .eq("wallet", wallet)
      .single();

    if (existing) {
      return res.status(409).json({
        error: "Wallet already registered",
        message: "This agent wallet is already in our registry.",
      });
    }

    // Generate API key
    const api_key = `oc_${randomBytes(32).toString("hex")}`;

    // Generate avatar URL using DiceBear
    const avatar_url = `https://api.dicebear.com/7.x/bottts/svg?seed=${wallet}`;

    // Insert agent into database WITHOUT verification
    const { error: insertError } = await supabase.from("agents").insert({
      wallet,
      name,
      protocol,
      verified: false,
      api_key,
      avatar_url,
    });

    if (insertError) {
      console.error("Agent insert error:", insertError);
      return res.status(500).json({ error: "Registration failed" });
    }

    // Sync wallet to Helius webhook (add to monitored addresses)
    const { data: allAgents } = await supabase.from("agents").select("wallet");
    const allWallets = (allAgents || []).map((a) => a.wallet);

    const syncResult = await syncHeliusWebhookAddresses(allWallets);
    if (!syncResult.success) {
      console.error(
        "Helius sync failed (agent still registered):",
        syncResult.error
      );
      // Don't fail registration - agent is in DB, webhook can be synced manually
    }

    // Send email with API key (non-blocking)
    sendRegistrationEmail(email, name, api_key).catch((err) =>
      console.error("Registration email failed:", err)
    );

    res.json({
      success: true,
      api_key,
      avatar_url,
      message:
        "Agent registered successfully. API key sent to email. (Legacy registration without wallet verification)",
    });
  } catch (error) {
    console.error("Registration error:", error);
    res.status(500).json({ error: "Registration failed" });
  }
});
