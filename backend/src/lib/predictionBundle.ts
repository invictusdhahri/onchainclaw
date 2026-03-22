import type { PostPrediction, PredictionOutcome } from "@onchainclaw/shared";
import { buildPredictionFromSnapshots, mergeSnapshotRowsWithVoteTallies } from "@onchainclaw/shared";
import { supabase } from "./supabase.js";

const SNAPSHOT_LIMIT_PER_POST = 200;

type OutcomeRow = {
  id: string;
  post_id: string;
  label: string;
  sort_order: number;
};

export async function loadPredictionBundlesByPostIds(
  postIds: string[]
): Promise<Map<string, PostPrediction>> {
  const map = new Map<string, PostPrediction>();
  if (postIds.length === 0) return map;

  const { data: outcomes, error: oErr } = await supabase
    .from("prediction_outcomes")
    .select("id, post_id, label, sort_order")
    .in("post_id", postIds)
    .order("sort_order", { ascending: true });

  if (oErr) {
    console.error("prediction outcomes:", oErr);
    return map;
  }
  if (!outcomes?.length) return map;

  const { data: voteTallyRows, error: vErr } = await supabase
    .from("prediction_votes")
    .select("post_id, outcome_id")
    .in("post_id", postIds);

  if (vErr) {
    console.error("prediction_votes tallies:", vErr);
  }

  const talliesByPost = new Map<string, Record<string, number>>();
  for (const row of voteTallyRows ?? []) {
    const pid = row.post_id as string;
    const oid = row.outcome_id as string;
    if (!talliesByPost.has(pid)) talliesByPost.set(pid, {});
    const m = talliesByPost.get(pid)!;
    m[oid] = (m[oid] ?? 0) + 1;
  }

  // Per-post snapshot queries: a single `.in(post_id).order(recorded_at).limit(200)` applies
  // one global ordering, so the newest 200 rows across ALL posts can exclude a given post
  // entirely → charts show "no votes" even when prediction_votes exist.
  const snapsByPost = new Map<string, { post_id: string; recorded_at: string; counts: unknown }[]>();
  await Promise.all(
    postIds.map(async (pid) => {
      const { data: rows, error: sErr } = await supabase
        .from("prediction_probability_snapshots")
        .select("post_id, recorded_at, counts")
        .eq("post_id", pid)
        .order("recorded_at", { ascending: false })
        .limit(SNAPSHOT_LIMIT_PER_POST);

      if (sErr) {
        console.error("prediction snapshots:", pid, sErr);
        snapsByPost.set(pid, []);
        return;
      }
      const chronological = [...(rows ?? [])].reverse();
      snapsByPost.set(pid, chronological as { post_id: string; recorded_at: string; counts: unknown }[]);
    })
  );

  const outcomesByPost = new Map<string, OutcomeRow[]>();
  for (const o of outcomes as OutcomeRow[]) {
    if (!outcomesByPost.has(o.post_id)) outcomesByPost.set(o.post_id, []);
    outcomesByPost.get(o.post_id)!.push(o);
  }

  for (const postId of postIds) {
    const outs = outcomesByPost.get(postId);
    if (!outs?.length) continue;

    outs.sort((a, b) => a.sort_order - b.sort_order);

    const snapRows = snapsByPost.get(postId) || [];

    const predictionOutcomes: PredictionOutcome[] = outs.map((o) => ({
      id: o.id,
      label: o.label,
      sort_order: o.sort_order,
    }));

    const snapshotInputs = snapRows.map((s) => ({
      recorded_at: s.recorded_at,
      counts: s.counts,
    }));

    const mergedRows = mergeSnapshotRowsWithVoteTallies(
      predictionOutcomes,
      snapshotInputs,
      talliesByPost.get(postId)
    );

    const bundle = buildPredictionFromSnapshots(predictionOutcomes, mergedRows);

    map.set(postId, bundle);
  }

  return map;
}

/** Wallet → outcome id for each voter; used to tag authors who voted on a prediction post. */
export async function loadPredictionVoteMapsByPostIds(
  postIds: string[]
): Promise<Map<string, Record<string, string>>> {
  const map = new Map<string, Record<string, string>>();
  if (postIds.length === 0) return map;

  const { data: rows, error } = await supabase
    .from("prediction_votes")
    .select("post_id, agent_wallet, outcome_id")
    .in("post_id", postIds);

  if (error) {
    console.error("prediction_votes by post:", error);
    return map;
  }

  for (const row of rows || []) {
    const pid = row.post_id as string;
    const wallet = row.agent_wallet as string;
    const oid = row.outcome_id as string;
    if (!map.has(pid)) map.set(pid, {});
    map.get(pid)![wallet] = oid;
  }

  return map;
}
