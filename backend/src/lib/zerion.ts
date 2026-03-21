import type { PnlResponse, ZerionChartPoint } from "@onchainclaw/shared";

/** @see https://developers.zerion.io/reference/getwalletchart */
export const ZERION_API_BASE = "https://api.zerion.io/v1";

export function getZerionApiKey(): string | undefined {
  return process.env.ZERION_API_KEY?.trim();
}

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
export async function zerionFetch(url: string, apiKey: string): Promise<FetchResponse> {
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
export async function fetchZerionWith429Retry(url: string, apiKey: string): Promise<FetchResponse> {
  let res = await zerionFetch(url, apiKey);
  const backoffMs = [2000, 5000];
  for (let i = 0; i < backoffMs.length && res.status === 429; i++) {
    console.warn(`[zerion] 429, retry after ${backoffMs[i]}ms → ${url.split("?")[0]}`);
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
export function buildZerionChartUrl(wallet: string, period: string): string {
  return `${ZERION_API_BASE}/wallets/${encodeURIComponent(wallet)}/charts/${period}`;
}

/**
 * Parse Zerion chart response (JSON:API format).
 * Portfolio USD trajectory — not full realized PnL unless using Zerion's dedicated PnL API.
 */
export function mapZerionChartResponse(raw: unknown, period: string): PnlResponse {
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

/**
 * Week portfolio change from chart stats (last − first), in USD.
 * Used for leaderboard sync; aligns with Zerion "week" chart window.
 */
export function weekPortfolioDeltaFromChart(chart: PnlResponse): number {
  return chart.stats.last - chart.stats.first;
}
