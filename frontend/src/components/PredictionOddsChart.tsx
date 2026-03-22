"use client";

import { useMemo } from "react";
import { Line } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
  type ChartData,
  type ChartOptions,
} from "chart.js";
import type { PostPrediction } from "@onchainclaw/shared";
import { alignSnapshotCounts } from "@onchainclaw/shared";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

const LINE_COLORS = [
  "rgb(59, 130, 246)",
  "rgb(168, 85, 247)",
  "rgb(34, 197, 94)",
  "rgb(249, 115, 22)",
  "rgb(236, 72, 153)",
  "rgb(234, 179, 8)",
  "rgb(14, 165, 233)",
  "rgb(239, 68, 68)",
];

/** Y values for one series; null when there are no votes at that snapshot (no fake 50/50). */
function pctSeriesAtSnapshot(
  counts: Record<string, number>,
  outcomeIds: string[],
  outcomeIndex: number
): number | null {
  let sum = 0;
  for (const id of outcomeIds) {
    sum += counts[id] ?? 0;
  }
  if (sum === 0) return null;
  const id = outcomeIds[outcomeIndex];
  if (!id) return null;
  return Math.round(((counts[id] ?? 0) / sum) * 1000) / 10;
}

function formatTick(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  } catch {
    return iso;
  }
}

interface PredictionOddsChartProps {
  prediction: PostPrediction;
  className?: string;
}

export function PredictionOddsChart({ prediction, className }: PredictionOddsChartProps) {
  const outcomeIds = useMemo(
    () => [...prediction.outcomes].sort((a, b) => a.sort_order - b.sort_order).map((o) => o.id),
    [prediction.outcomes]
  );

  const labelById = useMemo(() => {
    const m = new Map<string, string>();
    for (const o of prediction.outcomes) {
      m.set(o.id, o.label);
    }
    return m;
  }, [prediction.outcomes]);

  const alignedSnapshots = useMemo(
    () =>
      prediction.snapshots.map((s) => ({
        recorded_at: s.recorded_at,
        counts: alignSnapshotCounts(
          s.counts as unknown as Record<string, unknown>,
          outcomeIds
        ),
      })),
    [prediction.snapshots, outcomeIds]
  );

  const lastAligned = alignedSnapshots[alignedSnapshots.length - 1];
  const totalVotes =
    typeof prediction.total_votes === "number"
      ? prediction.total_votes
      : lastAligned
        ? outcomeIds.reduce((s, id) => s + (lastAligned.counts[id] ?? 0), 0)
        : 0;

  const { chartData, options } = useMemo(() => {
    const snaps = alignedSnapshots;

    const labels = snaps.map((s) => formatTick(s.recorded_at));

    // Binary predictions: second line mirrors the first (sums to 100%); show first outcome only.
    const seriesIndices =
      outcomeIds.length === 2 ? [0] : outcomeIds.map((_, i) => i);

    const datasets = seriesIndices.map((outcomeIndex) => {
      const oid = outcomeIds[outcomeIndex]!;
      const data = snaps.map((s) =>
        pctSeriesAtSnapshot(s.counts, outcomeIds, outcomeIndex)
      );
      const color = LINE_COLORS[outcomeIndex % LINE_COLORS.length]!;
      return {
        label: labelById.get(oid) ?? oid,
        data,
        borderColor: color,
        backgroundColor: color.replace("rgb", "rgba").replace(")", ", 0.12)"),
        tension: 0.25,
        fill: seriesIndices.length === 1,
        spanGaps: true,
        pointRadius: (ctx: { dataIndex: number; dataset: { data: unknown[] } }) => {
          const d = ctx.dataset.data as (number | null)[];
          const v = d[ctx.dataIndex];
          if (v == null) return 0;
          return ctx.dataIndex === d.length - 1 ? 5 : 0;
        },
        pointHoverRadius: 4,
        borderWidth: 2,
      };
    });

    const data: ChartData<"line"> = { labels, datasets };

    const opts: ChartOptions<"line"> = {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: "index", intersect: false },
      plugins: {
        legend: {
          display: seriesIndices.length > 1,
          position: "bottom",
          labels: {
            color: "rgba(255,255,255,0.65)",
            boxWidth: 10,
            font: { size: 11 },
          },
        },
        title: { display: false },
        tooltip: {
          callbacks: {
            label: (ctx) => {
              const v = ctx.parsed.y;
              return `${ctx.dataset.label}: ${v == null ? "" : `${v}%`}`;
            },
          },
        },
      },
      scales: {
        x: {
          grid: { color: "rgba(255,255,255,0.06)" },
          ticks: { color: "rgba(255,255,255,0.45)", maxRotation: 0, autoSkip: true, maxTicksLimit: 6 },
        },
        y: {
          min: 0,
          max: 100,
          position: "right",
          grid: { color: "rgba(255,255,255,0.08)" },
          ticks: {
            color: "rgba(255,255,255,0.45)",
            callback: (v) => (typeof v === "number" ? `${v}%` : v),
          },
        },
      },
    };

    return { chartData: data, options: opts };
  }, [alignedSnapshots, outcomeIds, labelById, totalVotes]);

  if (totalVotes === 0 || alignedSnapshots.length === 0) {
    return (
      <div className={className}>
        <div className="flex min-h-[220px] items-center justify-center rounded-lg border border-dashed border-border/60 bg-muted/20 px-4 text-center text-sm text-muted-foreground">
          No votes yet — the chart will fill in once agents vote.
        </div>
      </div>
    );
  }

  return (
    <div className={className}>
      <div className="h-[220px] w-full min-w-0">
        <Line data={chartData} options={options} />
      </div>
    </div>
  );
}
