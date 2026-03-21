"use client";

import { useEffect, useMemo, useState } from "react";
import { Line } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Filler,
  ChartOptions,
} from "chart.js";
import { fetchAgentPnl } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import type { PnlResponse, SolanaTrackerChartDataPoint } from "@onchainclaw/shared";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Filler);

interface AgentPnlChartProps {
  wallet: string;
}

type Timeframe = "24h" | "7d" | "30d" | "ALL";

const CACHE_TTL_MS = 15 * 60 * 1000;
const MS_DAY = 24 * 60 * 60 * 1000;
const MS_HOUR = 60 * 60 * 1000;

interface CachedPnlData {
  data: PnlResponse;
  timestamp: number;
}

function timeframeCutoffMs(tf: Timeframe, now: number): number {
  switch (tf) {
    case "24h": return now - 24 * MS_HOUR;
    case "7d":  return now - 7 * MS_DAY;
    case "30d": return now - 30 * MS_DAY;
    default:    return 0;
  }
}

function filterChartData(
  rows: SolanaTrackerChartDataPoint[] | undefined,
  tf: Timeframe
): SolanaTrackerChartDataPoint[] {
  if (!rows?.length) return [];
  if (tf === "ALL") return [...rows];
  const now = Date.now();
  const cutoff = timeframeCutoffMs(tf, now);
  const filtered = rows.filter((p) => p.timestamp >= cutoff);
  return filtered.length >= 2 ? filtered : rows;
}

type ChartBuild = { points: { timestamp: number; valueUsd: number }[]; source: "walletChart" | "stub" };

function buildChartPoints(data: PnlResponse, tf: Timeframe): ChartBuild {
  const chart = data.walletChart?.chartData;
  if (chart?.length) {
    const filtered = filterChartData(chart, tf);
    if (filtered.length >= 2) {
      return {
        source: "walletChart",
        points: filtered.map((p) => ({ timestamp: p.timestamp, valueUsd: p.value })),
      };
    }
  }

  const now = Date.now();
  const realizedAll = data.summary.realizedUsd;
  const chartPnl = data.walletChart?.pnl;
  const h = data.historic;

  switch (tf) {
    case "24h": {
      const end = chartPnl?.["24h"]?.value ?? h?.d1?.realizedChangeUsd ?? realizedAll;
      return { source: "stub", points: [{ timestamp: now - 24 * MS_HOUR, valueUsd: 0 }, { timestamp: now, valueUsd: end }] };
    }
    case "7d": {
      const end = h?.d7?.realizedChangeUsd ?? realizedAll;
      return { source: "stub", points: [{ timestamp: now - 7 * MS_DAY, valueUsd: 0 }, { timestamp: now, valueUsd: end }] };
    }
    case "30d": {
      const end = chartPnl?.["30d"]?.value ?? h?.d30?.realizedChangeUsd ?? realizedAll;
      return { source: "stub", points: [{ timestamp: now - 30 * MS_DAY, valueUsd: 0 }, { timestamp: now, valueUsd: end }] };
    }
    default: {
      const start = data.pnlSince ?? now - 365 * MS_DAY;
      return { source: "stub", points: [{ timestamp: start, valueUsd: 0 }, { timestamp: now, valueUsd: realizedAll }] };
    }
  }
}

function headlinePnl(data: PnlResponse, tf: Timeframe): number {
  const all = data.summary.realizedUsd;
  const pnl = data.walletChart?.pnl;
  const h = data.historic;
  switch (tf) {
    case "24h": return pnl?.["24h"]?.value ?? h?.d1?.realizedChangeUsd ?? all;
    case "7d":  return h?.d7?.realizedChangeUsd ?? all;
    case "30d": return pnl?.["30d"]?.value ?? h?.d30?.realizedChangeUsd ?? all;
    default:    return all;
  }
}

function formatUsd(n: number, decimals = 2): string {
  if (!Number.isFinite(n)) return "$0";
  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000)     return `${sign}$${(abs / 1_000).toFixed(2)}k`;
  if (abs < 0.005)      return "$0";
  return `${sign}$${abs.toFixed(decimals)}`;
}

export function AgentPnlChart({ wallet }: AgentPnlChartProps) {
  const [pnlData, setPnlData] = useState<PnlResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timeframe, setTimeframe] = useState<Timeframe>("30d");

  useEffect(() => {
    async function loadPnl() {
      try {
        setLoading(true);
        setError(null);
        const cacheKey = `pnl:st:v3:${wallet}`;
        const cached = localStorage.getItem(cacheKey);
        if (cached) {
          try {
            const c: CachedPnlData = JSON.parse(cached);
            if (Date.now() - c.timestamp < CACHE_TTL_MS && c.data?.provider === "solana-tracker") {
              setPnlData(c.data);
              setLoading(false);
              return;
            }
            localStorage.removeItem(cacheKey);
          } catch {
            localStorage.removeItem(cacheKey);
          }
        }
        const data = await fetchAgentPnl(wallet);
        setPnlData(data);
        localStorage.setItem(cacheKey, JSON.stringify({ data, timestamp: Date.now() }));
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load PnL");
      } finally {
        setLoading(false);
      }
    }
    loadPnl();
  }, [wallet]);

  const { rawPoints, chartSource } = useMemo(() => {
    if (!pnlData) return { rawPoints: [] as { timestamp: number; valueUsd: number }[], chartSource: "stub" as const };
    const b = buildChartPoints(pnlData, timeframe);
    return { rawPoints: b.points, chartSource: b.source };
  }, [pnlData, timeframe]);

  const normalized = useMemo(() => {
    if (!rawPoints.length) return [];
    const base = rawPoints[0].valueUsd;
    return rawPoints.map((p) => ({ timestamp: p.timestamp, pnl: p.valueUsd - base }));
  }, [rawPoints]);

  if (loading) {
    return (
      <Card>
        <CardHeader><CardTitle>PnL</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-[200px] w-full" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader><CardTitle>PnL</CardTitle></CardHeader>
        <CardContent><p className="text-sm text-muted-foreground">{error}</p></CardContent>
      </Card>
    );
  }

  if (!pnlData || !normalized.length) {
    return (
      <Card>
        <CardHeader><CardTitle>PnL</CardTitle></CardHeader>
        <CardContent><p className="text-sm text-muted-foreground">No data</p></CardContent>
      </Card>
    );
  }

  const headline = headlinePnl(pnlData, timeframe);
  const headlinePositive = headline >= 0;

  const allY = normalized.map((p) => p.pnl);
  const rawMin = Math.min(...allY, 0);
  const rawMax = Math.max(...allY, 0);
  const span = Math.max(rawMax - rawMin, 1);
  const pad = span * 0.15;
  const yMin = rawMin - pad;
  const yMax = rawMax + pad;

  const chartData = {
    labels: normalized.map((p) =>
      new Date(p.timestamp).toLocaleDateString("en-US", { month: "short", day: "numeric" })
    ),
    datasets: [
      {
        data: normalized.map((p) => p.pnl),
        segment: {
          borderColor: (ctx: any) => {
            const curr = ctx.p1.parsed.y;
            const prev = ctx.p0.parsed.y;
            if (curr >= 0 && prev >= 0) return "#22c55e";
            if (curr < 0 && prev < 0) return "#ef4444";
            return curr >= prev ? "#22c55e" : "#ef4444";
          },
          backgroundColor: (ctx: any) => {
            const curr = ctx.p1.parsed.y;
            const prev = ctx.p0.parsed.y;
            if (curr >= 0 && prev >= 0) return "rgba(34,197,94,0.08)";
            if (curr < 0 && prev < 0) return "rgba(239,68,68,0.08)";
            return "rgba(150,150,150,0.05)";
          },
        },
        fill: true,
        tension: chartSource === "walletChart" ? 0.25 : 0.35,
        pointRadius: 0,
        pointHoverRadius: 6,
        pointHoverBackgroundColor: (ctx: any) => (ctx.parsed.y >= 0 ? "#22c55e" : "#ef4444"),
        pointHoverBorderColor: "#fff",
        pointHoverBorderWidth: 2,
        borderWidth: 2.5,
      },
    ],
  };

  const options: ChartOptions<"line"> = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: "index", intersect: false },
    plugins: {
      legend: { display: false },
      tooltip: {
        mode: "index",
        intersect: false,
        displayColors: false,
        backgroundColor: "rgba(0,0,0,0.85)",
        titleColor: "#aaa",
        bodyColor: "#fff",
        padding: 12,
        callbacks: {
          title: (items) => {
            if (!items.length) return "";
            const idx = items[0].dataIndex;
            const ts = normalized[idx].timestamp;
            return new Date(ts).toLocaleDateString("en-US", {
              year: "numeric",
              month: "short",
              day: "numeric",
            });
          },
          label: (ctx) => {
            const val = ctx.parsed.y;
            const sign = val >= 0 ? "+" : "";
            return `PnL: ${sign}${formatUsd(val, 2)}`;
          },
        },
      },
    },
    scales: {
      x: { display: false },
      y: {
        position: "right",
        min: yMin,
        max: yMax,
        ticks: {
          maxTicksLimit: 6,
          autoSkip: true,
          color: "#888",
          font: { size: 11 },
          callback: (value) => {
            const n = Number(value);
            if (Math.abs(n) < span * 0.03) return "$0";
            return formatUsd(n);
          },
        },
        grid: {
          color: (ctx) => (ctx.tick.value === 0 ? "rgba(0,0,0,0.2)" : "rgba(0,0,0,0.06)"),
          lineWidth: (ctx) => (ctx.tick.value === 0 ? 2 : 1),
        },
      },
    },
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-2 flex-wrap">
          <div>
            <CardTitle className="text-base">PnL</CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              via{" "}
              <a
                href="https://docs.solanatracker.io/"
                target="_blank"
                rel="noopener noreferrer"
                className="underline underline-offset-2 hover:text-foreground"
              >
                Solana Tracker
              </a>
            </p>
            {pnlData.stale && (
              <p className="text-xs text-amber-700 dark:text-amber-400 mt-1.5 bg-amber-50 dark:bg-amber-950/40 border border-amber-200/80 dark:border-amber-900/60 rounded px-2 py-1">
                Cached — API rate limit
              </p>
            )}
          </div>
          <Tabs value={timeframe} onValueChange={(v) => setTimeframe(v as Timeframe)}>
            <TabsList>
              <TabsTrigger value="24h">24h</TabsTrigger>
              <TabsTrigger value="7d">7d</TabsTrigger>
              <TabsTrigger value="30d">30d</TabsTrigger>
              <TabsTrigger value="ALL">All</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <p
            className={`text-3xl font-bold tabular-nums ${
              headlinePositive ? "text-green-600" : "text-red-500"
            }`}
          >
            {headlinePositive ? "+" : ""}
            {formatUsd(headline, 2)}
          </p>
          {timeframe === "ALL" && (
            <p className="text-xs text-muted-foreground mt-0.5">
              Unrealized: {pnlData.summary.unrealizedUsd >= 0 ? "+" : ""}
              {formatUsd(pnlData.summary.unrealizedUsd, 2)}
              &ensp;·&ensp;Total: {formatUsd(pnlData.summary.totalUsd, 2)}
            </p>
          )}
        </div>
        <div className="h-[200px]">
          <Line data={chartData} options={options} />
        </div>
      </CardContent>
    </Card>
  );
}
