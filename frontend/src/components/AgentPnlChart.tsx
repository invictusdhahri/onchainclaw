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
  type ChartData,
} from "chart.js";
import { fetchAgentPnl } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import type { PnlResponse } from "@onchainclaw/shared";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Filler);

interface AgentPnlChartProps {
  wallet: string;
}

type Timeframe = "day" | "week" | "3months" | "5years";

/** Chart.js segment scriptable props (minimal shape for line charts). */
interface LineSegmentCtx {
  p0: { parsed: { y: number } };
  p1: { parsed: { y: number } };
}

const CACHE_TTL_MS = 15 * 60 * 1000;

interface CachedPnlData {
  data: PnlResponse;
  timestamp: number;
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
  const [timeframe, setTimeframe] = useState<Timeframe>("3months");

  useEffect(() => {
    async function loadPnl() {
      try {
        setLoading(true);
        setError(null);
        const cacheKey = `pnl:zerion:v4:${wallet}:${timeframe}`;
        const cached = localStorage.getItem(cacheKey);
        if (cached) {
          try {
            const c: CachedPnlData = JSON.parse(cached);
            if (Date.now() - c.timestamp < CACHE_TTL_MS && c.data?.provider === "zerion") {
              setPnlData(c.data);
              setLoading(false);
              return;
            }
            localStorage.removeItem(cacheKey);
          } catch {
            localStorage.removeItem(cacheKey);
          }
        }
        const data = await fetchAgentPnl(wallet, timeframe);
        setPnlData(data);
        localStorage.setItem(cacheKey, JSON.stringify({ data, timestamp: Date.now() }));
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load PnL");
      } finally {
        setLoading(false);
      }
    }
    loadPnl();
  }, [wallet, timeframe]);

  const normalized = useMemo(() => {
    if (!pnlData?.chartData.length) return [];
    const base = pnlData.chartData[0].value;
    return pnlData.chartData.map((p) => ({
      timestampMs: p.timestamp * 1000,
      pnl: p.value - base,
    }));
  }, [pnlData]);

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

  const headline = normalized[normalized.length - 1].pnl;
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
      new Date(p.timestampMs).toLocaleDateString("en-US", { month: "short", day: "numeric" })
    ),
    datasets: [
      {
        data: normalized.map((p) => p.pnl),
        segment: {
          borderColor: (ctx: LineSegmentCtx) => {
            const curr = ctx.p1.parsed.y;
            const prev = ctx.p0.parsed.y;
            if (curr >= 0 && prev >= 0) return "#22c55e";
            if (curr < 0 && prev < 0) return "#ef4444";
            return curr >= 0 ? "#22c55e" : "#ef4444";
          },
          backgroundColor: (ctx: LineSegmentCtx) => {
            const curr = ctx.p1.parsed.y;
            const prev = ctx.p0.parsed.y;
            if (curr >= 0 && prev >= 0) return "rgba(34,197,94,0.08)";
            if (curr < 0 && prev < 0) return "rgba(239,68,68,0.08)";
            return "rgba(150,150,150,0.05)";
          },
        },
        fill: true,
        tension: 0.25,
        pointRadius: 0,
        pointHoverRadius: 6,
        pointHoverBackgroundColor: (ctx: { parsed: { y: number | null } }) =>
          (ctx.parsed.y ?? 0) >= 0 ? "#22c55e" : "#ef4444",
        pointHoverBorderColor: "#fff",
        pointHoverBorderWidth: 2,
        borderWidth: 2.5,
      },
    ],
  } as unknown as ChartData<"line", number[], string>;

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
            const ts = normalized[idx].timestampMs;
            return new Date(ts).toLocaleDateString("en-US", {
              year: "numeric",
              month: "short",
              day: "numeric",
            });
          },
          label: (ctx) => {
            const val = ctx.parsed.y ?? 0;
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
                href="https://developers.zerion.io/"
                target="_blank"
                rel="noopener noreferrer"
                className="underline underline-offset-2 hover:text-foreground"
              >
                Zerion API
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
              <TabsTrigger value="day">1d</TabsTrigger>
              <TabsTrigger value="week">7d</TabsTrigger>
              <TabsTrigger value="3months">3m</TabsTrigger>
              <TabsTrigger value="5years">All</TabsTrigger>
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
          <p className="text-xs text-muted-foreground mt-0.5">
            Portfolio value change
          </p>
        </div>
        <div className="h-[200px]">
          <Line data={chartData} options={options} />
        </div>
      </CardContent>
    </Card>
  );
}
