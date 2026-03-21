"use client";

import { useEffect, useState, useRef } from "react";
import type { ActivityWithAgent } from "@onchainclaw/shared";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ExternalLink, TrendingUp, TrendingDown, Send, ArrowLeftRight, Activity } from "lucide-react";
import Link from "next/link";
import { fetchActivities } from "@/lib/api";
import { RelativeTime } from "@/components/RelativeTime";
import { supabase } from "@/lib/supabase-browser";

interface ActivityTickerProps {
  initialActivities?: ActivityWithAgent[];
}

function getActionIcon(action: string) {
  switch (action) {
    case "buy":
      return <TrendingUp className="size-3.5 text-emerald-500" />;
    case "sell":
      return <TrendingDown className="size-3.5 text-rose-500" />;
    case "send":
      return <Send className="size-3.5 text-sky-500" />;
    case "swap":
      return <ArrowLeftRight className="size-3.5 text-violet-500" />;
    default:
      return <Activity className="size-3.5 text-muted-foreground" />;
  }
}

function getActionStyle(action: string): string {
  switch (action) {
    case "buy":
      return "border-l-emerald-500/70 bg-emerald-500/[0.04] dark:bg-emerald-500/[0.06] hover:bg-emerald-500/[0.08] dark:hover:bg-emerald-500/[0.10]";
    case "sell":
      return "border-l-rose-500/70 bg-rose-500/[0.04] dark:bg-rose-500/[0.06] hover:bg-rose-500/[0.08] dark:hover:bg-rose-500/[0.10]";
    case "send":
      return "border-l-sky-500/70 bg-sky-500/[0.04] dark:bg-sky-500/[0.06] hover:bg-sky-500/[0.08] dark:hover:bg-sky-500/[0.10]";
    case "swap":
      return "border-l-violet-500/70 bg-violet-500/[0.04] dark:bg-violet-500/[0.06] hover:bg-violet-500/[0.08] dark:hover:bg-violet-500/[0.10]";
    default:
      return "border-l-border bg-muted/20 hover:bg-muted/40";
  }
}

function formatActionText(activity: ActivityWithAgent): string {
  const amount = activity.amount > 0 ? `$${activity.amount.toFixed(2)}` : "";
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
  const [activities, setActivities] = useState<ActivityWithAgent[]>(
    initialActivities.slice(0, 5)
  );
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newTopId, setNewTopId] = useState<string | null>(null);
  const previousTopIdRef = useRef<string | null>(
    initialActivities.length > 0 ? initialActivities[0].id : null
  );

  const refreshActivities = async () => {
    try {
      const data = await fetchActivities({ limit: 5 });
      const newActivities = data.activities.slice(0, 5);
      
      if (newActivities.length > 0) {
        const newTop = newActivities[0].id;
        const oldTop = previousTopIdRef.current;
        
        if (oldTop !== null && newTop !== oldTop) {
          setNewTopId(newTop);
          setTimeout(() => setNewTopId(null), 500);
        }
        
        previousTopIdRef.current = newTop;
      }
      
      setActivities(newActivities);
    } catch (err) {
      console.error("Failed to refresh activities:", err);
    }
  };

  useEffect(() => {
    if (initialActivities.length === 0) {
      setIsLoading(true);
      fetchActivities({ limit: 5 })
        .then((data) => {
          const initial = data.activities.slice(0, 5);
          setActivities(initial);
          if (initial.length > 0) {
            previousTopIdRef.current = initial[0].id;
          }
        })
        .catch((err) => {
          setError(err instanceof Error ? err.message : "Failed to load activity");
          console.error("Failed to fetch activities:", err);
        })
        .finally(() => setIsLoading(false));
    }
  }, [initialActivities]);

  useEffect(() => {
    if (supabase) {
      const channel = supabase
        .channel("activities-changes")
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "activities",
          },
          () => {
            refreshActivities();
          }
        )
        .subscribe();

      return () => {
        channel.unsubscribe();
      };
    } else {
      const pollInterval = setInterval(() => {
        refreshActivities();
      }, 10000);

      return () => clearInterval(pollInterval);
    }
  }, []);

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2 text-muted-foreground">
            <Activity className="size-4" />
            Live Activity
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 p-3 rounded-lg">
                <Skeleton className="size-7 rounded-full" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-3.5 w-20" />
                  <Skeleton className="h-3 w-28" />
                </div>
                <Skeleton className="h-3 w-10" />
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
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2 text-muted-foreground">
            <Activity className="size-4" />
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
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium flex items-center gap-2 text-muted-foreground">
            <Activity className="size-4" />
            Live Activity
          </CardTitle>
          <span className="live-dot" title="Live" />
        </div>
        <p className="text-xs text-muted-foreground/60">Real-time on-chain actions</p>
      </CardHeader>
      <CardContent>
        <div className="space-y-1.5">
          {activities.map((activity, index) => (
            <div
              key={activity.id}
              className={`flex items-center gap-3 p-2.5 rounded-lg border-l-[3px] transition-all duration-200 ${getActionStyle(activity.action)} ${
                index === 0 && newTopId === activity.id ? "animate-bounce-in" : ""
              }`}
            >
              <Link href={`/agent/${activity.agent.wallet}`}>
                <Avatar className="size-7 cursor-pointer hover:opacity-80 transition-opacity">
                  <AvatarImage src={activity.agent.avatar_url} alt={activity.agent.name} />
                  <AvatarFallback className="text-[10px]">{activity.agent.name.slice(0, 2).toUpperCase()}</AvatarFallback>
                </Avatar>
              </Link>
              
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <Link href={`/agent/${activity.agent.wallet}`} className="hover:underline">
                    <span className="font-medium text-xs">{activity.agent.name}</span>
                  </Link>
                  {activity.agent.wallet_verified && (
                    <Badge variant="default" className="gap-0.5 bg-emerald-500/90 hover:bg-emerald-500 h-3.5 text-[9px] px-1 rounded-sm">
                      ✓
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-1 text-xs">
                  {getActionIcon(activity.action)}
                  <span className="text-muted-foreground truncate">
                    {formatActionText(activity)}
                  </span>
                  {activity.token_image && (
                    <img 
                      src={activity.token_image} 
                      alt={activity.token_symbol || "Token"} 
                      className="size-3.5 rounded-full ring-1 ring-border/20"
                    />
                  )}
                </div>
              </div>
              
              <div className="flex items-center gap-1.5 flex-shrink-0">
                <RelativeTime
                  date={activity.created_at}
                  variant="compact"
                  className="text-[10px] text-muted-foreground/60 whitespace-nowrap"
                />
                <a
                  href={getActivityExplorerUrl(activity.tx_hash)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-muted-foreground/50 hover:text-foreground transition-colors"
                >
                  <ExternalLink className="size-3" />
                </a>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
