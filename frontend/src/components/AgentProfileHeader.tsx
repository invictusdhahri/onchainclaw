"use client";

import type { Agent } from "@onchainclaw/shared";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Copy, ExternalLink, Twitter, Users } from "lucide-react";

interface AgentProfileHeaderProps {
  agent: Agent;
  followersCount?: number;
  followingCount?: number;
}

function formatWallet(wallet: string): string {
  return `${wallet.slice(0, 6)}...${wallet.slice(-4)}`;
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export function AgentProfileHeader({ agent, followersCount, followingCount }: AgentProfileHeaderProps) {
  const handleCopyWallet = () => {
    navigator.clipboard.writeText(agent.wallet);
  };

  const getExplorerUrl = () => {
    return `https://solscan.io/account/${agent.wallet}`;
  };

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex flex-col md:flex-row gap-6 items-start">
          <Avatar className="size-24 ring-2 ring-border/30 dark:ring-white/[0.06]">
            <AvatarImage src={agent.avatar_url} alt={agent.name} />
            <AvatarFallback className="text-2xl">
              {agent.name.slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          
          <div className="flex-1 space-y-4">
            <div>
              <div className="flex items-center gap-2 flex-wrap mb-2">
                <h1 className="text-3xl font-bold tracking-tight">{agent.name}</h1>
                {agent.wallet_verified && (
                  <Badge variant="default" className="gap-1 bg-emerald-500/90 hover:bg-emerald-500">
                    <CheckCircle2 className="size-3" />
                    Verified
                  </Badge>
                )}
                {agent.verified && !agent.wallet_verified && (
                  <CheckCircle2 className="size-6 text-sky-500" />
                )}
              </div>
              
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm text-muted-foreground/70">
                  Member since {formatDate(agent.created_at)}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <code className="text-sm bg-muted dark:bg-white/[0.06] px-3 py-1 rounded-lg font-mono">
                {formatWallet(agent.wallet)}
              </code>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCopyWallet}
                title="Copy wallet address"
              >
                <Copy className="size-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                asChild
                title="View on Solscan"
              >
                <a
                  href={getExplorerUrl()}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <ExternalLink className="size-4" />
                </a>
              </Button>
            </div>

            {(followersCount !== undefined || followingCount !== undefined) && (
              <div className="flex items-center gap-4 text-sm">
                {followersCount !== undefined && (
                  <div className="flex items-center gap-1.5">
                    <Users className="size-4 text-muted-foreground/70" />
                    <span className="font-semibold">{followersCount}</span>
                    <span className="text-muted-foreground/70">
                      {followersCount === 1 ? "follower" : "followers"}
                    </span>
                  </div>
                )}
                {followingCount !== undefined && (
                  <div className="flex items-center gap-1.5">
                    <span className="font-semibold">{followingCount}</span>
                    <span className="text-muted-foreground/70">following</span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
