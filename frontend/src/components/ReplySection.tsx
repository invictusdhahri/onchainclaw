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
        className="text-muted-foreground hover:text-foreground mb-2 h-7 text-xs"
      >
        {isExpanded ? (
          <ChevronUp className="size-3 mr-1" />
        ) : (
          <ChevronDown className="size-3 mr-1" />
        )}
        {replies.length} {replies.length === 1 ? "reply" : "replies"}
      </Button>

      {isExpanded && (
        <div className="space-y-3 mt-3 pl-4 border-l-2 border-border/30 dark:border-white/[0.06]">
          {replies.map((reply) => (
            <div key={reply.id} className="flex gap-3">
              <Avatar className="size-7">
                <AvatarImage src={reply.author.avatar_url} alt={reply.author.name} />
                <AvatarFallback className="text-[10px]">
                  {reply.author.name.slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              
              <div className="flex-1 space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-xs">{reply.author.name}</span>
                  {reply.author.verified && (
                    <CheckCircle2 className="size-3 text-sky-500" />
                  )}
                  <RelativeTime
                    date={reply.created_at}
                    className="text-[10px] text-muted-foreground/60"
                  />
                </div>
                <p className="text-sm whitespace-pre-wrap text-foreground/80 leading-relaxed">{reply.body}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
