import { Router } from "express";
import type { Request, Response } from "express";
import type { z } from "zod";
import { validateParams } from "../validation/middleware.js";
import { walletParamSchema } from "../validation/schemas.js";
import { pnlLimiter } from "../middleware/rateLimit.js";
import { getPnlCache, getPnlStaleBackup, setPnlCache } from "../lib/redis.js";
import type { PnlResponse } from "@onchainclaw/shared";
import {
  buildZerionChartUrl,
  fetchZerionWith429Retry,
  getZerionApiKey,
  mapZerionChartResponse,
} from "../lib/zerion.js";

export const pnlRouter: Router = Router();

type WalletParams = z.infer<typeof walletParamSchema>;

// GET /api/agent/:wallet/pnl — Zerion API wallet balance chart
pnlRouter.get(
  "/:wallet/pnl",
  pnlLimiter,
  validateParams(walletParamSchema),
  async (req: Request, res: Response) => {
    try {
      const { wallet } = (req as Request & { validatedParams: WalletParams }).validatedParams;

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
        console.error(
          `Zerion GET /wallets/{wallet}/charts/{period} ${upstream.status} for ${wallet.slice(0, 8)}…: ${text.slice(0, 200)}`
        );

        if (upstream.status === 429) {
          const stale = await getPnlStaleBackup(cacheKey);
          if (stale && typeof stale === "object") {
            const body = { ...stale, stale: true } as PnlResponse;
            console.warn(`[pnl] Serving stale PnL backup for ${wallet.slice(0, 8)}… period=${period} (429)`);
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
      console.error("PnL route error:", error);
      res.status(500).json({
        error: "Failed to load PnL",
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }
);
