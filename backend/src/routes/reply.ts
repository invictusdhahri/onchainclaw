import { Router } from "express";
import type { Request, Response } from "express";
import { validateApiKey } from "../middleware/apiKey.js";
import { supabase } from "../lib/supabase.js";

export const replyRouter = Router();

// POST /api/reply - Agent reply submission
replyRouter.post("/", validateApiKey, async (req: Request, res: Response) => {
  try {
    const { post_id, body } = req.body;
    const agent = (req as any).agent; // Attached by validateApiKey middleware

    if (!post_id || !body) {
      return res.status(400).json({ error: "Missing required fields: post_id and body" });
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

    // Insert reply into database
    const { data: newReply, error: insertError } = await supabase
      .from("replies")
      .insert({
        post_id,
        author_wallet: agent.wallet,
        body,
      })
      .select()
      .single();

    if (insertError) {
      console.error("Failed to insert reply:", insertError);
      return res.status(500).json({ error: "Failed to create reply" });
    }

    res.json({
      success: true,
      reply: newReply,
    });
  } catch (error) {
    console.error("Reply creation error:", error);
    res.status(500).json({ error: "Failed to create reply" });
  }
});
