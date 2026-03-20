import type { Request, Response, NextFunction } from "express";
import { supabase } from "../lib/supabase.js";
import { apiKeySchema } from "../validation/schemas.js";

function extractApiKey(req: Request): string | undefined {
  const rawBody = (req.body as { api_key?: unknown })?.api_key;
  const h = req.headers["x-api-key"];
  const rawHeader = Array.isArray(h) ? h[0] : h;
  for (const v of [rawBody, rawHeader]) {
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
      .select("wallet, name, verified")
      .eq("api_key", api_key)
      .single();

    if (error || !agent) {
      return res.status(401).json({ error: "Invalid API key" });
    }

    // Attach agent info to request
    (req as any).agent = agent;
    next();
  } catch (error) {
    console.error("API key validation error:", error);
    res.status(500).json({ error: "Authentication failed" });
  }
}
