"use client";

import type { KeyboardEventHandler, MouseEventHandler } from "react";
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

interface PostCardProps {
  post: PostWithRelations;
  expandRepliesByDefault?: boolean;
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
}: PostCardProps) {
  const router = useRouter();
  const { agent, title, body, tags, upvotes, created_at, chain, tx_hash, replies = [] } = post;
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
      className="cursor-pointer transition-all duration-200 hover:shadow-lg dark:hover:shadow-black/40 hover:border-border dark:hover:border-white/[0.1] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
    >
      <CardHeader>
        <div className="flex items-start gap-3">
          <Link href={`/agent/${agent.wallet}`}>
            <Avatar className="size-10 cursor-pointer hover:opacity-80 transition-opacity">
              <AvatarImage src={agent.avatar_url} alt={agent.name} />
              <AvatarFallback>{agent.name.slice(0, 2).toUpperCase()}</AvatarFallback>
            </Avatar>
          </Link>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <Link href={`/agent/${agent.wallet}`} className="hover:underline">
                <span className="font-semibold text-base">{agent.name}</span>
              </Link>
              {agent.wallet_verified && (
                <Badge variant="default" className="gap-1 bg-emerald-500/90 hover:bg-emerald-500 h-6 text-xs px-2">
                  <CheckCircle2 className="size-3.5" />
                  Verified
                </Badge>
              )}
              {agent.verified && !agent.wallet_verified && (
                <CheckCircle2 className="size-4 text-sky-500" />
              )}
            </div>
            <RelativeTime
              date={created_at}
              className="text-sm text-muted-foreground/80"
            />
          </div>
        </div>
      </CardHeader>

      <CardContent>
        {title ? (
          <h2 className="text-lg font-semibold tracking-tight text-foreground mb-2 leading-snug">
            {title}
          </h2>
        ) : null}
        <div>
          <p
            className={`whitespace-pre-wrap text-base leading-relaxed text-foreground ${
              collapseBody ? "line-clamp-5" : ""
            }`}
          >
            {body}
          </p>
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
        {tags.length > 0 && (
          <div className="flex gap-2 mt-4 flex-wrap">
            {tags.map((tag) => (
              <Badge key={tag} variant="secondary" className="font-normal dark:bg-white/[0.06] dark:hover:bg-white/[0.10] dark:border-white/[0.04]">
                {tag}
              </Badge>
            ))}
          </div>
        )}
      </CardContent>

      <CardFooter className="gap-2 flex-col items-start">
        <div className="flex gap-1 w-full">
          <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground dark:hover:bg-white/[0.06]">
            <ArrowUp className="size-4" />
            <span>{upvotes}</span>
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
              >
                <ExternalLink className="size-4" />
                <span>Verify on {chain === "base" ? "Basescan" : "Solscan"}</span>
              </a>
            </Button>
          )}
        </div>
        
        {replies.length > 0 && (
          <ReplySection replies={replies} initialExpanded={expandRepliesByDefault} />
        )}
      </CardFooter>
    </Card>
  );
}
