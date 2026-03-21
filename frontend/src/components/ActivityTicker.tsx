"use client";

import { useEffect, useState } from "react";
import type { ActivityWithAgent } from "@onchainclaw/shared";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ExternalLink, TrendingUp, TrendingDown, Send, ArrowLeftRight, Activity } from "lucide-react";
import Link from "next/link";
import { fetchActivities } from "@/lib/api";
import { RelativeTime } from "@/components/RelativeTime";

interface ActivityTickerProps {
  initialActivities?: ActivityWithAgent[];
}

function getActionIcon(action: string) {
  switch (action) {
    case "buy":
      return <TrendingUp className="size-4 text-green-600" />;
    case "sell":
      return <TrendingDown className="size-4 text-red-600" />;
    case "send":
      return <Send className="size-4 text-blue-600" />;
    case "swap":
      return <ArrowLeftRight className="size-4 text-purple-600" />;
    default:
      return <Activity className="size-4 text-gray-600" />;
  }
}

function getActionColor(action: string): string {
  switch (action) {
    case "buy":
      return "border-l-green-600";
    case "sell":
      return "border-l-red-600";
    case "send":
      return "border-l-blue-600";
    case "swap":
      return "border-l-purple-600";
    default:
      return "border-l-gray-600";
  }
}

function formatActionText(activity: ActivityWithAgent): string {
  const amount = activity.amount > 0 ? `$${activity.amount.toFixed(2)}` : "";
  // Use token symbol if available, otherwise truncate mint address
  const token = activity.token_symbol 
    ? ` ${activity.token_symbol}` 
    : activity.token 
      ? ` ${activity.token.slice(0, 8)}...` 
      : "";
  
  switch (activity.action) {
    case "buy":
      return `bought${token} ${amount}`;
    case "sell":
      return `sold${token} ${amount}`;
    case "send":
      return `sent ${amount}${token}`;
    case "swap":
      return `swapped ${amount}${token}`;
    case "receive":
      return `received ${amount}${token}`;
    default:
      return `${activity.action} ${amount}${token}`;
  }
}

function getActivityExplorerUrl(txHash: string): string {
  return `https://solscan.io/tx/${txHash}`;
}

export function ActivityTicker({ initialActivities = [] }: ActivityTickerProps) {
  const [activities, setActivities] = useState<ActivityWithAgent[]>(initialActivities);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (initialActivities.length === 0) {
      setIsLoading(true);
      fetchActivities({ limit: 10 })
        .then((data) => setActivities(data.activities))
        .catch((err) => {
          setError(err instanceof Error ? err.message : "Failed to load activity");
          console.error("Failed to fetch activities:", err);
        })
        .finally(() => setIsLoading(false));
    }
  }, [initialActivities]);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Activity className="size-5" />
            Live Activity
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 p-3 rounded-lg border bg-muted/20">
                <Skeleton className="size-8 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-3 w-32" />
                </div>
                <Skeleton className="h-3 w-12" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Activity className="size-5" />
            Live Activity
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-muted-foreground">{error}</div>
        </CardContent>
      </Card>
    );
  }

  if (activities.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Activity className="size-5" />
          Live Activity
        </CardTitle>
        <p className="text-sm text-muted-foreground">Real-time on-chain actions</p>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {activities.map((activity) => (
            <div
              key={activity.id}
              className={`flex items-center gap-3 p-3 rounded-lg border-l-4 bg-muted/40 hover:bg-muted/60 transition-colors ${getActionColor(activity.action)}`}
            >
              <Link href={`/agent/${activity.agent.wallet}`}>
                <Avatar className="size-8 cursor-pointer hover:opacity-80 transition-opacity">
                  <AvatarImage src={activity.agent.avatar_url} alt={activity.agent.name} />
                  <AvatarFallback>{activity.agent.name.slice(0, 2).toUpperCase()}</AvatarFallback>
                </Avatar>
              </Link>
              
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <Link href={`/agent/${activity.agent.wallet}`} className="hover:underline">
                    <span className="font-semibold text-sm">{activity.agent.name}</span>
                  </Link>
                  {activity.agent.wallet_verified && (
                    <Badge variant="default" className="gap-1 bg-green-600 hover:bg-green-700 h-4 text-xs px-1">
                      ✓
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-1.5 text-sm">
                  {getActionIcon(activity.action)}
                  <span className="text-muted-foreground">
                    {formatActionText(activity)}
                  </span>
                  {activity.token_image && (
                    <img 
                      src={activity.token_image} 
                      alt={activity.token_symbol || "Token"} 
                      className="size-4 rounded-full"
                    />
                  )}
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                <RelativeTime
                  date={activity.created_at}
                  variant="compact"
                  className="text-xs text-muted-foreground whitespace-nowrap"
                />
                <a
                  href={getActivityExplorerUrl(activity.tx_hash)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  <ExternalLink className="size-4" />
                </a>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
