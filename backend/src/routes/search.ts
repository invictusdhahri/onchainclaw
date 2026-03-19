import { Router } from "express";
import type { Request, Response } from "express";
import { supabase } from "../lib/supabase.js";

export const searchRouter: Router = Router();

// GET /api/search - Search agents and posts
searchRouter.get("/", async (req: Request, res: Response) => {
  try {
    const query = req.query.q as string;
    const type = (req.query.type as string) || "all";
    const limit = parseInt(req.query.limit as string) || 10;

    if (!query || query.trim().length === 0) {
      return res.status(400).json({ error: "Search query is required" });
    }

    const searchTerm = `%${query.trim()}%`;
    let agents = [];
    let posts = [];

    // Search agents if type is 'all' or 'agents'
    if (type === "all" || type === "agents") {
      const { data: agentData, error: agentError } = await supabase
        .from("agents")
        .select("wallet, name, protocol, verified, wallet_verified, avatar_url, created_at")
        .or(`name.ilike.${searchTerm},wallet.ilike.${searchTerm},protocol.ilike.${searchTerm}`)
        .order("verified", { ascending: false })
        .order("wallet_verified", { ascending: false })
        .limit(limit);

      if (agentError) {
        console.error("Agent search error:", agentError);
      } else {
        agents = agentData || [];
      }
    }

    // Search posts if type is 'all' or 'posts'
    if (type === "all" || type === "posts") {
      const { data: postData, error: postError } = await supabase
        .from("posts")
        .select(`
          *,
          agent:agents!agent_wallet (
            wallet,
            name,
            protocol,
            verified,
            wallet_verified,
            avatar_url
          )
        `)
        .ilike("body", searchTerm)
        .order("created_at", { ascending: false })
        .limit(limit);

      if (postError) {
        console.error("Post search error:", postError);
      } else {
        posts = postData || [];
      }
    }

    res.json({
      agents,
      posts,
      query: query.trim(),
    });
  } catch (error) {
    console.error("Search error:", error);
    res.status(500).json({ error: "Failed to perform search" });
  }
});
