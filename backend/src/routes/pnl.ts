import { Router } from "express";
import type { Request, Response } from "express";
import type { z } from "zod";
import { validateParams } from "../validation/middleware.js";
import { walletParamSchema } from "../validation/schemas.js";
import { getPnlCache, getPnlStaleBackup, setPnlCache } from "../lib/redis.js";
import type { PnlResponse, ZerionChartPoint } from "@onchainclaw/shared";

/** @see https://developers.zerion.io/reference/getwalletchart */
const ZERION_API_BASE = "https://api.zerion.io/v1";

function getZerionApiKey(): string | undefined {
  return process.env.ZERION_API_KEY?.trim();
}

export const pnlRouter: Router = Router();

type WalletParams = z.infer<typeof walletParamSchema>;

function num(v: unknown, fallback = 0): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

type FetchResponse = Awaited<ReturnType<typeof fetch>>;

/**
 * Fetch from Zerion API with Basic Auth.
 * @see https://developers.zerion.io/reference/authentication
 */
async function zerionFetch(url: string, apiKey: string): Promise<FetchResponse> {
  const authHeader = `Basic ${Buffer.from(`${apiKey}:`).toString("base64")}`;
  return fetch(url, {
    method: "GET",
    headers: {
      Accept: "application/json",
      Authorization: authHeader,
    },
  });
}

/** Retry on 429 with backoff */
async function fetchWith429Retry(url: string, apiKey: string): Promise<FetchResponse> {
  let res = await zerionFetch(url, apiKey);
  const backoffMs = [2000, 5000];
  for (let i = 0; i < backoffMs.length && res.status === 429; i++) {
    console.warn(`[pnl] 429 from Zerion, retry after ${backoffMs[i]}ms → ${url.split("?")[0]}`);
    await sleep(backoffMs[i]);
    res = await zerionFetch(url, apiKey);
  }
  return res;
}

/**
 * Build Zerion wallet chart URL.
 * Chart periods: hour, day, week, month, year, max
 * @see https://developers.zerion.io/reference/getwalletchart
 */
function buildZerionChartUrl(wallet: string, period: string): string {
  return `${ZERION_API_BASE}/wallets/${encodeURIComponent(wallet)}/charts/${period}`;
}

/**
 * Parse Zerion chart response (JSON:API format).
 * Expected structure:
 * {
 *   data: {
 *     type: "wallet_charts",
 *     id: "...",
 *     attributes: {
 *       begin_at: "ISO timestamp",
 *       end_at: "ISO timestamp",
 *       stats: { first, min, avg, max, last },
 *       points: [[unix_seconds, value_usd], ...]
 *     }
 *   }
 * }
 */
function mapZerionChartResponse(raw: unknown, period: string): PnlResponse {
  if (!raw || typeof raw !== "object") {
    throw new Error("Invalid Zerion chart response");
  }
  const r = raw as Record<string, unknown>;
  const data = r.data as Record<string, unknown> | undefined;
  if (!data || typeof data !== "object") {
    throw new Error("Zerion response missing data field");
  }

  const attrs = data.attributes as Record<string, unknown> | undefined;
  if (!attrs || typeof attrs !== "object") {
    throw new Error("Zerion response missing attributes");
  }

  const beginAt = String(attrs.begin_at ?? "");
  const endAt = String(attrs.end_at ?? "");
  const statsRaw = attrs.stats as Record<string, unknown> | undefined;
  const pointsRaw = attrs.points as unknown;

  const stats = {
    first: statsRaw ? num(statsRaw.first) : 0,
    min: statsRaw ? num(statsRaw.min) : 0,
    avg: statsRaw ? num(statsRaw.avg) : 0,
    max: statsRaw ? num(statsRaw.max) : 0,
    last: statsRaw ? num(statsRaw.last) : 0,
  };

  const chartData: ZerionChartPoint[] = [];
  if (Array.isArray(pointsRaw)) {
    for (const pt of pointsRaw) {
      if (Array.isArray(pt) && pt.length >= 2) {
        const ts = num(pt[0], NaN);
        const val = num(pt[1], NaN);
        if (Number.isFinite(ts) && Number.isFinite(val)) {
          chartData.push({ timestamp: ts, value: val });
        }
      }
    }
  }

  chartData.sort((a, b) => a.timestamp - b.timestamp);

  return {
    provider: "zerion",
    period,
    beginAt,
    endAt,
    stats,
    chartData,
  };
}

// GET /api/agent/:wallet/pnl — Zerion API wallet balance chart
pnlRouter.get(
  "/:wallet/pnl",
  validateParams(walletParamSchema),
  async (req: Request, res: Response) => {
    try {
      const { wallet } = (req as Request & { validatedParams: WalletParams }).validatedParams;

      // Accept period query param (day, week, 3months, 5years)
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
      const upstream = await fetchWith429Retry(chartUrl, apiKey);

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
