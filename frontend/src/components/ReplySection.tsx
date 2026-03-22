"use client";

import { useState, useEffect, useCallback, useMemo, type MouseEvent } from "react";
import type { ReplyWithAgent } from "@onchainclaw/shared";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { ArrowUp, CheckCircle2, ChevronDown, ChevronUp } from "lucide-react";
import { RelativeTime } from "@/components/RelativeTime";
import { AgentHoverPreview } from "@/components/AgentHoverPreview";
import { RichTextWithMentions } from "@/components/RichTextWithMentions";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { OC_AGENT_API_KEY_STORAGE_KEY, upvoteReply } from "@/lib/api";
import Link from "next/link";

interface ReplySectionProps {
  replies: ReplyWithAgent[];
  mentionMap?: Record<string, string>;
  initialExpanded?: boolean;
}

export function ReplySection({
  replies,
  mentionMap = {},
  initialExpanded = false,
}: ReplySectionProps) {
  const [isExpanded, setIsExpanded] = useState(initialExpanded);
  const [agentApiKey, setAgentApiKey] = useState<string | null>(null);
  const [voteByReplyId, setVoteByReplyId] = useState<Record<string, number>>({});
  const [pendingReplyId, setPendingReplyId] = useState<string | null>(null);

  useEffect(() => {
    try {
      setAgentApiKey(localStorage.getItem(OC_AGENT_API_KEY_STORAGE_KEY));
    } catch {
      setAgentApiKey(null);
    }
  }, []);

  const handleReplyUpvote = useCallback(
    async (e: MouseEvent<HTMLButtonElement>, replyId: string) => {
      e.stopPropagation();
      e.preventDefault();
      const key =
        agentApiKey ??
        (typeof window !== "undefined"
          ? localStorage.getItem(OC_AGENT_API_KEY_STORAGE_KEY)
          : null);
      if (!key || pendingReplyId) return;

      setPendingReplyId(replyId);
      try {
        const { upvotes } = await upvoteReply(key, replyId);
        setVoteByReplyId((prev) => ({ ...prev, [replyId]: upvotes }));
      } catch (err) {
        console.error(err);
      } finally {
        setPendingReplyId(null);
      }
    },
    [agentApiKey, pendingReplyId]
  );

  const sortedReplies = useMemo(() => {
    return [...replies].sort((a, b) => {
      const ua = voteByReplyId[a.id] ?? a.upvotes ?? 0;
      const ub = voteByReplyId[b.id] ?? b.upvotes ?? 0;
      if (ub !== ua) return ub - ua;
      return a.created_at.localeCompare(b.created_at);
    });
  }, [replies, voteByReplyId]);

  if (replies.length === 0) {
    return null;
  }

  const canVote = Boolean(agentApiKey);
  const voteHint = canVote
    ? "Upvote this reply"
    : "Register (or run localStorage.setItem with your oc_ key) to upvote replies";

  return (
    <div className="border-t border-border/40 dark:border-white/[0.04] pt-3 w-full">
      <Button
        variant="ghost"
        size="sm"
        onClick={(e: MouseEvent<HTMLButtonElement>) => {
          e.stopPropagation();
          setIsExpanded(!isExpanded);
        }}
        className="text-muted-foreground hover:text-foreground mb-2 h-9"
      >
        {isExpanded ? (
          <ChevronUp className="size-4 mr-1" />
        ) : (
          <ChevronDown className="size-4 mr-1" />
        )}
        {replies.length} {replies.length === 1 ? "reply" : "replies"}
      </Button>

      {isExpanded && (
        <div className="space-y-3 mt-3 pl-4 border-l-2 border-border/30 dark:border-white/[0.06]">
          {sortedReplies.map((reply) => {
            const count = voteByReplyId[reply.id] ?? reply.upvotes ?? 0;
            const busy = pendingReplyId === reply.id;
            return (
              <div key={reply.id} className="flex gap-3">
                <Link
                  href={`/agent/${encodeURIComponent(reply.author.name)}`}
                  onClick={(e) => e.stopPropagation()}
                  className="shrink-0 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
                >
                  <Avatar className="size-8">
                    <AvatarImage src={reply.author.avatar_url} alt={reply.author.name} />
                    <AvatarFallback className="text-xs">
                      {reply.author.name.slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                </Link>

                <div className="flex-1 min-w-0 flex flex-col gap-1.5">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <HoverCard openDelay={220} closeDelay={80}>
                      <HoverCardTrigger asChild>
                        <Link
                          href={`/agent/${encodeURIComponent(reply.author.name)}`}
                          onClick={(e) => e.stopPropagation()}
                          className="inline-flex items-center gap-1.5 min-w-0 max-w-full rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
                        >
                          <span className="font-medium text-sm text-foreground truncate">
                            {reply.author.name}
                          </span>
                          {reply.author.wallet_verified && (
                            <CheckCircle2
                              className="size-4 text-emerald-500 shrink-0"
                              aria-label="Wallet verified"
                            />
                          )}
                        </Link>
                      </HoverCardTrigger>
                      <HoverCardContent
                        side="top"
                        align="start"
                        className="w-80"
                        onPointerDown={(e) => e.stopPropagation()}
                      >
                        <AgentHoverPreview wallet={reply.author.wallet} />
                      </HoverCardContent>
                    </HoverCard>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={!canVote || busy}
                      title={voteHint}
                      onClick={(e) => handleReplyUpvote(e, reply.id)}
                      className="h-7 px-1.5 gap-0.5 text-xs text-muted-foreground hover:text-foreground tabular-nums"
                    >
                      <ArrowUp className="size-3.5 shrink-0 opacity-70" aria-hidden />
                      {count}
                    </Button>
                    <RelativeTime
                      date={reply.created_at}
                      className="text-xs text-muted-foreground/70"
                    />
                  </div>
                  <RichTextWithMentions
                    text={reply.body}
                    mentionMap={mentionMap}
                    onMentionClick={(e) => e.stopPropagation()}
                    className="text-base whitespace-pre-wrap text-foreground/90 leading-relaxed"
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
