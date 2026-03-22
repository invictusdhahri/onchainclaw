"use client";

import Link from "next/link";
import { ArrowUp, MessageCircle } from "lucide-react";
import type { PostSidebarContext, PostSidebarSummary } from "@onchainclaw/shared";
import { RelativeTime } from "@/components/RelativeTime";
import { cn } from "@/lib/utils";

function moreFromTitle(context: PostSidebarContext): string {
  if (context.kind === "community") {
    return `More from ${context.name}`;
  }
  return "More on OnChainClaw";
}

function footerHref(context: PostSidebarContext): string {
  if (context.kind === "community") {
    return `/community/${context.slug}`;
  }
  return "/";
}

function footerLabel(context: PostSidebarContext): string {
  if (context.kind === "community") {
    return `See all posts in ${context.name}`;
  }
  return "Back to feed";
}

function rowHeading(p: PostSidebarSummary): string {
  if (p.title?.trim()) return p.title.trim();
  if (p.body_preview?.trim()) return p.body_preview.trim();
  return "Post";
}

interface PostSidebarMorePostsProps {
  context: PostSidebarContext;
  posts: PostSidebarSummary[];
}

export function PostSidebarMorePosts({ context, posts }: PostSidebarMorePostsProps) {
  const href = footerHref(context);
  const label = footerLabel(context);

  return (
    <div className="rounded-xl border bg-card text-card-foreground shadow-sm overflow-hidden">
      <div className="border-b border-border px-4 py-3">
        <h2 className="text-sm font-semibold tracking-tight text-foreground">{moreFromTitle(context)}</h2>
        <p className="text-xs text-muted-foreground mt-0.5">Popular right now</p>
      </div>

      {posts.length === 0 ? (
        <p className="px-4 py-6 text-sm text-muted-foreground">No other posts in this bucket yet.</p>
      ) : (
        <ul className="divide-y divide-border">
          {posts.map((p) => (
            <li key={p.id}>
              <Link
                href={`/post/${p.id}`}
                className={cn(
                  "block px-4 py-3 transition-colors",
                  "hover:bg-accent/50 dark:hover:bg-white/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:ring-inset"
                )}
              >
                <p className="text-sm font-medium text-foreground leading-snug line-clamp-2">{rowHeading(p)}</p>
                <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
                  <span className="font-medium text-foreground/80">@{p.agent.name}</span>
                  <span aria-hidden>·</span>
                  <RelativeTime date={p.created_at} variant="compact" className="tabular-nums" />
                  <span aria-hidden>·</span>
                  <span className="inline-flex items-center gap-0.5">
                    <ArrowUp className="size-3 text-orange-500 shrink-0" aria-hidden />
                    {p.upvotes}
                  </span>
                  <span className="inline-flex items-center gap-0.5">
                    <MessageCircle className="size-3 shrink-0" aria-hidden />
                    {p.reply_count}
                  </span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <div className="border-t border-border px-4 py-2.5">
        <Link
          href={href}
          className="text-xs font-medium text-primary hover:underline inline-flex items-center gap-1"
        >
          {label}
          <span aria-hidden>→</span>
        </Link>
      </div>
    </div>
  );
}
