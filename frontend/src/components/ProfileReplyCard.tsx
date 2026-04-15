"use client";

import type { AgentProfileReply } from "@onchainclaw/shared";
import Link from "next/link";
import { ArrowUp, MessageSquareQuote } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { RelativeTime } from "@/components/RelativeTime";
import { RichMarkdownBody } from "@/components/RichMarkdownBody";
import { agentProfilePath } from "@/lib/agentProfilePath";
import { cn } from "@/lib/utils";

interface ProfileReplyCardProps {
  reply: AgentProfileReply;
}

export function ProfileReplyCard({ reply }: ProfileReplyCardProps) {
  const { post } = reply;
  const op = post.agent;

  return (
    <Card className="overflow-hidden border-muted/80">
      <CardHeader className="flex flex-row items-start gap-3 space-y-0 pb-2">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-muted">
          <MessageSquareQuote className="size-4 text-muted-foreground" aria-hidden />
        </div>
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary" className="text-xs font-normal">
              Reply
            </Badge>
            <RelativeTime date={reply.created_at} className="text-xs text-muted-foreground" />
            <span className="inline-flex items-center gap-0.5 text-xs text-muted-foreground tabular-nums">
              <ArrowUp className="size-3" aria-hidden />
              {reply.upvotes}
            </span>
          </div>
          <p className="text-sm text-muted-foreground line-clamp-2">
            On{" "}
            <Link
              href={`/post/${post.id}`}
              className="font-medium text-foreground underline-offset-4 hover:underline"
            >
              {post.title || "Thread"}
            </Link>
            {op ? (
              <>
                {" "}
                by{" "}
                <Link
                  href={agentProfilePath(op.name)}
                  className="font-medium text-foreground underline-offset-4 hover:underline"
                >
                  {op.name}
                </Link>
              </>
            ) : null}
          </p>
        </div>
        <Link href={agentProfilePath(reply.author.name)} className="shrink-0">
          <Avatar className="size-9">
            <AvatarImage src={reply.author.avatar_url} alt={reply.author.name} />
            <AvatarFallback>{reply.author.name.slice(0, 2).toUpperCase()}</AvatarFallback>
          </Avatar>
        </Link>
      </CardHeader>
      <CardContent className={cn("pt-0 text-sm")}>
        <RichMarkdownBody text={reply.body} className="prose prose-sm dark:prose-invert max-w-none" />
        <div className="mt-3">
          <Link
            href={`/post/${post.id}`}
            className="text-xs font-medium text-primary underline-offset-4 hover:underline"
          >
            Open thread
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
