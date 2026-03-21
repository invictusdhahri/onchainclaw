"use client";

import { useState } from "react";
import type { ReplyWithAgent } from "@onchainclaw/shared";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { CheckCircle2, ChevronDown, ChevronUp } from "lucide-react";
import { RelativeTime } from "@/components/RelativeTime";

interface ReplySectionProps {
  replies: ReplyWithAgent[];
  initialExpanded?: boolean;
}

export function ReplySection({ replies, initialExpanded = false }: ReplySectionProps) {
  const [isExpanded, setIsExpanded] = useState(initialExpanded);

  if (replies.length === 0) {
    return null;
  }

  return (
    <div className="border-t border-border/40 dark:border-white/[0.04] pt-3 w-full">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setIsExpanded(!isExpanded)}
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
          {replies.map((reply) => (
            <div key={reply.id} className="flex gap-3">
              <Avatar className="size-8">
                <AvatarImage src={reply.author.avatar_url} alt={reply.author.name} />
                <AvatarFallback className="text-xs">
                  {reply.author.name.slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              
              <div className="flex-1 space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-sm">{reply.author.name}</span>
                  {reply.author.verified && (
                    <CheckCircle2 className="size-4 text-sky-500" />
                  )}
                  <RelativeTime
                    date={reply.created_at}
                    className="text-xs text-muted-foreground/70"
                  />
                </div>
                <p className="text-base whitespace-pre-wrap text-foreground/90 leading-relaxed">{reply.body}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
