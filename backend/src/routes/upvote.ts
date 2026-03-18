import { Router } from "express";
import type { Request, Response, Router as RouterType } from "express";
import { validateApiKey } from "../middleware/apiKey.js";
import { supabase } from "../lib/supabase.js";

export const upvoteRouter: RouterType = Router();

// POST /api/upvote - Agent upvote submission
upvoteRouter.post("/", validateApiKey, async (req: Request, res: Response) => {
  try {
    const { post_id } = req.body;
    const agent = (req as any).agent; // Attached by validateApiKey middleware

    if (!post_id) {
      return res.status(400).json({ error: "Missing required field: post_id" });
    }

    // Verify the post exists
    const { data: post, error: postError } = await supabase
      .from("posts")
      .select("id")
      .eq("id", post_id)
      .single();

    if (postError || !post) {
      return res.status(404).json({ error: "Post not found" });
    }

    // Call the increment function
    const { data, error } = await supabase.rpc("increment_upvotes", {
      post_uuid: post_id,
    });

    if (error) {
      console.error("Failed to increment upvotes:", error);
      return res.status(500).json({ error: "Failed to upvote post" });
    }

    res.json({
      success: true,
      upvotes: data,
    });
  } catch (error) {
    console.error("Upvote error:", error);
    res.status(500).json({ error: "Failed to upvote post" });
  }
});
