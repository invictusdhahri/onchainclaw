import { Router } from "express";
import type { Request, Response } from "express";
import type { z } from "zod";
import { validateParams } from "../validation/middleware.js";
import { walletParamSchema } from "../validation/schemas.js";
import { getPnlCache, getPnlStaleBackup, setPnlCache } from "../lib/redis.js";
import type {
  PnlResponse,
  SolanaTrackerChartDataPoint,
  SolanaTrackerWalletChartPnl,
} from "@onchainclaw/shared";

/** @see https://docs.solanatracker.io/data-api/pnl/get-wallet-pnl */
const SOLANA_TRACKER_DATA_BASE = "https://data.solanatracker.io";

/** Accept SOLANA_TRACKER_API_KEY; also S0LANA_* (zero vs letter O) — common .env typo */
function getSolanaTrackerApiKey(): string | undefined {
  const primary = process.env.SOLANA_TRACKER_API_KEY?.trim();
  if (primary) {
    return primary;
  }
  const typoZero = process.env["S0LANA_TRACKER_API_KEY"]?.trim();
  if (typoZero) {
    console.warn(
      "[pnl] Using S0LANA_TRACKER_API_KEY (you used digit 0). Rename to SOLANA_TRACKER_API_KEY in .env"
    );
    return typoZero;
  }
  return undefined;
}

export const pnlRouter: Router = Router();

type WalletParams = z.infer<typeof walletParamSchema>;

function num(v: unknown, fallback = 0): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

/** Prefer camelCase (OpenAPI), fall back to snake_case if API returns it */
function pickNum(obj: Record<string, unknown>, camel: string, snake: string, fallback = 0): number {
  if (obj[camel] !== undefined) {
    return num(obj[camel], fallback);
  }
  if (obj[snake] !== undefined) {
    return num(obj[snake], fallback);
  }
  return fallback;
}

function pickInt(obj: Record<string, unknown>, camel: string, snake: string): number | undefined {
  const v = obj[camel] !== undefined ? obj[camel] : obj[snake];
  if (v === undefined) {
    return undefined;
  }
  return Math.round(num(v));
}

/** Raw historic interval bucket (BETA showHistoricPnL — not always identical to OpenAPI schema) */
interface RawHistoricBucket {
  totalPnL?: number;
  realizedChange?: number;
  unrealizedChange?: number;
  totalChange?: number;
}

function pickHistoricBucket(raw: RawHistoricBucket | undefined): PnlHistoricWindow | undefined {
  if (!raw || typeof raw !== "object") {
    return undefined;
  }
  const realized = Number(raw.realizedChange ?? 0);
  const total = Number(raw.totalChange ?? raw.totalPnL ?? 0);
  const unrealized =
    raw.unrealizedChange !== undefined ? Number(raw.unrealizedChange) : undefined;
  return {
    realizedChangeUsd: realized,
    totalChangeUsd: total,
    ...(unrealized !== undefined && Number.isFinite(unrealized)
      ? { unrealizedChangeUsd: unrealized }
      : {}),
  };
}

function extractHistoricSummary(
  r: Record<string, unknown>
): Record<string, RawHistoricBucket> | undefined {
  const historic = r.historic;
  if (!historic || typeof historic !== "object") {
    return undefined;
  }
  const h = historic as Record<string, unknown>;
  // Documented shape: historic.summary["1d" | "7d" | "30d"]
  if (h.summary && typeof h.summary === "object") {
    return h.summary as Record<string, RawHistoricBucket>;
  }
  // Defensive: some payloads may flatten intervals
  const keys = ["1d", "7d", "30d"];
  const out: Record<string, RawHistoricBucket> = {};
  let any = false;
  for (const k of keys) {
    const b = h[k];
    if (b && typeof b === "object") {
      out[k] = b as RawHistoricBucket;
      any = true;
    }
  }
  return any ? out : undefined;
}

/**
 * GET /pnl/{wallet} → PnlResponse (summary + optional historic).
 * OpenAPI: WalletPnLResponse; BETA fields: pnl_since, historic.
 */
function mapSolanaTrackerPnlPayload(raw: unknown): PnlResponse {
  if (!raw || typeof raw !== "object") {
    throw new Error("Invalid Solana Tracker PnL response");
  }
  const r = raw as Record<string, unknown>;
  const summaryRaw = r.summary as Record<string, unknown> | undefined;
  if (!summaryRaw) {
    throw new Error("Solana Tracker PnL response missing summary");
  }

  const historicSummary = extractHistoricSummary(r);

  return {
    provider: "solana-tracker",
    pnlSince: typeof r.pnl_since === "number" ? r.pnl_since : null,
    summary: {
      realizedUsd: num(summaryRaw.realized),
      unrealizedUsd: num(summaryRaw.unrealized),
      totalUsd: num(summaryRaw.total),
      totalInvestedUsd:
        summaryRaw.totalInvested !== undefined || summaryRaw.total_invested !== undefined
          ? pickNum(summaryRaw, "totalInvested", "total_invested")
          : undefined,
      totalWins: pickInt(summaryRaw, "totalWins", "total_wins"),
      totalLosses: pickInt(summaryRaw, "totalLosses", "total_losses"),
      averageBuyAmountUsd:
        summaryRaw.averageBuyAmount !== undefined || summaryRaw.average_buy_amount !== undefined
          ? pickNum(summaryRaw, "averageBuyAmount", "average_buy_amount")
          : undefined,
      winPercentage:
        summaryRaw.winPercentage !== undefined || summaryRaw.win_percentage !== undefined
          ? pickNum(summaryRaw, "winPercentage", "win_percentage")
          : undefined,
      lossPercentage:
        summaryRaw.lossPercentage !== undefined || summaryRaw.loss_percentage !== undefined
          ? pickNum(summaryRaw, "lossPercentage", "loss_percentage")
          : undefined,
      neutralPercentage:
        summaryRaw.neutralPercentage !== undefined || summaryRaw.neutral_percentage !== undefined
          ? pickNum(summaryRaw, "neutralPercentage", "neutral_percentage")
          : undefined,
    },
    historic:
      historicSummary && typeof historicSummary === "object"
        ? {
            d1: pickHistoricBucket(historicSummary["1d"]),
            d7: pickHistoricBucket(historicSummary["7d"]),
            d30: pickHistoricBucket(historicSummary["30d"]),
          }
        : undefined,
  };
}

function mapPnlSubWindow(raw: unknown): { value: number; percentage: number } {
  if (!raw || typeof raw !== "object") {
    return { value: 0, percentage: 0 };
  }
  const o = raw as Record<string, unknown>;
  return {
    value: num(o.value),
    percentage: num(o.percentage),
  };
}

/**
 * GET /wallet/{owner}/chart → walletChart (matches WalletChartResponse).
 * @see https://docs.solanatracker.io/data-api/wallet/get-wallet-portfolio-chart
 */
function mapSolanaTrackerWalletChartPayload(raw: unknown): PnlResponse["walletChart"] | undefined {
  if (!raw || typeof raw !== "object") {
    return undefined;
  }
  const r = raw as Record<string, unknown>;
  const chartDataRaw = r.chartData;
  if (!Array.isArray(chartDataRaw) || chartDataRaw.length < 2) {
    return undefined;
  }

  const chartData: SolanaTrackerChartDataPoint[] = [];
  for (const row of chartDataRaw) {
    if (!row || typeof row !== "object") {
      continue;
    }
    const o = row as Record<string, unknown>;
    const ts = num(o.timestamp, NaN);
    const value = num(o.value, NaN);
    if (!Number.isFinite(ts) || !Number.isFinite(value)) {
      continue;
    }
    chartData.push({
      date: o.date != null ? String(o.date) : "",
      timestamp: ts,
      value,
      pnlPercentage: num(o.pnlPercentage, 0),
    });
  }

  if (chartData.length < 2) {
    return undefined;
  }
  chartData.sort((a, b) => a.timestamp - b.timestamp);

  const pnlRoot = r.pnl;
  let pnl: SolanaTrackerWalletChartPnl = {
    "24h": { value: 0, percentage: 0 },
    "30d": { value: 0, percentage: 0 },
  };
  if (pnlRoot && typeof pnlRoot === "object") {
    const p = pnlRoot as Record<string, unknown>;
    pnl = {
      "24h": mapPnlSubWindow(p["24h"]),
      "30d": mapPnlSubWindow(p["30d"]),
    };
  }

  const statsRaw = r.statistics;
  let statistics:
    | {
        dailyOutliersRemoved: number;
        chartOutliersRemoved: number;
        totalDataPoints: number;
      }
    | undefined;
  if (statsRaw && typeof statsRaw === "object") {
    const s = statsRaw as Record<string, unknown>;
    statistics = {
      dailyOutliersRemoved: Math.round(num(s.dailyOutliersRemoved)),
      chartOutliersRemoved: Math.round(num(s.chartOutliersRemoved)),
      totalDataPoints: Math.round(num(s.totalDataPoints)),
    };
  }

  return {
    chartData,
    pnl,
    ...(statistics ? { statistics } : {}),
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

type FetchResponse = Awaited<ReturnType<typeof fetch>>;

async function solanaTrackerFetch(url: string, apiKey: string): Promise<FetchResponse> {
  return fetch(url, {
    method: "GET",
    headers: {
      Accept: "application/json",
      "x-api-key": apiKey,
    },
  });
}

/** Retry on 429 with backoff */
async function fetchWith429Retry(url: string, apiKey: string): Promise<FetchResponse> {
  let res = await solanaTrackerFetch(url, apiKey);
  const backoffMs = [2000, 5000];
  for (let i = 0; i < backoffMs.length && res.status === 429; i++) {
    console.warn(`[pnl] 429 from Solana Tracker, retry after ${backoffMs[i]}ms → ${url.split("?")[0]}`);
    await sleep(backoffMs[i]);
    res = await solanaTrackerFetch(url, apiKey);
  }
  return res;
}

function buildWalletPnlUrl(wallet: string): string {
  const pathWallet = encodeURIComponent(wallet);
  const url = new URL(`${SOLANA_TRACKER_DATA_BASE}/pnl/${pathWallet}`);
  // OpenAPI query params (boolean as "true" / "false")
  url.searchParams.set("showHistoricPnL", "true");
  url.searchParams.set("holdingCheck", "true");
  // Omit hideDetails (default false) so BETA historic + token detail stay available if API sends them
  return url.toString();
}

function buildWalletChartUrl(wallet: string): string {
  const owner = encodeURIComponent(wallet);
  return `${SOLANA_TRACKER_DATA_BASE}/wallet/${owner}/chart`;
}

async function fetchWalletChart(
  wallet: string,
  apiKey: string
): Promise<PnlResponse["walletChart"] | undefined> {
  const chartUrl = buildWalletChartUrl(wallet);
  let res = await solanaTrackerFetch(chartUrl, apiKey);
  if (res.status === 429) {
    await sleep(2000);
    res = await solanaTrackerFetch(chartUrl, apiKey);
  }
  if (!res.ok) {
    console.warn(
      `[pnl] GET /wallet/…/chart → ${res.status} for ${wallet.slice(0, 8)}… (chart omitted)`
    );
    return undefined;
  }
  const json: unknown = await res.json();
  return mapSolanaTrackerWalletChartPayload(json);
}

// GET /api/agent/:wallet/pnl — Solana Tracker Data API (pnl + wallet chart)
pnlRouter.get(
  "/:wallet/pnl",
  validateParams(walletParamSchema),
  async (req: Request, res: Response) => {
    try {
      const { wallet } = (req as Request & { validatedParams: WalletParams }).validatedParams;

      const cached = await getPnlCache(wallet);
      if (cached) {
        return res.json(cached);
      }

      const apiKey = getSolanaTrackerApiKey();
      if (!apiKey) {
        return res.status(500).json({
          error: "SOLANA_TRACKER_API_KEY not configured",
          hint: "Use SOLANA_TRACKER_API_KEY (letter O in SOLANA, not the digit 0).",
        });
      }

      const pnlUrl = buildWalletPnlUrl(wallet);
      const upstream = await fetchWith429Retry(pnlUrl, apiKey);

      if (!upstream.ok) {
        const text = await upstream.text();
        console.error(
          `Solana Tracker GET /pnl/{wallet} ${upstream.status} for ${wallet.slice(0, 8)}…: ${text.slice(0, 200)}`
        );

        if (upstream.status === 429) {
          const stale = await getPnlStaleBackup(wallet);
          if (stale && typeof stale === "object") {
            const body = { ...stale, stale: true } as PnlResponse;
            console.warn(`[pnl] Serving stale PnL backup for ${wallet.slice(0, 8)}… (429)`);
            return res.json(body);
          }
          const ra = upstream.headers.get("retry-after");
          const retryParsed = ra ? parseInt(ra, 10) : NaN;
          const retrySec =
            Number.isFinite(retryParsed) && retryParsed > 0 ? retryParsed : undefined;
          if (retrySec !== undefined) {
            res.setHeader("Retry-After", String(retrySec));
          }
          return res.status(429).json({
            error: "Solana Tracker rate limit — try again in a minute",
            status: 429,
            ...(retrySec !== undefined ? { retryAfterSeconds: retrySec } : {}),
          });
        }

        return res.status(upstream.status === 401 || upstream.status === 403 ? 502 : 503).json({
          error: "Solana Tracker PnL unavailable",
          status: upstream.status,
        });
      }

      const body: unknown = await upstream.json();
      const response: PnlResponse = mapSolanaTrackerPnlPayload(body);

      const walletChart = await fetchWalletChart(wallet, apiKey);
      if (walletChart) {
        response.walletChart = walletChart;
      }

      await setPnlCache(wallet, response);
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
