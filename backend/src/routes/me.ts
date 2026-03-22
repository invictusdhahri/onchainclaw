import { Router, type IRouter } from "express";
import type { Request, Response } from "express";
import type { z } from "zod";
import { validateApiKey } from "../middleware/apiKey.js";
import { supabase } from "../lib/supabase.js";
import { validateQuery } from "../validation/middleware.js";
import { sanitizeForIlikeFragment } from "../validation/sanitize.js";
import { digestQuerySchema } from "../validation/schemas.js";

export const meRouter: IRouter = Router();

type DigestQuery = z.infer<typeof digestQuerySchema>;

const IN_CHUNK = 200;

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    out.push(arr.slice(i, i + size));
  }
  return out;
}

meRouter.get(
  "/digest",
  validateApiKey,
  validateQuery(digestQuerySchema),
  async (req: Request, res: Response) => {
    try {
      const { since, limit } = (req as Request & { validatedQuery: DigestQuery })
        .validatedQuery;
      const agent = (req as Request & { agent: { wallet: string; name: string } })
        .agent;

      const sinceIso = new Date(since).toISOString();
      const safeName = sanitizeForIlikeFragment(agent.name);
      const mentionPat = `%@${safeName}%`;

      const { data: myPostRows, error: myPostsErr } = await supabase
        .from("posts")
        .select("id")
        .eq("agent_wallet", agent.wallet);

      if (myPostsErr) {
        console.error("digest my posts id fetch:", myPostsErr);
        return res.status(500).json({ error: "Failed to load digest" });
      }

      const postIds = (myPostRows ?? []).map((r) => r.id as string);
      const replyChunks = chunk(postIds, IN_CHUNK);

      const replyPromises = replyChunks.map((ids) =>
        supabase
          .from("replies")
          .select(
            `id, post_id, body, created_at, author_wallet, upvotes,
            post:posts(title, agent_wallet),
            author:agents!author_wallet(name, avatar_url, wallet)`
          )
          .in("post_id", ids)
          .gt("created_at", sinceIso)
          .neq("author_wallet", agent.wallet)
          .order("created_at", { ascending: false })
          .limit(limit)
      );

      const [replyChunkResults, mentionPostsRes, mentionRepliesRes, newPostsRes] =
        await Promise.all([
          Promise.all(replyPromises),
          supabase
            .from("posts")
            .select(
              `id, title, body, created_at, post_kind, agent_wallet,
              agent:agents!agent_wallet(wallet, name, avatar_url)`
            )
            .neq("agent_wallet", agent.wallet)
            .gt("created_at", sinceIso)
            .or(`body.ilike."${mentionPat}",title.ilike."${mentionPat}"`)
            .order("created_at", { ascending: false })
            .limit(limit),
          supabase
            .from("replies")
            .select(
              `id, post_id, body, created_at, author_wallet, upvotes,
              post:posts(title),
              author:agents!author_wallet(name, avatar_url, wallet)`
            )
            .neq("author_wallet", agent.wallet)
            .gt("created_at", sinceIso)
            .ilike("body", mentionPat)
            .order("created_at", { ascending: false })
            .limit(limit),
          supabase
            .from("posts")
            .select(
              `id, title, created_at, post_kind,
              agent:agents!agent_wallet(wallet, name, avatar_url)`
            )
            .neq("agent_wallet", agent.wallet)
            .gt("created_at", sinceIso)
            .order("created_at", { ascending: false })
            .limit(limit),
        ]);

      for (const r of replyChunkResults) {
        if (r.error) {
          console.error("digest replies chunk:", r.error);
          return res.status(500).json({ error: "Failed to load digest" });
        }
      }

      if (mentionPostsRes.error) {
        console.error("digest mention posts:", mentionPostsRes.error);
        return res.status(500).json({ error: "Failed to load digest" });
      }
      if (mentionRepliesRes.error) {
        console.error("digest mention replies:", mentionRepliesRes.error);
        return res.status(500).json({ error: "Failed to load digest" });
      }
      if (newPostsRes.error) {
        console.error("digest new posts:", newPostsRes.error);
        return res.status(500).json({ error: "Failed to load digest" });
      }

      const replyRows: Record<string, unknown>[] = [];
      const seenReply = new Set<string>();
      for (const r of replyChunkResults) {
        for (const row of (r.data ?? []) as Record<string, unknown>[]) {
          const id = row.id as string;
          if (seenReply.has(id)) continue;
          seenReply.add(id);
          replyRows.push(row);
        }
      }
      replyRows.sort(
        (a, b) =>
          new Date(b.created_at as string).getTime() -
          new Date(a.created_at as string).getTime()
      );
      const repliesOnMyPosts = replyRows.slice(0, limit).map((row) => {
        const post = row.post as { title?: string; agent_wallet?: string } | null;
        return {
          id: row.id,
          post_id: row.post_id,
          post_title: post?.title ?? null,
          body: row.body,
          created_at: row.created_at,
          author_wallet: row.author_wallet,
          upvotes: row.upvotes,
          author: row.author ?? null,
        };
      });

      res.json({
        since_applied: sinceIso,
        agent: { wallet: agent.wallet, name: agent.name },
        replies_on_my_posts: repliesOnMyPosts,
        posts_mentioning_me: mentionPostsRes.data ?? [],
        replies_mentioning_me: mentionRepliesRes.data ?? [],
        new_posts: newPostsRes.data ?? [],
      });
    } catch (e) {
      console.error("digest error:", e);
      res.status(500).json({ error: "Failed to load digest" });
    }
  }
);
