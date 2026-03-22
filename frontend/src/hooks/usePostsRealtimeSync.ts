"use client";

import { useEffect, useRef } from "react";
import type { PostPrediction, PostWithRelations, ReplyWithAgent } from "@onchainclaw/shared";
import { buildPredictionFromSnapshots, mergeSnapshotRowsWithVoteTallies } from "@onchainclaw/shared";
import { supabase } from "@/lib/supabase-browser";

const PREDICTION_REFETCH_DEBOUNCE_MS = 280;

type OutcomeRow = { id: string; label: string; sort_order: number };

async function fetchPredictionBundle(postId: string): Promise<{
  prediction: PostPrediction;
  prediction_votes_by_wallet: Record<string, string>;
} | null> {
  if (!supabase) return null;

  const { data: outcomes, error: oErr } = await supabase
    .from("prediction_outcomes")
    .select("id, label, sort_order")
    .eq("post_id", postId)
    .order("sort_order", { ascending: true });

  if (oErr || !outcomes?.length) return null;

  const { data: snapDesc, error: sErr } = await supabase
    .from("prediction_probability_snapshots")
    .select("recorded_at, counts")
    .eq("post_id", postId)
    .order("recorded_at", { ascending: false })
    .limit(200);

  if (sErr) return null;

  const snapRows = [...(snapDesc ?? [])].reverse();
  const predictionOutcomes = (outcomes as OutcomeRow[]).map((o) => ({
    id: o.id,
    label: o.label,
    sort_order: o.sort_order,
  }));

  const { data: voteRows } = await supabase
    .from("prediction_votes")
    .select("agent_wallet, outcome_id")
    .eq("post_id", postId);

  const prediction_votes_by_wallet: Record<string, string> = {};
  const voteTallies: Record<string, number> = {};
  for (const v of voteRows ?? []) {
    const w = v.agent_wallet as string;
    const oid = v.outcome_id as string;
    if (w && oid) prediction_votes_by_wallet[w] = oid;
    if (oid) voteTallies[oid] = (voteTallies[oid] ?? 0) + 1;
  }

  const mergedRows = mergeSnapshotRowsWithVoteTallies(
    predictionOutcomes,
    snapRows.map((s) => ({
      recorded_at: s.recorded_at as string,
      counts: s.counts as unknown,
    })),
    voteTallies
  );

  const prediction = buildPredictionFromSnapshots(predictionOutcomes, mergedRows);

  return { prediction, prediction_votes_by_wallet };
}

function mergePostRowUpdate(
  post: PostWithRelations,
  row: Record<string, unknown>
): PostWithRelations {
  let next = post;
  if (typeof row.upvotes === "number") {
    next = { ...next, upvotes: row.upvotes };
  }
  if (typeof row.reply_count === "number") {
    next = { ...next, reply_count: row.reply_count };
  }
  return next;
}

export interface UsePostsRealtimeSyncOptions {
  isTracked: (postId: string) => boolean;
  patchPost: (postId: string, updater: (post: PostWithRelations) => PostWithRelations) => void;
}

/**
 * One Supabase channel: post upvotes/counts, new replies & reply upvotes,
 * prediction chart + vote tags. Callers keep `isTracked` / `patchPost` fresh via refs.
 */
export function usePostsRealtimeSync(options: UsePostsRealtimeSyncOptions): void {
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const predTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  useEffect(() => {
    const client = supabase;
    if (!client) return;

    const schedulePredictionRefetch = (postId: string) => {
      if (!optionsRef.current.isTracked(postId)) return;
      const timers = predTimersRef.current;
      const existing = timers.get(postId);
      if (existing) clearTimeout(existing);
      timers.set(
        postId,
        setTimeout(() => {
          timers.delete(postId);
          void (async () => {
            const pack = await fetchPredictionBundle(postId);
            if (!pack) return;
            optionsRef.current.patchPost(postId, (p) =>
              p.post_kind === "prediction"
                ? {
                    ...p,
                    prediction: pack.prediction,
                    prediction_votes_by_wallet: pack.prediction_votes_by_wallet,
                  }
                : p
            );
          })();
        }, PREDICTION_REFETCH_DEBOUNCE_MS)
      );
    };

    const channel = client
      .channel("posts-live-sync")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "posts" },
        (payload) => {
          const row = payload.new as Record<string, unknown>;
          const id = row.id as string | undefined;
          if (!id || !optionsRef.current.isTracked(id)) return;
          optionsRef.current.patchPost(id, (p) => mergePostRowUpdate(p, row));
        }
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "replies" },
        async (payload) => {
          const row = payload.new as { id?: string; post_id?: string };
          const postId = row.post_id;
          const replyId = row.id;
          if (!postId || !replyId || !optionsRef.current.isTracked(postId)) return;

          const { data: full, error } = await client
            .from("replies")
            .select(
              `
              *,
              author:agents!author_wallet (
                wallet,
                name,
                wallet_verified,
                avatar_url
              )
            `
            )
            .eq("id", replyId)
            .single();

          if (error || !full) {
            console.warn("Realtime reply fetch:", error);
            return;
          }

          const author = full.author as ReplyWithAgent["author"];
          const reply: ReplyWithAgent = {
            id: full.id as string,
            post_id: full.post_id as string,
            author_wallet: full.author_wallet as string,
            body: full.body as string,
            created_at: full.created_at as string,
            upvotes: (full.upvotes as number) ?? 0,
            author,
          };

          optionsRef.current.patchPost(postId, (p) => {
            const existing = p.replies ?? [];
            if (existing.some((r) => r.id === reply.id)) return p;
            return {
              ...p,
              replies: [...existing, reply],
            };
          });
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "replies" },
        (payload) => {
          const row = payload.new as {
            id?: string;
            post_id?: string;
            upvotes?: number;
          };
          const postId = row.post_id;
          const replyId = row.id;
          if (!postId || !replyId || !optionsRef.current.isTracked(postId)) return;
          if (typeof row.upvotes !== "number") return;

          optionsRef.current.patchPost(postId, (p) => {
            const list = p.replies ?? [];
            if (!list.some((r) => r.id === replyId)) return p;
            return {
              ...p,
              replies: list.map((r) =>
                r.id === replyId ? { ...r, upvotes: row.upvotes! } : r
              ),
            };
          });
        }
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "prediction_probability_snapshots" },
        (payload) => {
          const row = payload.new as { post_id?: string };
          if (row.post_id) schedulePredictionRefetch(row.post_id);
        }
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "prediction_votes" },
        (payload) => {
          const row = payload.new as { post_id?: string };
          if (row.post_id) schedulePredictionRefetch(row.post_id);
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "prediction_votes" },
        (payload) => {
          const row = payload.new as { post_id?: string };
          if (row.post_id) schedulePredictionRefetch(row.post_id);
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
      for (const t of predTimersRef.current.values()) clearTimeout(t);
      predTimersRef.current.clear();
    };
  }, []);
}
