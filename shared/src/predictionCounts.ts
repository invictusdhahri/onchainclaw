import type { PostPrediction, PredictionOutcome, PredictionSnapshotPoint } from "./types.js";

/**
 * Parse a `counts` value from PostgREST (object, or occasionally double-encoded JSON string).
 */
export function parseJsonbCountsField(raw: unknown): Record<string, unknown> {
  if (raw == null) return {};
  if (typeof raw === "string") {
    try {
      const p = JSON.parse(raw) as unknown;
      if (p && typeof p === "object" && !Array.isArray(p)) {
        return p as Record<string, unknown>;
      }
    } catch {
      return {};
    }
    return {};
  }
  if (typeof raw === "object" && !Array.isArray(raw)) {
    return raw as Record<string, unknown>;
  }
  return {};
}

function resolveOutcomeIdForKey(key: string, outcomeIds: string[]): string | undefined {
  const trimmed = key.trim();
  if (!trimmed) return undefined;
  const nk = trimmed.toLowerCase();
  const nkCompact = nk.replace(/-/g, "");
  for (const id of outcomeIds) {
    const il = id.toLowerCase();
    if (il === nk) return id;
    if (il.replace(/-/g, "") === nkCompact) return id;
  }
  return undefined;
}

/**
 * Map snapshot JSON keys onto canonical `prediction_outcomes.id` strings so vote totals match the DB.
 */
export function alignSnapshotCounts(
  raw: Record<string, unknown>,
  outcomeIds: string[]
): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const id of outcomeIds) counts[id] = 0;

  for (const [key, val] of Object.entries(raw)) {
    let n: number;
    if (typeof val === "number" && Number.isFinite(val)) {
      n = val;
    } else if (typeof val === "string") {
      n = Number(val);
      if (!Number.isFinite(n)) continue;
    } else {
      continue;
    }

    const resolved = resolveOutcomeIdForKey(key, outcomeIds);
    if (resolved) counts[resolved] += n;
  }
  return counts;
}

/**
 * Build `PostPrediction` from DB rows with aligned counts and derived `total_votes` / `current_pct`.
 */
export function buildPredictionFromSnapshots(
  outcomes: PredictionOutcome[],
  snapshotRows: { recorded_at: string; counts: unknown }[]
): PostPrediction {
  const outcomeIds = outcomes.map((o) => o.id);
  const snapshots: PredictionSnapshotPoint[] = snapshotRows.map((s) => ({
    recorded_at: s.recorded_at,
    counts: alignSnapshotCounts(parseJsonbCountsField(s.counts), outcomeIds),
  }));

  const last = snapshots[snapshots.length - 1]?.counts ?? {};
  let total_votes = 0;
  for (const id of outcomeIds) {
    total_votes += last[id] ?? 0;
  }

  const current_pct: Record<string, number> = {};
  if (total_votes > 0) {
    for (const id of outcomeIds) {
      current_pct[id] = Math.round(((last[id] ?? 0) / total_votes) * 1000) / 10;
    }
  }

  return {
    outcomes,
    total_votes,
    current_pct,
    snapshots,
  };
}

/**
 * If snapshot rows parse to zero total votes (missing rows, JSON key drift, etc.) but
 * `prediction_votes` tallies exist, append one synthetic snapshot so charts and headers match DB.
 */
export function mergeSnapshotRowsWithVoteTallies(
  outcomes: PredictionOutcome[],
  snapshotRows: { recorded_at: string; counts: unknown }[],
  voteTallies: Record<string, number> | undefined
): { recorded_at: string; counts: unknown }[] {
  if (!voteTallies || Object.keys(voteTallies).length === 0) return snapshotRows;

  const rawSum = Object.values(voteTallies).reduce(
    (a, v) => a + Math.max(0, Math.floor(Number(v) || 0)),
    0
  );
  if (rawSum === 0) return snapshotRows;

  const fromSnaps = buildPredictionFromSnapshots(outcomes, snapshotRows);
  if (fromSnaps.total_votes > 0) return snapshotRows;

  const outcomeIds = outcomes.map((o) => o.id);
  const counts: Record<string, number> = {};
  for (const id of outcomeIds) {
    counts[id] = Math.max(0, Math.floor(voteTallies[id] ?? 0));
  }

  return [
    ...snapshotRows,
    { recorded_at: new Date().toISOString(), counts },
  ];
}

/** Re-align a prediction object from API or Realtime (fixes UI when keys in `counts` do not match outcome ids). */
export function reconcilePredictionCounts(prediction: PostPrediction): PostPrediction {
  return buildPredictionFromSnapshots(prediction.outcomes, prediction.snapshots);
}
