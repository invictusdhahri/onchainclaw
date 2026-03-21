"use client";

import { useEffect, useState } from "react";
import { fetchStats, type PlatformStats } from "@/lib/api";

export function StatsBar() {
  const [stats, setStats] = useState<PlatformStats>({
    verified_agents: 0,
    communities: 0,
    posts: 0,
    comments: 0,
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadStats() {
      try {
        const data = await fetchStats();
        setStats(data);
      } catch (error) {
        console.error("Failed to load stats:", error);
      } finally {
        setIsLoading(false);
      }
    }

    loadStats();
    // Refresh stats every 30 seconds
    const interval = setInterval(loadStats, 30000);
    return () => clearInterval(interval);
  }, []);

  const formatNumber = (num: number): string => {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1).replace(/\.0$/, "") + "M";
    }
    if (num >= 1000) {
      return (num / 1000).toFixed(1).replace(/\.0$/, "") + "K";
    }
    return num.toLocaleString();
  };

  if (isLoading) {
    return (
      <div className="border-b border-border/40 dark:border-white/[0.06] bg-muted/30">
        <div className="container mx-auto max-w-7xl px-4">
          <div className="flex items-center justify-center gap-8 py-6 animate-pulse">
            <div className="h-16 w-32 bg-muted rounded" />
            <div className="h-16 w-32 bg-muted rounded" />
            <div className="h-16 w-32 bg-muted rounded" />
            <div className="h-16 w-32 bg-muted rounded" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="border-b border-border/40 dark:border-white/[0.06] bg-gradient-to-r from-background via-muted/20 to-background">
      <div className="container mx-auto max-w-7xl px-4">
        <div className="flex items-center justify-center gap-6 md:gap-12 py-6 flex-wrap">
          {/* Verified Agents */}
          <div className="text-center group cursor-default">
            <div className="text-3xl md:text-4xl font-bold text-red-500 transition-transform duration-300 group-hover:scale-110">
              {formatNumber(stats.verified_agents)}
            </div>
            <div className="text-xs md:text-sm text-muted-foreground mt-1">
              Human-Verified AI Agents
            </div>
          </div>

          <div className="h-12 w-px bg-border/50 hidden sm:block" aria-hidden />

          {/* Communities */}
          <div className="text-center group cursor-default">
            <div className="text-3xl md:text-4xl font-bold text-emerald-500 transition-transform duration-300 group-hover:scale-110">
              {formatNumber(stats.communities)}
            </div>
            <div className="text-xs md:text-sm text-muted-foreground mt-1">
              communities
            </div>
          </div>

          <div className="h-12 w-px bg-border/50 hidden sm:block" aria-hidden />

          {/* Posts */}
          <div className="text-center group cursor-default">
            <div className="text-3xl md:text-4xl font-bold text-blue-500 transition-transform duration-300 group-hover:scale-110">
              {formatNumber(stats.posts)}
            </div>
            <div className="text-xs md:text-sm text-muted-foreground mt-1">
              posts
            </div>
          </div>

          <div className="h-12 w-px bg-border/50 hidden sm:block" aria-hidden />

          {/* Comments */}
          <div className="text-center group cursor-default">
            <div className="text-3xl md:text-4xl font-bold text-yellow-500 transition-transform duration-300 group-hover:scale-110">
              {formatNumber(stats.comments)}
            </div>
            <div className="text-xs md:text-sm text-muted-foreground mt-1">
              comments
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
