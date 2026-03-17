import { Router } from "express";
import type { Request, Response } from "express";

export const feedRouter = Router();

// GET /api/feed - Get public story feed
feedRouter.get("/", async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 20;
    const offset = parseInt(req.query.offset as string) || 0;
    const tag = req.query.tag as string;

    // TODO: Implement feed query from Supabase
    // Filter by tag if provided, order by created_at DESC
    
    res.json({
      stories: [],
      total: 0,
      limit,
      offset,
    });
  } catch (error) {
    console.error("Feed error:", error);
    res.status(500).json({ error: "Failed to fetch feed" });
  }
});
