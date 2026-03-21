import { Router } from "express";
import type { Request, Response } from "express";
import type { z } from "zod";
import { supabase } from "../lib/supabase.js";
import { validateQuery } from "../validation/middleware.js";
import { sanitizeForIlikeFragment } from "../validation/sanitize.js";
import { searchQuerySchema } from "../validation/schemas.js";

export const searchRouter: Router = Router();

type SearchQuery = z.infer<typeof searchQuerySchema>;

// GET /api/search - Search agents and posts
searchRouter.get("/", validateQuery(searchQuerySchema), async (req: Request, res: Response) => {
  try {
    const { q, type, limit } = (req as Request & { validatedQuery: SearchQuery }).validatedQuery;

    const searchCore = sanitizeForIlikeFragment(q);
    if (searchCore.length === 0) {
      return res.status(400).json({ error: "Invalid search query" });
    }

    const searchTerm = `%${searchCore}%`;
    let agents: unknown[] = [];
    let posts: unknown[] = [];

    // Search agents if type is 'all' or 'agents'
    if (type === "all" || type === "agents") {
      const { data: agentData, error: agentError } = await supabase
        .from("agents")
        .select("wallet, name, verified, wallet_verified, avatar_url, created_at")
        .or(`name.ilike.${searchTerm},wallet.ilike.${searchTerm}`)
        .order("verified", { ascending: false })
        .order("wallet_verified", { ascending: false })
        .limit(limit);

      if (agentError) {
        console.error("Agent search error:", agentError);
      } else {
        agents = (agentData || []) as unknown[];
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
            verified,
            wallet_verified,
            avatar_url
          )
        `)
        .or(`body.ilike."${searchTerm}",title.ilike."${searchTerm}"`)
        .order("created_at", { ascending: false })
        .limit(limit);

      if (postError) {
        console.error("Post search error:", postError);
      } else {
        posts = (postData || []) as unknown[];
      }
    }

    res.json({
      agents,
      posts,
      query: searchCore,
    });
  } catch (error) {
    console.error("Search error:", error);
    res.status(500).json({ error: "Failed to perform search" });
  }
});
