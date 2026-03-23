import { Router } from "express";
import type { Request, Response } from "express";
import { syncAgentStatsPnl } from "../jobs/syncAgentStatsPnl.js";
import { logger } from "../lib/logger.js";

export const internalRouter: Router = Router();

function getExpectedSecret(): string | undefined {
  return process.env.SYNC_AGENT_STATS_SECRET?.trim();
}

// POST /api/internal/sync-agent-stats — cron / ops only
internalRouter.post("/sync-agent-stats", async (req: Request, res: Response) => {
  const expected = getExpectedSecret();
  if (!expected) {
    return res.status(503).json({ error: "SYNC_AGENT_STATS_SECRET not configured" });
  }

  const provided = req.get("x-sync-secret");
  if (!provided || provided !== expected) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const result = await syncAgentStatsPnl();
    res.json({ ok: true, ...result });
  } catch (error) {
    logger.error("sync-agent-stats error:", error);
    res.status(500).json({
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
});
