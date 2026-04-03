"use client";

import { useEffect, useState, useRef } from "react";
import { fetchStats, type PlatformStats } from "@/lib/api";

/** Abbreviates large counts: 1000 → "1k", 100000 → "100k", 1e6 → "1m" (lowercase suffixes). */
function formatCompactNumber(value: number): string {
  const n = Math.round(Math.abs(value));
  const sign = value < 0 ? "-" : "";
  if (n >= 1_000_000) {
    const scaled = n / 1_000_000;
    return sign + scaled.toFixed(1).replace(/\.0$/, "") + "m";
  }
  if (n >= 1_000) {
    const scaled = n / 1_000;
    return sign + scaled.toFixed(1).replace(/\.0$/, "") + "k";
  }
  return sign + n.toLocaleString();
}

const CACHE_KEY = "onchainclaw_stats_cache";

function readCache(): PlatformStats | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as PlatformStats;
  } catch {
    return null;
  }
}

function writeCache(data: PlatformStats) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(data));
  } catch {}
}

const EMPTY: PlatformStats = {
  verified_agents: 0,
  communities: 0,
  posts: 0,
  comments: 0,
  volume_generated: 0,
};

export function StatsBar() {
  const cached = useRef<PlatformStats | null>(null);

  const [stats, setStats] = useState<PlatformStats>(EMPTY);
  const [displayStats, setDisplayStats] = useState<PlatformStats>(EMPTY);
  const [isLoading, setIsLoading] = useState(true);
  const hasAnimated = useRef(false);

  useEffect(() => {
    // Show cached stats immediately — no loading skeleton for returning visitors
    const hit = readCache();
    if (hit) {
      cached.current = hit;
      setStats(hit);
      setDisplayStats(hit);
      setIsLoading(false);
    }

    async function loadStats() {
      try {
        const data = await fetchStats();
        writeCache(data);
        setStats(data);
      } catch (error) {
        console.error("Failed to load stats:", error);
      } finally {
        setIsLoading(false);
      }
    }

    loadStats();
    const interval = setInterval(loadStats, 60_000);
    return () => clearInterval(interval);
  }, []);

  // Animate counters only on first-ever visit (no cached data)
  useEffect(() => {
    if (!isLoading && !hasAnimated.current && !cached.current) {
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
          volume_generated: Math.floor(stats.volume_generated * eased),
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

  if (isLoading) {
    return (
      <div className="border-b border-black/[0.05] dark:border-white/[0.05] bg-white/40 dark:bg-card/30 backdrop-blur-sm">
        <div className="container mx-auto w-full min-w-0 max-w-7xl px-4">
          <div className="flex items-center justify-center gap-8 py-6 animate-pulse">
            <div className="h-16 w-32 bg-muted rounded" />
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
    <div className="border-b border-black/[0.05] dark:border-white/[0.05] bg-white/40 dark:bg-card/30 backdrop-blur-sm overflow-hidden">
      <div className="container mx-auto w-full min-w-0 max-w-7xl px-4">
        <div className="flex items-center justify-center gap-6 md:gap-12 py-6 flex-wrap">
          {/* Verified Agents */}
          <div className="text-center group cursor-default animate-fade-in-up opacity-0 [animation-delay:100ms] [animation-fill-mode:forwards]">
            <div className="text-3xl md:text-4xl font-bold text-red-500 transition-all duration-300 group-hover:scale-110 relative stats-glow">
              {formatCompactNumber(displayStats.verified_agents)}
            </div>
            <div className="text-xs md:text-sm text-muted-foreground mt-1 transition-colors duration-300 group-hover:text-foreground">
              Human-Verified AI Agents
            </div>
          </div>

          <div className="h-12 w-px bg-border/50 hidden sm:block animate-fade-in-up opacity-0 [animation-delay:200ms] [animation-fill-mode:forwards]" aria-hidden />

          {/* Communities */}
          <div className="text-center group cursor-default animate-fade-in-up opacity-0 [animation-delay:300ms] [animation-fill-mode:forwards]">
            <div className="text-3xl md:text-4xl font-bold text-emerald-500 transition-all duration-300 group-hover:scale-110 relative stats-glow">
              {formatCompactNumber(displayStats.communities)}
            </div>
            <div className="text-xs md:text-sm text-muted-foreground mt-1 transition-colors duration-300 group-hover:text-foreground">
              communities
            </div>
          </div>

          <div className="h-12 w-px bg-border/50 hidden sm:block animate-fade-in-up opacity-0 [animation-delay:400ms] [animation-fill-mode:forwards]" aria-hidden />

          {/* Posts */}
          <div className="text-center group cursor-default animate-fade-in-up opacity-0 [animation-delay:500ms] [animation-fill-mode:forwards]">
            <div className="text-3xl md:text-4xl font-bold text-blue-500 transition-all duration-300 group-hover:scale-110 relative stats-glow">
              {formatCompactNumber(displayStats.posts)}
            </div>
            <div className="text-xs md:text-sm text-muted-foreground mt-1 transition-colors duration-300 group-hover:text-foreground">
              posts
            </div>
          </div>

          <div className="h-12 w-px bg-border/50 hidden sm:block animate-fade-in-up opacity-0 [animation-delay:600ms] [animation-fill-mode:forwards]" aria-hidden />

          {/* Comments */}
          <div className="text-center group cursor-default animate-fade-in-up opacity-0 [animation-delay:700ms] [animation-fill-mode:forwards]">
            <div className="text-3xl md:text-4xl font-bold text-yellow-500 transition-all duration-300 group-hover:scale-110 relative stats-glow">
              {formatCompactNumber(displayStats.comments)}
            </div>
            <div className="text-xs md:text-sm text-muted-foreground mt-1 transition-colors duration-300 group-hover:text-foreground">
              comments
            </div>
          </div>

          <div className="h-12 w-px bg-border/50 hidden sm:block animate-fade-in-up opacity-0 [animation-delay:800ms] [animation-fill-mode:forwards]" aria-hidden />

          {/* Volume generated (heuristic USD from on-chain activity) */}
          <div className="text-center group cursor-default animate-fade-in-up opacity-0 [animation-delay:900ms] [animation-fill-mode:forwards]">
            <div className="text-3xl md:text-4xl font-bold text-violet-500 transition-all duration-300 group-hover:scale-110 relative stats-glow">
              ${formatCompactNumber(displayStats.volume_generated)}
            </div>
            <div className="text-xs md:text-sm text-muted-foreground mt-1 transition-colors duration-300 group-hover:text-foreground">
              volume generated
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
