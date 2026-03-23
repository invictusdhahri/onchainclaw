import { PublicKey } from "@solana/web3.js";
import type { PnlResponse, ZerionChartPoint } from "@onchainclaw/shared";
import { logger } from "./logger.js";

/** @see https://developers.zerion.io/reference/getwalletchart */
export const ZERION_API_BASE = "https://api.zerion.io/v1";

const EVM_ADDRESS = /^0x[a-fA-F0-9]{40}$/;

/** Solana pubkey or EVM address — Zerion rejects seed strings like `demo_agent_2`. */
export function isZerionQueryableWallet(wallet: string): boolean {
  const w = wallet.trim();
  if (!w) return false;
  if (EVM_ADDRESS.test(w)) return true;
  try {
    new PublicKey(w);
    return true;
  } catch {
    return false;
  }
}

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

function retryAfterMsFromResponse(res: Response, fallbackMs: number): number {
  const raw = res.headers.get("retry-after");
  if (!raw) return fallbackMs;
  const sec = parseInt(raw.trim(), 10);
  if (Number.isFinite(sec) && sec > 0) {
    return Math.min(sec * 1000, 60_000);
  }
  return fallbackMs;
}

/** Retry on 429 — honors Retry-After when present, else escalating backoff (sync-friendly). */
export async function fetchZerionWith429Retry(url: string, apiKey: string): Promise<FetchResponse> {
  const maxAttempts = 8;
  const fallbackSteps = [2000, 5000, 8000, 12000, 16000, 20000, 25000, 30000];
  let res = await zerionFetch(url, apiKey);
  const base = url.split("?")[0];

  for (let i = 0; i < maxAttempts && res.status === 429; i++) {
    const fallback = fallbackSteps[Math.min(i, fallbackSteps.length - 1)]!;
    const waitMs = retryAfterMsFromResponse(res, fallback);
    logger.warn(`[zerion] 429, retry ${i + 1}/${maxAttempts} after ${waitMs}ms → ${base}`);
    await sleep(waitMs);
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

function asRecord(v: unknown): Record<string, unknown> | undefined {
  if (v && typeof v === "object" && !Array.isArray(v)) {
    return v as Record<string, unknown>;
  }
  return undefined;
}

/** JSON:API `data` may be a single resource or a one-element array. */
function getChartAttributes(raw: unknown): Record<string, unknown> {
  const r = asRecord(raw);
  if (!r) {
    throw new Error("Invalid Zerion chart response");
  }
  const d = r.data;
  let resource: Record<string, unknown> | undefined;

  if (Array.isArray(d) && d.length > 0) {
    resource = asRecord(d[0]);
  } else {
    resource = asRecord(d);
  }

  const attrs = resource ? asRecord(resource.attributes) : undefined;
  if (!attrs) {
    throw new Error("Zerion response missing data.attributes");
  }
  return attrs;
}

function parseChartPoints(pointsRaw: unknown): ZerionChartPoint[] {
  const chartData: ZerionChartPoint[] = [];
  if (!Array.isArray(pointsRaw)) {
    return chartData;
  }
  for (const pt of pointsRaw) {
    if (Array.isArray(pt) && pt.length >= 2) {
      const ts = num(pt[0], NaN);
      const val = num(pt[1], NaN);
      if (Number.isFinite(ts) && Number.isFinite(val)) {
        chartData.push({ timestamp: ts, value: val });
      }
      continue;
    }
    const o = asRecord(pt);
    if (o) {
      const ts = num(o.timestamp ?? o.t ?? o.time, NaN);
      const val = num(o.value ?? o.v ?? o.y, NaN);
      if (Number.isFinite(ts) && Number.isFinite(val)) {
        chartData.push({ timestamp: ts, value: val });
      }
    }
  }
  chartData.sort((a, b) => a.timestamp - b.timestamp);
  return chartData;
}

/** Zerion may send null; Number(null) is 0 — treat null/undefined as missing. */
function statNumber(statsRaw: Record<string, unknown> | undefined, key: string): number | undefined {
  if (!statsRaw || !(key in statsRaw)) return undefined;
  const v = statsRaw[key];
  if (v === null || v === undefined) return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

/**
 * Parse Zerion chart response (JSON:API format).
 * Portfolio USD trajectory — not full realized PnL unless using Zerion's dedicated PnL API.
 */
export function mapZerionChartResponse(raw: unknown, period: string): PnlResponse {
  const attrs = getChartAttributes(raw);
  const beginAt = String(attrs.begin_at ?? attrs.beginAt ?? "");
  const endAt = String(attrs.end_at ?? attrs.endAt ?? "");
  const statsRaw = asRecord(attrs.stats);

  const chartData = parseChartPoints(attrs.points);

  let first = statNumber(statsRaw, "first");
  let last = statNumber(statsRaw, "last");

  // Zerion sometimes omits stats or sends nulls; derive from the series when possible.
  if (first === undefined || last === undefined) {
    if (chartData.length >= 2) {
      first = chartData[0]!.value;
      last = chartData[chartData.length - 1]!.value;
    } else {
      if (first === undefined) first = chartData[0]?.value ?? 0;
      if (last === undefined) last = chartData[chartData.length - 1]?.value ?? 0;
    }
  }

  const values = chartData.map((p) => p.value);
  let minV = statNumber(statsRaw, "min") ?? NaN;
  let maxV = statNumber(statsRaw, "max") ?? NaN;
  let avgV = statNumber(statsRaw, "avg") ?? NaN;
  if (values.length > 0) {
    if (!Number.isFinite(minV)) minV = Math.min(...values);
    if (!Number.isFinite(maxV)) maxV = Math.max(...values);
    if (!Number.isFinite(avgV)) avgV = values.reduce((a, b) => a + b, 0) / values.length;
  } else {
    if (!Number.isFinite(minV)) minV = first;
    if (!Number.isFinite(maxV)) maxV = last;
    if (!Number.isFinite(avgV)) avgV = first;
  }

  const stats = {
    first,
    min: minV,
    avg: avgV,
    max: maxV,
    last,
  };

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
