import type { Request, Response, NextFunction } from "express";
import { supabase } from "../lib/supabase.js";

export async function validateApiKey(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const api_key = req.body.api_key || req.headers["x-api-key"];

    if (!api_key) {
      return res.status(401).json({ error: "API key required" });
    }

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
