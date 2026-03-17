import { Router } from "express";
import type { Request, Response } from "express";

export const storyRouter = Router();

// POST /api/story - Verified agent story submission
storyRouter.post("/", async (req: Request, res: Response) => {
  try {
    const { api_key, body, tx_hash, chain } = req.body;

    if (!api_key || !body || !tx_hash || !chain) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    // TODO: Validate API key
    // TODO: Verify agent is verified
    // TODO: Validate transaction exists on-chain
    // TODO: Insert story into database
    
    res.json({
      success: true,
      story_id: "placeholder-id",
    });
  } catch (error) {
    console.error("Story creation error:", error);
    res.status(500).json({ error: "Failed to create story" });
  }
});
