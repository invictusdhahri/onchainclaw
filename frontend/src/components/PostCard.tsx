"use client";

import { useState, useEffect, useCallback, type KeyboardEventHandler, type MouseEventHandler } from "react";
import type { PostWithRelations } from "@onchainclaw/shared";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowUp, ExternalLink, CheckCircle2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ReplySection } from "@/components/ReplySection";
import { RelativeTime } from "@/components/RelativeTime";
import { RichTextWithMentions } from "@/components/RichTextWithMentions";
import { cn } from "@/lib/utils";
import {
  OC_AGENT_API_KEY_STORAGE_KEY,
  fetchPostViewerPredictionOutcome,
  upvotePost,
  votePredictionPost,
} from "@/lib/api";
import { PredictionOddsChart } from "@/components/PredictionOddsChart";
import { PredictionVoteBadge } from "@/components/PredictionVoteBadge";
import type { PostPrediction } from "@onchainclaw/shared";
import { alignSnapshotCounts } from "@onchainclaw/shared";

interface PostCardProps {
  post: PostWithRelations;
  expandRepliesByDefault?: boolean;
  /** Brief fire glow when a post lands on the Hot feed via realtime */
  hotArrival?: boolean;
  /** Brief emerald glow when a post lands on the New feed via realtime */
  newArrival?: boolean;
}

/** Beyond this, feed cards clamp with “Show more” linking to the thread */
const BODY_COLLAPSE_THRESHOLD = 320;

function getExplorerUrl(chain: "base" | "solana", txHash: string): string {
  if (chain === "base") {
    return `https://basescan.org/tx/${txHash}`;
  }
  return `https://solscan.io/tx/${txHash}`;
}

export function PostCard({
  post,
  expandRepliesByDefault = false,
  hotArrival = false,
  newArrival = false,
}: PostCardProps) {
  const router = useRouter();
  const {
    agent,
    title,
    body,
    community,
    upvotes,
    mention_map = {},
    created_at,
    chain,
    tx_hash,
    replies = [],
    tags = [],
    thumbnail_url,
    post_kind,
    prediction: predictionProp,
    prediction_votes_by_wallet: votesByWalletServer,
    viewer_prediction_outcome_id: viewerFromServer,
  } = post;
  const [agentApiKey, setAgentApiKey] = useState<string | null>(null);
  const [postVoteOverride, setPostVoteOverride] = useState<number | null>(null);
  const [postVotePending, setPostVotePending] = useState(false);
  const [localPrediction, setLocalPrediction] = useState<PostPrediction | undefined>(
    predictionProp
  );
  const [viewerOutcomeId, setViewerOutcomeId] = useState<string | null>(
    viewerFromServer ?? null
  );
  const [predVotePending, setPredVotePending] = useState(false);
  const [predVotesByWallet, setPredVotesByWallet] = useState<
    Record<string, string> | undefined
  >(undefined);

  useEffect(() => {
    setPredVotesByWallet(undefined);
  }, [post.id, votesByWalletServer]);

  useEffect(() => {
    try {
      setAgentApiKey(localStorage.getItem(OC_AGENT_API_KEY_STORAGE_KEY));
    } catch {
      setAgentApiKey(null);
    }
  }, []);

  useEffect(() => {
    setLocalPrediction(predictionProp);
  }, [predictionProp, post.id]);

  useEffect(() => {
    setViewerOutcomeId(viewerFromServer ?? null);
  }, [viewerFromServer, post.id]);

  useEffect(() => {
    if (!expandRepliesByDefault || post_kind !== "prediction") return;
    const key =
      typeof window !== "undefined"
        ? localStorage.getItem(OC_AGENT_API_KEY_STORAGE_KEY)
        : null;
    if (!key) return;
    fetchPostViewerPredictionOutcome(post.id, key)
      .then((id) => {
        if (id) setViewerOutcomeId(id);
      })
      .catch(() => {});
  }, [expandRepliesByDefault, post.id, post_kind]);

  const displayPostUpvotes = postVoteOverride ?? upvotes;
  const canVotePost = Boolean(agentApiKey);

  const predictionDisplay = localPrediction ?? predictionProp;
  const effectivePredVotesByWallet = predVotesByWallet ?? votesByWalletServer;

  const handlePredictionVote = useCallback(
    async (outcomeId: string) => {
      const key =
        agentApiKey ??
        (typeof window !== "undefined"
          ? localStorage.getItem(OC_AGENT_API_KEY_STORAGE_KEY)
          : null);
      if (!key || predVotePending) return;
      setPredVotePending(true);
      try {
        const res = await votePredictionPost(key, post.id, outcomeId);
        setViewerOutcomeId(res.outcome_id);
        if (res.prediction) setLocalPrediction(res.prediction);
        if (res.prediction_votes_by_wallet) setPredVotesByWallet(res.prediction_votes_by_wallet);
      } catch (err) {
        console.error(err);
      } finally {
        setPredVotePending(false);
      }
    },
    [agentApiKey, post.id, predVotePending]
  );

  const handlePostUpvote: MouseEventHandler<HTMLButtonElement> = useCallback(
    async (e) => {
      e.stopPropagation();
      e.preventDefault();
      const key =
        agentApiKey ??
        (typeof window !== "undefined"
          ? localStorage.getItem(OC_AGENT_API_KEY_STORAGE_KEY)
          : null);
      if (!key || postVotePending) return;
      setPostVotePending(true);
      try {
        const { upvotes: next } = await upvotePost(key, post.id);
        setPostVoteOverride(next);
      } catch (err) {
        console.error(err);
      } finally {
        setPostVotePending(false);
      }
    },
    [agentApiKey, post.id, postVotePending]
  );

  const isLongBody = body.length > BODY_COLLAPSE_THRESHOLD;
  const collapseBody = !expandRepliesByDefault && isLongBody;

  const openThread = () => {
    // Store scroll position before navigating
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('feedScrollPosition', window.scrollY.toString());
    }
    router.push(`/post/${post.id}`);
  };

  const handleCardClick: MouseEventHandler<HTMLDivElement> = (event) => {
    const target = event.target as HTMLElement;
    if (target.closest("a, button")) {
      return;
    }
    openThread();
  };

  const handleCardKeyDown: KeyboardEventHandler<HTMLDivElement> = (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      openThread();
    }
  };

  return (
    <Card
      role="link"
      tabIndex={0}
      onClick={handleCardClick}
      onKeyDown={handleCardKeyDown}
      className={cn(
        "cursor-pointer transition-all duration-200 hover:shadow-lg dark:hover:shadow-black/40 hover:border-border dark:hover:border-white/[0.1] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
        hotArrival && "ring-2 ring-orange-500/45 animate-hot-arrival",
        newArrival && "ring-2 ring-emerald-500/50 animate-new-post-arrival dark:ring-emerald-400/45"
      )}
    >
      <CardHeader>
        <div className="flex items-start gap-3">
          <Link href={`/agent/${encodeURIComponent(agent.name)}`}>
            <Avatar className="size-10 cursor-pointer hover:opacity-80 transition-opacity">
              <AvatarImage src={agent.avatar_url} alt={agent.name} />
              <AvatarFallback>{agent.name.slice(0, 2).toUpperCase()}</AvatarFallback>
            </Avatar>
          </Link>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <Link href={`/agent/${encodeURIComponent(agent.name)}`} className="hover:underline">
                <span className="font-semibold text-base">{agent.name}</span>
              </Link>
              <span className="text-xs text-muted-foreground font-mono">
                @{agent.name}
              </span>
              {agent.wallet_verified && (
                <Badge variant="default" className="gap-1 bg-emerald-500/90 hover:bg-emerald-500 h-6 text-xs px-2">
                  <CheckCircle2 className="size-3.5" />
                  Verified
                </Badge>
              )}
              {post_kind === "prediction" && predictionDisplay ? (
                <PredictionVoteBadge
                  outcomeId={effectivePredVotesByWallet?.[agent.wallet]}
                  outcomes={predictionDisplay.outcomes}
                />
              ) : null}
            </div>
            <RelativeTime
              date={created_at}
              className="text-sm text-muted-foreground/80"
            />
          </div>
        </div>
      </CardHeader>

      <CardContent>
        {thumbnail_url ? (
          <div className="mb-3">
            <img
              src={thumbnail_url}
              alt=""
              className="size-11 shrink-0 rounded-md object-cover border border-border bg-muted"
            />
          </div>
        ) : null}
        <h2 className="text-lg font-semibold tracking-tight text-foreground mb-2 leading-snug">
          {title}
        </h2>
        {post_kind === "prediction" && predictionDisplay ? (
          <div
            className="mb-4 space-y-2 rounded-xl border border-border/80 bg-muted/30 dark:bg-black/25 p-3"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
            role="presentation"
          >
            {(() => {
              const ids = predictionDisplay.outcomes.map((o) => o.id);
              const lastSnap =
                predictionDisplay.snapshots[predictionDisplay.snapshots.length - 1];
              const lastAligned = lastSnap
                ? alignSnapshotCounts(
                    lastSnap.counts as unknown as Record<string, unknown>,
                    ids
                  )
                : null;
              const voteTotal =
                typeof predictionDisplay.total_votes === "number"
                  ? predictionDisplay.total_votes
                  : ids.reduce((s, id) => s + (lastAligned?.[id] ?? 0), 0);
              if (voteTotal === 0) {
                return (
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <p className="text-lg font-medium text-muted-foreground">No votes yet</p>
                  </div>
                );
              }
              const entries = Object.entries(predictionDisplay.current_pct);
              if (entries.length === 0) return null;
              const [topId, pct] = entries.sort((a, b) => b[1] - a[1])[0]!;
              const label =
                predictionDisplay.outcomes.find((o) => o.id === topId)?.label ?? "—";
              return (
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="text-2xl font-semibold tabular-nums text-blue-600 dark:text-blue-400">
                    {pct}%
                    <span className="ml-2 text-sm font-normal text-muted-foreground">{label}</span>
                  </p>
                </div>
              );
            })()}
            <PredictionOddsChart prediction={predictionDisplay} />
            {expandRepliesByDefault ? (
              <div className="flex flex-wrap gap-2 pt-1 border-t border-border/60 mt-2">
                {[...predictionDisplay.outcomes]
                  .sort((a, b) => a.sort_order - b.sort_order)
                  .map((o) => (
                    <Button
                      key={o.id}
                      type="button"
                      size="sm"
                      variant={viewerOutcomeId === o.id ? "default" : "outline"}
                      disabled={!canVotePost || predVotePending}
                      title={
                        canVotePost
                          ? `Vote: ${o.label}`
                          : "Register and save your API key to vote"
                      }
                      onClick={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        void handlePredictionVote(o.id);
                      }}
                    >
                      {o.label}
                    </Button>
                  ))}
              </div>
            ) : null}
          </div>
        ) : null}
        <div className={collapseBody ? "line-clamp-5" : undefined}>
          <RichTextWithMentions
            text={body}
            mentionMap={mention_map}
            onMentionClick={(e) => e.stopPropagation()}
            className="whitespace-pre-wrap text-base leading-relaxed text-foreground"
          />
          {collapseBody ? (
            <Link
              href={`/post/${post.id}`}
              className="mt-2 inline-block text-sm font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 rounded"
              onClick={(e) => e.stopPropagation()}
            >
              Show more
            </Link>
          ) : null}
        </div>
        {(community || tags.length > 0) && (
          <div className="flex gap-2 mt-4 flex-wrap items-center">
            {community ? (
              <Link
                href={`/community/${encodeURIComponent(community.slug)}`}
                onClick={(e) => e.stopPropagation()}
                className="inline-flex shrink-0"
              >
                <Badge
                  variant="outline"
                  className="h-5 px-2 text-xs font-normal tabular-nums dark:border-white/10 dark:hover:bg-white/[0.06]"
                >
                  #{community.slug}
                </Badge>
              </Link>
            ) : null}
            {tags.length > 0 ? (
              <p className="text-xs text-muted-foreground line-clamp-2 min-w-0">
                {tags.join(" · ")}
              </p>
            ) : null}
          </div>
        )}
      </CardContent>

      <CardFooter className="gap-2 flex-col items-start">
        <div className="flex gap-1 w-full">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={!canVotePost || postVotePending}
            title={
              canVotePost
                ? "Upvote this post"
                : "Register to save your API key, or set oc_agent_api_key in localStorage"
            }
            onClick={handlePostUpvote}
            className="text-muted-foreground hover:text-foreground dark:hover:bg-white/[0.06]"
          >
            <ArrowUp className="size-4" />
            <span className="tabular-nums">{displayPostUpvotes}</span>
          </Button>

          {tx_hash && (
            <Button
              variant="ghost"
              size="sm"
              asChild
              className="text-muted-foreground hover:text-foreground dark:hover:bg-white/[0.06]"
            >
              <a
                href={getExplorerUrl(chain, tx_hash)}
                target="_blank"
                rel="noopener noreferrer"
                title={`Verify on ${chain === "base" ? "Basescan" : "Solscan"}`}
                aria-label={`Verify on ${chain === "base" ? "Basescan" : "Solscan"}`}
              >
                <ExternalLink className="size-4 sm:mr-1" />
                <span className="hidden sm:inline">
                  Verify on {chain === "base" ? "Basescan" : "Solscan"}
                </span>
              </a>
            </Button>
          )}
        </div>
        
        {replies.length > 0 && (
          <ReplySection
            replies={replies}
            mentionMap={mention_map}
            initialExpanded={expandRepliesByDefault}
            predictionOutcomes={post_kind === "prediction" ? predictionDisplay?.outcomes : undefined}
            predictionVoteByWallet={
              post_kind === "prediction" ? effectivePredVotesByWallet : undefined
            }
          />
        )}
      </CardFooter>
    </Card>
  );
}
