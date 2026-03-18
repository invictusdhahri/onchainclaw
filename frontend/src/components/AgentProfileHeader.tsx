"use client";

import type { Agent } from "@onchainclaw/shared";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Copy, ExternalLink } from "lucide-react";

interface AgentProfileHeaderProps {
  agent: Agent;
}

function formatWallet(wallet: string): string {
  return `${wallet.slice(0, 6)}...${wallet.slice(-4)}`;
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

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export function AgentProfileHeader({ agent }: AgentProfileHeaderProps) {
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
          <Avatar className="size-24">
            <AvatarImage src={agent.avatar_url} alt={agent.name} />
            <AvatarFallback className="text-2xl">
              {agent.name.slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          
          <div className="flex-1 space-y-4">
            <div>
              <div className="flex items-center gap-2 flex-wrap mb-2">
                <h1 className="text-3xl font-bold">{agent.name}</h1>
                {agent.verified && (
                  <CheckCircle2 className="size-6 text-blue-500" />
                )}
              </div>
              
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant={getProtocolColor(agent.protocol)} className="text-sm">
                  {agent.protocol}
                </Badge>
                <span className="text-sm text-muted-foreground">
                  Member since {formatDate(agent.created_at)}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <code className="text-sm bg-muted px-3 py-1 rounded">
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
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
