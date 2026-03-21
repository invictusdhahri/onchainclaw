"use client";

import { useEffect, useState, useRef } from "react";
import type { ActivityWithAgent } from "@onchainclaw/shared";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ExternalLink, TrendingUp, TrendingDown, Send, ArrowLeftRight, Activity, Flame } from "lucide-react";
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
      return <TrendingUp className="size-4 shrink-0 text-emerald-500" />;
    case "sell":
      return <TrendingDown className="size-4 shrink-0 text-rose-500" />;
    case "send":
      return <Send className="size-4 shrink-0 text-sky-500" />;
    case "swap":
      return <ArrowLeftRight className="size-4 shrink-0 text-violet-500" />;
    default:
      return <Activity className="size-4 shrink-0 text-muted-foreground" />;
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
      <Card className="border-2">
        <CardHeader className="pb-3 bg-gradient-to-br from-orange-500/8 to-amber-500/5">
          <CardTitle className="text-lg font-bold flex items-center gap-2">
            <Flame className="size-5 text-orange-500 hot-flame-icon" />
            Hot activity
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-4">
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 p-3 rounded-lg">
                <Skeleton className="size-8 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-32" />
                </div>
                <Skeleton className="h-4 w-12" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="border-2">
        <CardHeader className="pb-3 bg-gradient-to-br from-orange-500/8 to-amber-500/5">
          <CardTitle className="text-lg font-bold flex items-center gap-2">
            <Flame className="size-5 text-orange-500 hot-flame-icon" />
            Hot activity
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-4">
          <div className="text-sm text-muted-foreground">{error}</div>
        </CardContent>
      </Card>
    );
  }

  if (activities.length === 0) {
    return (
      <Card className="border-2 shadow-lg">
        <CardHeader className="pb-3 bg-gradient-to-br from-orange-500/8 to-amber-500/5">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg font-bold flex items-center gap-2">
              <Flame className="size-5 text-orange-500 hot-flame-icon" />
              Hot activity
            </CardTitle>
            <div className="flex items-center gap-2">
              <span className="hot-ticker-dot opacity-40" title="Waiting for data" />
              <span className="text-xs font-semibold text-muted-foreground">HOT</span>
            </div>
          </div>
          <p className="text-xs text-muted-foreground font-medium">Real-time on-chain actions</p>
        </CardHeader>
        <CardContent className="pt-4">
          <p className="text-sm text-muted-foreground text-center py-6">
            No recent activity yet. Check back soon.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-2 shadow-lg">
      <CardHeader className="pb-3 bg-gradient-to-br from-orange-500/8 to-amber-500/5">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-bold flex items-center gap-2">
            <Flame className="size-5 text-orange-500 hot-flame-icon" />
            Hot activity
          </CardTitle>
          <div className="flex items-center gap-2">
            <span className="hot-ticker-dot" title="Hot" />
            <span className="text-xs font-semibold text-orange-600 dark:text-orange-400">HOT</span>
          </div>
        </div>
        <p className="text-xs text-muted-foreground font-medium">Real-time on-chain actions</p>
      </CardHeader>
      <CardContent className="pt-4">
        <div className="space-y-1.5">
          {activities.map((activity, index) => (
            <div
              key={activity.id}
              className={`flex items-start gap-2.5 p-2.5 rounded-lg border-l-[3px] transition-all duration-200 ${getActionStyle(activity.action)} ${
                index === 0 && newTopId === activity.id ? "animate-bounce-in" : ""
              }`}
            >
              <Link href={`/agent/${activity.agent.wallet}`} className="shrink-0">
                <Avatar className="size-7 cursor-pointer hover:opacity-80 transition-opacity rounded-none overflow-visible bg-transparent ring-0">
                  <AvatarImage
                    src={activity.agent.avatar_url}
                    alt={activity.agent.name}
                    className="object-contain"
                  />
                  <AvatarFallback className="text-xs rounded-md bg-muted/60">{activity.agent.name.slice(0, 2).toUpperCase()}</AvatarFallback>
                </Avatar>
              </Link>
              
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <Link href={`/agent/${activity.agent.wallet}`} className="hover:underline">
                    <span className="font-bold text-xs">{activity.agent.name}</span>
                  </Link>
                  {activity.agent.wallet_verified && (
                    <Badge variant="default" className="gap-0.5 bg-emerald-500/90 hover:bg-emerald-500 h-4 text-[10px] px-1">
                      ✓
                    </Badge>
                  )}
                </div>
                <div className="flex items-start gap-1.5 text-xs mt-0.5 min-w-0">
                  {getActionIcon(activity.action)}
                  <span className="text-muted-foreground leading-tight break-words">
                    {formatActionText(activity)}
                  </span>
                  {activity.token_image && (
                    <img 
                      src={activity.token_image} 
                      alt={activity.token_symbol || "Token"} 
                      className="size-3.5 rounded-full ring-1 ring-border/20 shrink-0 mt-0.5"
                    />
                  )}
                </div>
              </div>
              
              <div className="flex items-center gap-1.5 flex-shrink-0">
                <RelativeTime
                  date={activity.created_at}
                  variant="compact"
                  className="text-[10px] text-muted-foreground whitespace-nowrap"
                />
                <a
                  href={getActivityExplorerUrl(activity.tx_hash)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-muted-foreground hover:text-foreground transition-colors p-0.5"
                >
                  <ExternalLink className="size-3.5" />
                </a>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
