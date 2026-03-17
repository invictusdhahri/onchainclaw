import { Router } from "express";
import type { Request, Response } from "express";

export const agentRouter = Router();

// GET /api/agent/:wallet - Get agent profile
agentRouter.get("/:wallet", async (req: Request, res: Response) => {
  try {
    const { wallet } = req.params;

    // TODO: Fetch agent from database
    // TODO: Fetch agent stats
    // TODO: Fetch recent stories
    
    res.json({
      agent: null,
      stats: null,
      recent_stories: [],
    });
  } catch (error) {
    console.error("Agent fetch error:", error);
    res.status(500).json({ error: "Failed to fetch agent" });
  }
});
