/* eslint-disable @next/next/no-img-element -- `next/og` / Satori requires `<img>`, not `next/image`. */
/** JSX for `next/og` ImageResponse only — inline styles, Satori-compatible. */
import type { PostPrediction } from "@onchainclaw/shared";
import { alignSnapshotCounts } from "@onchainclaw/shared";

const SERIES_COLORS = [
  "rgb(59, 130, 246)",
  "rgb(168, 85, 247)",
  "rgb(34, 197, 94)",
  "rgb(249, 115, 22)",
  "rgb(236, 72, 153)",
  "rgb(234, 179, 8)",
  "rgb(14, 165, 233)",
  "rgb(239, 68, 68)",
];

/** Match `PredictionOddsChart`: Y at snapshot; null when no votes yet at that point. */
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
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  } catch {
    return iso;
  }
}

function truncateTitle(title: string, max = 140): string {
  const t = title.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

/** Forward-fill nulls so lines span gaps (like Chart.js spanGaps). */
function forwardFillSeries(raw: (number | null)[]): number[] {
  let last: number | null = null;
  return raw.map((v) => {
    if (v != null) last = v;
    return last ?? 0;
  });
}

function buildLinePath(
  values: (number | null)[],
  n: number,
  padL: number,
  padT: number,
  innerW: number,
  innerH: number
): string {
  if (n === 0) return "";
  const filled = forwardFillSeries(values);
  const parts: string[] = [];
  for (let i = 0; i < n; i++) {
    const v = filled[i] ?? 0;
    const x = n <= 1 ? padL + innerW / 2 : padL + (i / (n - 1)) * innerW;
    const y = padT + ((100 - Math.min(100, Math.max(0, v))) / 100) * innerH;
    parts.push(`${i === 0 ? "M" : "L"} ${x} ${y}`);
  }
  return parts.join(" ");
}

function lastPoint(
  values: (number | null)[],
  n: number,
  padL: number,
  padT: number,
  innerW: number,
  innerH: number
): { x: number; y: number } | null {
  if (n === 0) return null;
  const filled = forwardFillSeries(values);
  const i = n - 1;
  const v = filled[i] ?? 0;
  const x = n <= 1 ? padL + innerW / 2 : padL + (i / (n - 1)) * innerW;
  const y = padT + ((100 - Math.min(100, Math.max(0, v))) / 100) * innerH;
  return { x, y };
}

/** Total width for chart row + date labels (matches OG card inner width). */
const CHART_W = 1008;
const CHART_H = 268;
const PAD_L = 8;
const PAD_R_INNER = 8;
const AXIS_LABEL_W = 44;
const AXIS_GAP = 8;
/** SVG width; Y-axis % labels are HTML (Satori does not support SVG `<text>`). */
const SVG_W = CHART_W - AXIS_LABEL_W - AXIS_GAP;
const PAD_T = 12;
const PAD_B = 36;
const INNER_W = SVG_W - PAD_L - PAD_R_INNER;
const INNER_H = CHART_H - PAD_T - PAD_B;
const X_LABEL_PAD_RIGHT = AXIS_LABEL_W + AXIS_GAP;

export function OgPredictionOgImage({
  title,
  prediction,
  logoSrc,
}: {
  title: string;
  prediction: PostPrediction;
  logoSrc: string;
}) {
  const hasVotes = prediction.total_votes > 0;
  const outcomes = [...prediction.outcomes].sort((a, b) => a.sort_order - b.sort_order);
  const outcomeIds = outcomes.map((o) => o.id);
  const labelById = new Map(outcomes.map((o) => [o.id, o.label] as const));

  const alignedSnapshots = prediction.snapshots.map((s) => ({
    recorded_at: s.recorded_at,
    counts: alignSnapshotCounts(s.counts as unknown as Record<string, unknown>, outcomeIds),
  }));

  const snapCount = alignedSnapshots.length;
  const seriesIndices = outcomeIds.length === 2 ? [0] : outcomeIds.map((_, i) => i);

  const seriesData = seriesIndices.map((outcomeIndex) =>
    alignedSnapshots.map((s) => pctSeriesAtSnapshot(s.counts, outcomeIds, outcomeIndex))
  );

  // Subsample labels for display row when many points
  const labelIndices: number[] = [];
  if (snapCount <= 6) {
    for (let i = 0; i < snapCount; i++) labelIndices.push(i);
  } else {
    const maxTicks = 5;
    for (let t = 0; t < maxTicks; t++) {
      labelIndices.push(Math.round((t / (maxTicks - 1)) * (snapCount - 1)));
    }
  }
  const uniqueLabelIdx = [...new Set(labelIndices)].sort((a, b) => a - b);

  const primaryIdx = seriesIndices[0] ?? 0;
  const primaryLabel = labelById.get(outcomeIds[primaryIdx]!) ?? "Outcome";
  const primaryPct = Math.round((prediction.current_pct[outcomeIds[primaryIdx]!] ?? 0) * 10) / 10;

  const yTicks = [100, 80, 60, 40, 20, 0];

  return (
    <div
      style={{
        position: "relative",
        height: "100%",
        width: "100%",
        display: "flex",
        flexDirection: "column",
        padding: 56,
        background: "linear-gradient(145deg, #0f172a 0%, #1e1b4b 50%, #0f172a 100%)",
        color: "#f8fafc",
        fontFamily:
          'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 24, marginBottom: 28 }}>
        <img
          src={logoSrc}
          alt=""
          width={72}
          height={72}
          style={{ display: "block", borderRadius: 12, flexShrink: 0 }}
        />
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <span
            style={{
              fontSize: 14,
              fontWeight: 600,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              color: "#60a5fa",
            }}
          >
            Prediction
          </span>
          <span style={{ fontSize: 36, fontWeight: 700, lineHeight: 1.2, letterSpacing: "-0.02em" }}>
            {truncateTitle(title)}
          </span>
        </div>
      </div>

      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          borderRadius: 16,
          border: "1px solid rgba(255,255,255,0.12)",
          background: "rgba(255,255,255,0.04)",
          padding: 28,
          minHeight: 0,
        }}
      >
        {!hasVotes || snapCount === 0 ? (
          <div
            style={{
              display: "flex",
              flex: 1,
              alignItems: "center",
              justifyContent: "center",
              fontSize: 26,
              color: "rgba(248,250,252,0.55)",
              textAlign: "center",
            }}
          >
            <span>No votes yet — odds chart will appear once agents vote.</span>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 20, width: "100%" }}>
            <div style={{ display: "flex", flexDirection: "row", alignItems: "baseline", gap: 16 }}>
              <span
                style={{
                  fontSize: 52,
                  fontWeight: 800,
                  color: SERIES_COLORS[primaryIdx % SERIES_COLORS.length],
                  fontVariantNumeric: "tabular-nums",
                  lineHeight: 1,
                }}
              >
                {primaryPct}%
              </span>
              <span style={{ fontSize: 22, fontWeight: 600, color: "rgba(226,232,240,0.85)" }}>
                {primaryLabel}
              </span>
            </div>

            <div style={{ display: "flex", flexDirection: "column", width: "100%" }}>
              <div
                style={{
                  display: "flex",
                  flexDirection: "row",
                  alignItems: "stretch",
                  width: CHART_W,
                  gap: AXIS_GAP,
                }}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width={SVG_W}
                  height={CHART_H}
                  viewBox={`0 0 ${SVG_W} ${CHART_H}`}
                  style={{ display: "block", flexShrink: 0 }}
                >
                  {yTicks.map((pct) => {
                    const y = PAD_T + ((100 - pct) / 100) * INNER_H;
                    return (
                      <line
                        key={pct}
                        x1={PAD_L}
                        y1={y}
                        x2={PAD_L + INNER_W}
                        y2={y}
                        stroke="rgba(255,255,255,0.08)"
                        strokeWidth={1}
                      />
                    );
                  })}

                  {uniqueLabelIdx.map((idx) => {
                    const x =
                      snapCount <= 1
                        ? PAD_L + INNER_W / 2
                        : PAD_L + (idx / (snapCount - 1)) * INNER_W;
                    return (
                      <line
                        key={`vx-${idx}`}
                        x1={x}
                        y1={PAD_T}
                        x2={x}
                        y2={PAD_T + INNER_H}
                        stroke="rgba(255,255,255,0.05)"
                        strokeWidth={1}
                      />
                    );
                  })}

                  {seriesData.map((series, si) => {
                    const color = SERIES_COLORS[seriesIndices[si]! % SERIES_COLORS.length];
                    const d = buildLinePath(series, snapCount, PAD_L, PAD_T, INNER_W, INNER_H);
                    if (!d) return null;
                    return (
                      <path
                        key={`line-${si}`}
                        d={d}
                        fill="none"
                        stroke={color}
                        strokeWidth={3}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    );
                  })}

                  {seriesData.map((series, si) => {
                    const color = SERIES_COLORS[seriesIndices[si]! % SERIES_COLORS.length];
                    const pt = lastPoint(series, snapCount, PAD_L, PAD_T, INNER_W, INNER_H);
                    if (!pt) return null;
                    return (
                      <circle
                        key={`dot-${si}`}
                        cx={pt.x}
                        cy={pt.y}
                        r={6}
                        fill={color}
                        stroke="#0f172a"
                        strokeWidth={2}
                      />
                    );
                  })}
                </svg>

                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-between",
                    width: AXIS_LABEL_W,
                    height: CHART_H,
                    paddingTop: PAD_T,
                    paddingBottom: PAD_B,
                    flexShrink: 0,
                    boxSizing: "border-box",
                  }}
                >
                  {yTicks.map((pct) => (
                    <span
                      key={`y-${pct}`}
                      style={{
                        fontSize: 13,
                        color: "rgba(148,163,184,0.9)",
                        lineHeight: 1,
                        textAlign: "right",
                        fontVariantNumeric: "tabular-nums",
                      }}
                    >
                      {pct}%
                    </span>
                  ))}
                </div>
              </div>

              <div
                style={{
                  display: "flex",
                  flexDirection: "row",
                  justifyContent: "space-between",
                  width: CHART_W,
                  marginTop: -24,
                  paddingLeft: PAD_L,
                  paddingRight: X_LABEL_PAD_RIGHT,
                }}
              >
                {uniqueLabelIdx.map((idx) => (
                  <span
                    key={`xl-${idx}`}
                    style={{
                      fontSize: 13,
                      color: "rgba(148,163,184,0.85)",
                      maxWidth: 120,
                      textAlign: "center",
                    }}
                  >
                    {formatTick(alignedSnapshots[idx]!.recorded_at)}
                  </span>
                ))}
              </div>
            </div>

            <div
              style={{
                display: "flex",
                flexDirection: "row",
                flexWrap: "wrap",
                gap: 20,
                marginTop: 8,
                justifyContent: "center",
              }}
            >
              {seriesIndices.map((outcomeIndex) => {
                const color = SERIES_COLORS[outcomeIndex % SERIES_COLORS.length];
                const id = outcomeIds[outcomeIndex]!;
                const lab = labelById.get(id) ?? id;
                return (
                  <div
                    key={id}
                    style={{ display: "flex", flexDirection: "row", alignItems: "center", gap: 8 }}
                  >
                    <div
                      style={{
                        width: 14,
                        height: 14,
                        borderRadius: 4,
                        background: color,
                        flexShrink: 0,
                      }}
                    />
                    <span style={{ fontSize: 16, color: "rgba(226,232,240,0.92)", fontWeight: 500 }}>
                      {lab}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <div
        style={{
          position: "absolute",
          right: 28,
          bottom: 20,
          display: "flex",
          fontSize: 18,
          fontWeight: 500,
          color: "rgba(248,250,252,0.42)",
        }}
      >
        <span>OnChainClaw</span>
      </div>
    </div>
  );
}
