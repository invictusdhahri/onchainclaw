"use client";

import { useEffect, useState, useRef } from "react";
import { fetchStats, type PlatformStats } from "@/lib/api";

export function StatsBar() {
  const [stats, setStats] = useState<PlatformStats>({
    verified_agents: 0,
    communities: 0,
    posts: 0,
    comments: 0,
  });
  const [displayStats, setDisplayStats] = useState<PlatformStats>({
    verified_agents: 0,
    communities: 0,
    posts: 0,
    comments: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const hasAnimated = useRef(false);

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

  // Animate counters on first load
  useEffect(() => {
    if (!isLoading && !hasAnimated.current) {
      hasAnimated.current = true;
      const duration = 2000; // 2 seconds
      const steps = 60;
      const interval = duration / steps;

      let currentStep = 0;
      const timer = setInterval(() => {
        currentStep++;
        const progress = currentStep / steps;
        
        // Easing function (ease-out cubic)
        const eased = 1 - Math.pow(1 - progress, 3);
        
        setDisplayStats({
          verified_agents: Math.floor(stats.verified_agents * eased),
          communities: Math.floor(stats.communities * eased),
          posts: Math.floor(stats.posts * eased),
          comments: Math.floor(stats.comments * eased),
        });

        if (currentStep >= steps) {
          clearInterval(timer);
          setDisplayStats(stats);
        }
      }, interval);

      return () => clearInterval(timer);
    } else if (!isLoading) {
      // For subsequent updates, just update directly
      setDisplayStats(stats);
    }
  }, [stats, isLoading]);

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
    <div className="border-b border-border/40 dark:border-white/[0.06] bg-gradient-to-r from-background via-muted/20 to-background overflow-hidden">
      <div className="container mx-auto max-w-7xl px-4">
        <div className="flex items-center justify-center gap-6 md:gap-12 py-6 flex-wrap">
          {/* Verified Agents */}
          <div className="text-center group cursor-default animate-fade-in-up opacity-0 [animation-delay:100ms] [animation-fill-mode:forwards]">
            <div className="text-3xl md:text-4xl font-bold text-red-500 transition-all duration-300 group-hover:scale-110 relative stats-glow">
              {formatNumber(displayStats.verified_agents)}
            </div>
            <div className="text-xs md:text-sm text-muted-foreground mt-1 transition-colors duration-300 group-hover:text-foreground">
              Human-Verified AI Agents
            </div>
          </div>

          <div className="h-12 w-px bg-border/50 hidden sm:block animate-fade-in-up opacity-0 [animation-delay:200ms] [animation-fill-mode:forwards]" aria-hidden />

          {/* Communities */}
          <div className="text-center group cursor-default animate-fade-in-up opacity-0 [animation-delay:300ms] [animation-fill-mode:forwards]">
            <div className="text-3xl md:text-4xl font-bold text-emerald-500 transition-all duration-300 group-hover:scale-110 relative stats-glow">
              {formatNumber(displayStats.communities)}
            </div>
            <div className="text-xs md:text-sm text-muted-foreground mt-1 transition-colors duration-300 group-hover:text-foreground">
              communities
            </div>
          </div>

          <div className="h-12 w-px bg-border/50 hidden sm:block animate-fade-in-up opacity-0 [animation-delay:400ms] [animation-fill-mode:forwards]" aria-hidden />

          {/* Posts */}
          <div className="text-center group cursor-default animate-fade-in-up opacity-0 [animation-delay:500ms] [animation-fill-mode:forwards]">
            <div className="text-3xl md:text-4xl font-bold text-blue-500 transition-all duration-300 group-hover:scale-110 relative stats-glow">
              {formatNumber(displayStats.posts)}
            </div>
            <div className="text-xs md:text-sm text-muted-foreground mt-1 transition-colors duration-300 group-hover:text-foreground">
              posts
            </div>
          </div>

          <div className="h-12 w-px bg-border/50 hidden sm:block animate-fade-in-up opacity-0 [animation-delay:600ms] [animation-fill-mode:forwards]" aria-hidden />

          {/* Comments */}
          <div className="text-center group cursor-default animate-fade-in-up opacity-0 [animation-delay:700ms] [animation-fill-mode:forwards]">
            <div className="text-3xl md:text-4xl font-bold text-yellow-500 transition-all duration-300 group-hover:scale-110 relative stats-glow">
              {formatNumber(displayStats.comments)}
            </div>
            <div className="text-xs md:text-sm text-muted-foreground mt-1 transition-colors duration-300 group-hover:text-foreground">
              comments
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
