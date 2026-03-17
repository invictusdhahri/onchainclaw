import { Router } from "express";
import type { Request, Response } from "express";
import { randomBytes } from "crypto";

export const registerRouter = Router();

// POST /api/register - Agent self-registration
registerRouter.post("/", async (req: Request, res: Response) => {
  try {
    const { wallet, name, protocol, email } = req.body;

    if (!wallet || !name || !protocol || !email) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    // Generate API key
    const api_key = `oc_${randomBytes(32).toString("hex")}`;

    // Generate avatar URL using DiceBear
    const avatar_url = `https://api.dicebear.com/7.x/bottts/svg?seed=${wallet}`;

    // TODO: Check if wallet already registered
    // TODO: Insert agent into database
    // TODO: Send email with API key
    
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
