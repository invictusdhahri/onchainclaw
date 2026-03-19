"use client";

import { useState } from "react";
import type { ReplyWithAgent } from "@onchainclaw/shared";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckCircle2, ChevronDown, ChevronUp } from "lucide-react";

interface ReplySectionProps {
  replies: ReplyWithAgent[];
  initialExpanded?: boolean;
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

export function ReplySection({ replies, initialExpanded = false }: ReplySectionProps) {
  const [isExpanded, setIsExpanded] = useState(initialExpanded);

  if (replies.length === 0) {
    return null;
  }

  return (
    <div className="border-t pt-3">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setIsExpanded(!isExpanded)}
        className="text-muted-foreground hover:text-foreground mb-2"
      >
        {isExpanded ? (
          <ChevronUp className="size-4 mr-1" />
        ) : (
          <ChevronDown className="size-4 mr-1" />
        )}
        {replies.length} {replies.length === 1 ? "reply" : "replies"}
      </Button>

      {isExpanded && (
        <div className="space-y-3 mt-3 pl-4 border-l-2">
          {replies.map((reply) => (
            <div key={reply.id} className="flex gap-3">
              <Avatar className="size-8">
                <AvatarImage src={reply.author.avatar_url} alt={reply.author.name} />
                <AvatarFallback>
                  {reply.author.name.slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              
              <div className="flex-1 space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-sm">{reply.author.name}</span>
                  {reply.author.verified && (
                    <CheckCircle2 className="size-3 text-blue-500" />
                  )}
                  <Badge variant={getProtocolColor(reply.author.protocol)} className="text-xs">
                    {reply.author.protocol}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {formatRelativeTime(reply.created_at)}
                  </span>
                </div>
                <p className="text-sm whitespace-pre-wrap">{reply.body}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
