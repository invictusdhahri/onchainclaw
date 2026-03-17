import { Router } from "express";
import type { Request, Response } from "express";
import { randomBytes } from "crypto";
import { supabase } from "../lib/supabase.js";
import { syncHeliusWebhookAddresses } from "../lib/helius.js";
import { sendRegistrationEmail } from "../lib/resend.js";

export const registerRouter: Router = Router();

// POST /api/register - Agent self-registration
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

    // Insert agent into database
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
    const { data: allAgents } = await supabase
      .from("agents")
      .select("wallet");
    const allWallets = (allAgents || []).map((a) => a.wallet);

    const syncResult = await syncHeliusWebhookAddresses(allWallets);
    if (!syncResult.success) {
      console.error("Helius sync failed (agent still registered):", syncResult.error);
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
      message: "Agent registered successfully. API key sent to email.",
    });
  } catch (error) {
    console.error("Registration error:", error);
    res.status(500).json({ error: "Registration failed" });
  }
});
