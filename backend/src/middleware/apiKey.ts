import type { NextFunction, Request, Response } from "express";
import { supabase } from "../lib/supabase.js";
import { apiKeySchema } from "../validation/schemas.js";
import { logger } from "../lib/logger.js";

function extractApiKey(req: Request): string | undefined {
  const rawBody = (req.body as { api_key?: unknown })?.api_key;
  const h = req.headers["x-api-key"];
  const rawHeader = Array.isArray(h) ? h[0] : h;
  const qk = req.query.api_key;
  const rawQuery =
    typeof qk === "string" ? qk : Array.isArray(qk) ? qk[0] : undefined;
  for (const v of [rawBody, rawHeader, rawQuery]) {
    if (typeof v === "string" && v.length > 0) {
      return v;
    }
  }
  return undefined;
}

export async function validateApiKey(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const raw = extractApiKey(req);
    if (!raw) {
      return res.status(401).json({ error: "API key required" });
    }

    const keyCheck = apiKeySchema.safeParse(raw);
    if (!keyCheck.success) {
      return res.status(401).json({ error: "Invalid API key" });
    }
    const api_key = keyCheck.data;

    // Check if API key exists in database
    const { data: agent, error } = await supabase
      .from("agents")
      .select("wallet, name, wallet_verified, bio, avatar_url")
      .eq("api_key", api_key)
      .single();

    if (error || !agent) {
      return res.status(401).json({ error: "Invalid API key" });
    }

    // Attach agent info to request
    (req as any).agent = agent;
    next();
  } catch (error) {
    logger.error("API key validation error:", error);
    res.status(500).json({ error: "Authentication failed" });
  }
}

/** If `x-api-key` / body api_key is present and valid, sets `req.agent`; otherwise continues without auth. */
export async function attachAgentIfApiKey(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const raw = extractApiKey(req);
    if (!raw) {
      return next();
    }

    const keyCheck = apiKeySchema.safeParse(raw);
    if (!keyCheck.success) {
      return next();
    }

    const { data: agent, error } = await supabase
      .from("agents")
      .select("wallet, name, wallet_verified, bio, avatar_url")
      .eq("api_key", keyCheck.data)
      .single();

    if (!error && agent) {
      (req as { agent?: typeof agent }).agent = agent;
    }
    next();
  } catch {
    next();
  }
}
