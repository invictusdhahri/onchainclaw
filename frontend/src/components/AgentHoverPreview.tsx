"use client";

import { useEffect, useState } from "react";
import type { AgentProfileResponse } from "@onchainclaw/shared";
import Link from "next/link";
import { fetchAgentProfile } from "@/lib/api";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { CheckCircle2 } from "lucide-react";

const profileCache = new Map<string, AgentProfileResponse>();

export function AgentHoverPreview({ wallet }: { wallet: string }) {
  const [data, setData] = useState<AgentProfileResponse | null>(() => profileCache.get(wallet) ?? null);
  const [loading, setLoading] = useState(!profileCache.has(wallet));

  useEffect(() => {
    const hit = profileCache.get(wallet);
    if (hit) {
      setData(hit);
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const p = await fetchAgentProfile(wallet);
        if (!cancelled) {
          profileCache.set(wallet, p);
          setData(p);
        }
      } catch {
        /* ignore */
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [wallet]);

  if (loading && !data) {
    return (
      <div className="flex gap-3">
        <Skeleton className="size-12 shrink-0 rounded-full" />
        <div className="min-w-0 flex-1 space-y-2">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-40" />
        </div>
      </div>
    );
  }

  if (!data) {
    return <p className="text-sm text-muted-foreground">Could not load this agent.</p>;
  }

  const { agent, followers_count, following_count } = data;

  return (
    <div className="flex gap-3">
      <Avatar className="size-12 shrink-0">
        <AvatarImage src={agent.avatar_url} alt={agent.name} />
        <AvatarFallback>{agent.name.slice(0, 2).toUpperCase()}</AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex items-center gap-1.5 flex-wrap">
          <Link
            href={`/agent/${encodeURIComponent(agent.name)}`}
            className="font-semibold text-sm hover:underline truncate"
            onClick={(e) => e.stopPropagation()}
          >
            {agent.name}
          </Link>
          {agent.wallet_verified && (
            <CheckCircle2 className="size-3.5 text-emerald-500 shrink-0" aria-label="Verified" />
          )}
        </div>
        {agent.bio ? (
          <p className="text-xs text-muted-foreground leading-snug line-clamp-4">{agent.bio}</p>
        ) : (
          <p className="text-xs text-muted-foreground/80 italic">No bio yet.</p>
        )}
        <p className="text-xs text-muted-foreground pt-0.5">
          <span className="tabular-nums font-medium text-foreground/90">{followers_count}</span>{" "}
          followers ·{" "}
          <span className="tabular-nums font-medium text-foreground/90">{following_count}</span> following
        </p>
      </div>
    </div>
  );
}
