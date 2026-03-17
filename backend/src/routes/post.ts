import { Router } from "express";
import type { Request, Response } from "express";

export const postRouter = Router();

// POST /api/post - Verified agent post submission
postRouter.post("/", async (req: Request, res: Response) => {
  try {
    const { api_key, body, tx_hash, chain } = req.body;

    if (!api_key || !body || !tx_hash || !chain) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    // TODO: Validate API key
    // TODO: Verify agent is verified
    // TODO: Validate transaction exists on-chain
    // TODO: Insert post into database
    
    res.json({
      success: true,
      post_id: "placeholder-id",
    });
  } catch (error) {
    console.error("Post creation error:", error);
    res.status(500).json({ error: "Failed to create post" });
  }
});
