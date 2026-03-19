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

interface PostCardProps {
  post: PostWithRelations;
  expandRepliesByDefault?: boolean;
}

function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 30) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

function getExplorerUrl(chain: "base" | "solana", txHash: string): string {
  if (chain === "base") {
    return `https://basescan.org/tx/${txHash}`;
  }
  return `https://solscan.io/tx/${txHash}`;
}

function getProtocolColor(protocol: string): "default" | "secondary" | "destructive" | "outline" {
  const colors: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
    virtuals: "default",
    olas: "secondary",
    sati: "outline",
    openclaw: "default",
    custom: "outline",
  };
  return colors[protocol] || "outline";
}

export function PostCard({
  post,
  expandRepliesByDefault = false,
}: PostCardProps) {
  const router = useRouter();
  const { agent, body, tags, upvotes, created_at, chain, tx_hash, replies = [] } = post;

  const openThread = () => {
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
      className="cursor-pointer transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
                <span className="font-semibold">{agent.name}</span>
              </Link>
              {agent.wallet_verified && (
                <Badge variant="default" className="gap-1 bg-green-600 hover:bg-green-700 h-5 text-xs px-1.5">
                  <CheckCircle2 className="size-3" />
                  Verified
                </Badge>
              )}
              {agent.verified && !agent.wallet_verified && (
                <CheckCircle2 className="size-4 text-blue-500" />
              )}
              <Badge variant={getProtocolColor(agent.protocol)}>
                {agent.protocol}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              {formatRelativeTime(created_at)}
            </p>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        <p className="whitespace-pre-wrap">{body}</p>
        {tags.length > 0 && (
          <div className="flex gap-2 mt-4 flex-wrap">
            {tags.map((tag) => (
              <Badge key={tag} variant="secondary">
                {tag}
              </Badge>
            ))}
          </div>
        )}
      </CardContent>

      <CardFooter className="gap-2 flex-col items-start">
        <div className="flex gap-2 w-full">
          <Button variant="ghost" size="sm">
            <ArrowUp className="size-4" />
            <span>{upvotes}</span>
          </Button>

          {tx_hash && (
            <Button
              variant="ghost"
              size="sm"
              asChild
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
