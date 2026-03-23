import { Router } from "express";
import type { Request, Response } from "express";
import type { z } from "zod";
import { validateParams } from "../validation/middleware.js";
import { agentPublicIdParamSchema } from "../validation/schemas.js";
import { resolveAgentWalletFromPublicId } from "../lib/resolveAgentWalletFromPublicId.js";
import { pnlLimiter } from "../middleware/rateLimit.js";
import { getPnlCache, getPnlStaleBackup, setPnlCache } from "../lib/redis.js";
import type { PnlResponse } from "@onchainclaw/shared";
import { logger } from "../lib/logger.js";
import {
  buildZerionChartUrl,
  fetchZerionWith429Retry,
  getZerionApiKey,
  mapZerionChartResponse,
} from "../lib/zerion.js";

export const pnlRouter: Router = Router();

type PublicIdParams = z.infer<typeof agentPublicIdParamSchema>;

// GET /api/agent/:publicId/pnl — Zerion API wallet balance chart (publicId = wallet or name)
pnlRouter.get(
  "/:publicId/pnl",
  pnlLimiter,
  validateParams(agentPublicIdParamSchema),
  async (req: Request, res: Response) => {
    try {
      const { publicId } = (req as Request & { validatedParams: PublicIdParams }).validatedParams;

      const wallet = await resolveAgentWalletFromPublicId(publicId);
      if (!wallet) {
        return res.status(404).json({ error: "Agent not found" });
      }

      const periodParam = (req.query.period as string | undefined) ?? "5years";
      const validPeriods = ["hour", "day", "week", "month", "3months", "6months", "year", "5years", "max"];
      const period = validPeriods.includes(periodParam) ? periodParam : "5years";

      const cacheKey = `${wallet}:${period}`;
      const cached = await getPnlCache(cacheKey);
      if (cached) {
        return res.json(cached);
      }

      const apiKey = getZerionApiKey();
      if (!apiKey) {
        return res.status(500).json({
          error: "ZERION_API_KEY not configured",
          hint: "Add ZERION_API_KEY to backend .env (get one at https://dashboard.zerion.io/)",
        });
      }

      const chartUrl = buildZerionChartUrl(wallet, period);
      const upstream = await fetchZerionWith429Retry(chartUrl, apiKey);

      if (!upstream.ok) {
        const text = await upstream.text();
        logger.error(
          `Zerion GET /wallets/{wallet}/charts/{period} ${upstream.status} for ${wallet.slice(0, 8)}…: ${text.slice(0, 200)}`
        );

        if (upstream.status === 429) {
          const stale = await getPnlStaleBackup(cacheKey);
          if (stale && typeof stale === "object") {
            const body = { ...stale, stale: true } as PnlResponse;
            logger.warn(`[pnl] Serving stale PnL backup for ${wallet.slice(0, 8)}… period=${period} (429)`);
            return res.json(body);
          }
          const ra = upstream.headers.get("retry-after");
          const retryParsed = ra ? parseInt(ra, 10) : NaN;
          const retrySec = Number.isFinite(retryParsed) && retryParsed > 0 ? retryParsed : undefined;
          if (retrySec !== undefined) {
            res.setHeader("Retry-After", String(retrySec));
          }
          return res.status(429).json({
            error: "Zerion rate limit — try again shortly",
            status: 429,
            ...(retrySec !== undefined ? { retryAfterSeconds: retrySec } : {}),
          });
        }

        return res.status(upstream.status === 401 || upstream.status === 403 ? 502 : 503).json({
          error: "Zerion API unavailable",
          status: upstream.status,
        });
      }

      const body: unknown = await upstream.json();
      const response: PnlResponse = mapZerionChartResponse(body, period);

      await setPnlCache(cacheKey, response);
      res.json(response);
    } catch (error) {
      logger.error("PnL route error:", error);
      res.status(500).json({
        error: "Failed to load PnL",
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }
);
