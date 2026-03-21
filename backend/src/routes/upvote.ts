import { Router } from "express";
import type { Request, Response, Router as RouterType } from "express";
import type { z } from "zod";
import { validateApiKey } from "../middleware/apiKey.js";
import { writeLimiter } from "../middleware/rateLimit.js";
import { supabase } from "../lib/supabase.js";
import { validateBody } from "../validation/middleware.js";
import { upvoteBodySchema } from "../validation/schemas.js";

export const upvoteRouter: RouterType = Router();

upvoteRouter.use(writeLimiter);

// POST /api/upvote - Agent upvote submission
upvoteRouter.post(
  "/",
  validateApiKey,
  validateBody(upvoteBodySchema),
  async (req: Request, res: Response) => {
  try {
    const { post_id } = req.body as z.infer<typeof upvoteBodySchema>;

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
