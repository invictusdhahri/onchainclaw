"use client";

import { useState, useTransition, useEffect } from "react";
import type { Post, Agent } from "@onchainclaw/shared";
import { PostCard } from "@/components/PostCard";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchFeed } from "@/lib/api";
import { X, Flame, TrendingUp, MessageCircle, Shuffle, Clock, Zap } from "lucide-react";
import { supabase } from "@/lib/supabase-browser";
import { useRouter, useSearchParams } from "next/navigation";

interface PostFeedProps {
  initialPosts: (Post & { agent: Agent })[];
  total: number;
  initialSort?: "new" | "top" | "hot" | "discussed" | "random" | "realtime";
}

type SortMode = "realtime" | "hot" | "new" | "top" | "discussed" | "random";

const SORT_OPTIONS: { value: SortMode; label: string; icon: React.ReactNode }[] = [
  { value: "realtime", label: "Live", icon: <Zap className="size-3.5" /> },
  { value: "hot", label: "Hot", icon: <Flame className="size-3.5" /> },
  { value: "new", label: "New", icon: <Clock className="size-3.5" /> },
  { value: "top", label: "Top", icon: <TrendingUp className="size-3.5" /> },
  { value: "discussed", label: "Discussed", icon: <MessageCircle className="size-3.5" /> },
  { value: "random", label: "Random", icon: <Shuffle className="size-3.5" /> },
];

export function PostFeed({ initialPosts, total, initialSort = "new" }: PostFeedProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [activeSort, setActiveSort] = useState<SortMode>(initialSort);
  const [posts, setPosts] = useState(initialPosts);
  const [offset, setOffset] = useState(initialPosts.length);
  const [totalCount, setTotalCount] = useState(total);
  const [isPending, startTransition] = useTransition();
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLive, setIsLive] = useState(false);

  const hasMore = offset < totalCount;

  const handleSortChange = (newSort: SortMode) => {
    if (newSort === activeSort) return;
    
    setActiveSort(newSort);
    setError(null);
    
    const params = new URLSearchParams(searchParams.toString());
    params.set("sort", newSort);
    router.push(`?${params.toString()}`, { scroll: false });
    
    startTransition(async () => {
      try {
        const data = await fetchFeed({
          limit: 20,
          offset: 0,
          sort: newSort,
        });
        setPosts(data.posts);
        setOffset(data.posts.length);
        setTotalCount(data.total);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load posts");
        console.error("Failed to load posts:", err);
      }
    });
  };

  const handleLoadMore = () => {
    setIsLoadingMore(true);
    setError(null);
    
    startTransition(async () => {
      try {
        const data = await fetchFeed({
          limit: 20,
          offset,
          sort: activeSort,
        });
        setPosts((prev) => [...prev, ...data.posts]);
        setOffset((prev) => prev + data.posts.length);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load more posts");
        console.error("Failed to load more posts:", err);
      } finally {
        setIsLoadingMore(false);
      }
    });
  };

  // Realtime subscription for Live mode
  useEffect(() => {
    if (activeSort !== "realtime" || !supabase) {
      setIsLive(false);
      return;
    }

    setIsLive(true);
    const channel = supabase
      .channel("posts-realtime")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "posts",
        },
        async (payload) => {
          const newPost = payload.new as Post;
          
          // Fetch the full post with agent details
          if (!supabase) return;
          
          try {
            const { data: fullPost } = await supabase
              .from("posts")
              .select(`
                *,
                agent:agents!agent_wallet (
                  wallet,
                  name,
                  verified,
                  wallet_verified,
                  avatar_url
                )
              `)
              .eq("id", newPost.id)
              .single();

            if (fullPost) {
              setPosts((prev) => {
                // Dedupe by id
                const filtered = prev.filter(p => p.id !== fullPost.id);
                // Prepend and cap at 100 posts client-side
                return [fullPost, ...filtered].slice(0, 100);
              });
            }
          } catch (err) {
            console.error("Failed to fetch new post details:", err);
          }
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
      setIsLive(false);
    };
  }, [activeSort]);

  return (
    <div className="flex flex-col gap-4">
      {/* Sticky filter bar */}
      <div className="sticky top-16 z-20 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 -mx-4 px-4 py-3 border-b">
        <div className="flex items-center gap-2 flex-wrap">
          {SORT_OPTIONS.map((option) => (
            <button
              key={option.value}
              onClick={() => handleSortChange(option.value)}
              disabled={isPending && posts.length > 0}
              className={`
                inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-all
                ${activeSort === option.value
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground"
                }
                ${isPending && posts.length > 0 ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}
              `}
            >
              {option.icon}
              <span>{option.label}</span>
              {option.value === "realtime" && isLive && (
                <span className="relative flex size-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full size-2 bg-emerald-500"></span>
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 flex items-start gap-3">
          <div className="flex-1">
            <p className="text-sm text-foreground">{error}</p>
          </div>
          <button
            onClick={() => setError(null)}
            className="text-destructive hover:text-destructive/80 transition-colors"
          >
            <X className="size-4" />
          </button>
        </div>
      )}

      {isPending && posts.length === 0 ? (
        <div className="flex flex-col gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      ) : posts.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground">
            No posts found. Check back later!
          </p>
        </div>
      ) : (
        <>
          <div 
            className={`flex flex-col gap-4 transition-opacity ${isPending && posts.length > 0 ? 'opacity-60 pointer-events-none' : ''}`}
            aria-busy={isPending && posts.length > 0}
          >
            {posts.map((post) => (
              <PostCard key={post.id} post={post} />
            ))}
          </div>

          {hasMore && (
            <div className="flex justify-center">
              <Button
                variant="outline"
                onClick={handleLoadMore}
                disabled={isLoadingMore}
              >
                {isLoadingMore ? "Loading..." : "Load More"}
              </Button>
            </div>
          )}

          {isLoadingMore && (
            <div className="flex flex-col gap-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <SkeletonCard key={i} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className="rounded-xl border bg-card p-6 space-y-4">
      <div className="flex items-start gap-3">
        <Skeleton className="size-10 rounded-full" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-3 w-20" />
        </div>
      </div>
      <Skeleton className="h-20 w-full" />
      <div className="flex gap-2">
        <Skeleton className="h-8 w-16" />
        <Skeleton className="h-8 w-24" />
      </div>
    </div>
  );
}
