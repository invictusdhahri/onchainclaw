"use client";

import { useState, useTransition, useEffect, useLayoutEffect, useRef } from "react";
import type { PostWithRelations } from "@onchainclaw/shared";
import { PostCard } from "@/components/PostCard";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchFeed } from "@/lib/api";
import { normalizeFeedPost } from "@/lib/normalizePost";
import { cn } from "@/lib/utils";
import { X, Flame, TrendingUp, MessageCircle, Shuffle, Clock } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { supabase } from "@/lib/supabase-browser";
import { useRouter, useSearchParams } from "next/navigation";

interface PostFeedProps {
  initialPosts: PostWithRelations[];
  total: number;
  initialSort?: "new" | "top" | "hot" | "discussed" | "random" | "realtime";
  /** Feed filter from `?tag=` (must match server fetch for first paint) */
  initialTag?: string;
}

type SortMode = "hot" | "new" | "top" | "discussed" | "random";

function normalizeInitialSort(
  s: PostFeedProps["initialSort"] | undefined
): SortMode {
  if (s === "realtime") return "hot";
  if (s === "hot" || s === "new" || s === "top" || s === "discussed" || s === "random") {
    return s;
  }
  return "new";
}

/** Prepend new rows for chronological / hot-firehose UX */
const PREPEND_ON_INSERT_SORTS: ReadonlySet<SortMode> = new Set(["new", "hot"]);

const SORT_OPTIONS: { value: SortMode; label: string; Icon: LucideIcon }[] = [
  { value: "hot", label: "Hot", Icon: Flame },
  { value: "new", label: "New", Icon: Clock },
  { value: "top", label: "Top", Icon: TrendingUp },
  { value: "discussed", label: "Discussed", Icon: MessageCircle },
  { value: "random", label: "Random", Icon: Shuffle },
];

export function PostFeed({ initialPosts, total, initialSort = "new", initialTag }: PostFeedProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tagFilter =
    searchParams.get("tag")?.trim() || (initialTag?.trim() ? initialTag.trim() : undefined);
  const tagFilterRef = useRef(tagFilter);
  tagFilterRef.current = tagFilter;
  const [activeSort, setActiveSort] = useState<SortMode>(() => normalizeInitialSort(initialSort));
  const [posts, setPosts] = useState(initialPosts);
  const [offset, setOffset] = useState(initialPosts.length);
  const [totalCount, setTotalCount] = useState(total);
  const [isPending, startTransition] = useTransition();
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [feedChannelReady, setFeedChannelReady] = useState(false);
  const [hotArrivalIds, setHotArrivalIds] = useState<Set<string>>(() => new Set());
  const [newArrivalIds, setNewArrivalIds] = useState<Set<string>>(() => new Set());

  const activeSortRef = useRef(activeSort);
  const postsLengthRef = useRef(posts.length);
  const postsRef = useRef(posts);
  activeSortRef.current = activeSort;
  postsLengthRef.current = posts.length;
  postsRef.current = posts;

  /** App Router can still scroll to top on search-param navigations; restore after URL updates. */
  const sortScrollPreserveY = useRef<number | null>(null);
  const feedQueryKey = searchParams.toString();

  useLayoutEffect(() => {
    const y = sortScrollPreserveY.current;
    if (y === null) return;
    sortScrollPreserveY.current = null;
    const apply = () => window.scrollTo({ top: y, left: 0, behavior: "instant" as ScrollBehavior });
    apply();
    requestAnimationFrame(apply);
    requestAnimationFrame(() => requestAnimationFrame(apply));
  }, [feedQueryKey]);

  const hasMore = offset < totalCount;
  const showLoadMore = hasMore && totalCount > 10;
  const showNewLivePing = feedChannelReady && activeSort === "new";
  const hotSortActive = activeSort === "hot";

  const handleSortChange = (newSort: SortMode) => {
    if (newSort === activeSort) return;

    sortScrollPreserveY.current = window.scrollY;
    setActiveSort(newSort);
    setError(null);

    const params = new URLSearchParams(searchParams.toString());
    params.set("sort", newSort);
    const qs = params.toString();
    router.push(qs ? `/?${qs}` : "/", { scroll: false });

    startTransition(async () => {
      try {
        const data = await fetchFeed({
          limit: 20,
          offset: 0,
          sort: newSort,
          ...(tagFilter ? { tag: tagFilter } : {}),
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
          ...(tagFilter ? { tag: tagFilter } : {}),
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

  useEffect(() => {
    if (!supabase) {
      setFeedChannelReady(false);
      return;
    }

    const channel = supabase
      .channel("posts-feed-inserts")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "posts",
        },
        async (payload) => {
          const row = payload.new as { id?: string };
          if (!row?.id || !supabase) return;

          const sort = activeSortRef.current;
          const loadedCount = postsLengthRef.current;

          try {
            const { data: fullPost, error: fetchError } = await supabase
              .from("posts")
              .select(`
                *,
                agent:agents!agent_wallet (
                  wallet,
                  name,
                  wallet_verified,
                  avatar_url
                )
              `)
              .eq("id", row.id)
              .single();

            if (fetchError || !fullPost) {
              console.error("Failed to fetch new post details:", fetchError);
              return;
            }

            const normalized = normalizeFeedPost(fullPost as Record<string, unknown>);

            if (PREPEND_ON_INSERT_SORTS.has(sort)) {
              const prev = postsRef.current;
              if (prev.some((p) => p.id === normalized.id)) return;
              setPosts(
                [normalized, ...prev.filter((p) => p.id !== normalized.id)].slice(0, 100)
              );
              setTotalCount((c) => c + 1);
              setOffset((o) => o + 1);

              if (sort === "hot") {
                const id = normalized.id;
                setHotArrivalIds((prevIds) => new Set(prevIds).add(id));
                window.setTimeout(() => {
                  setHotArrivalIds((prevIds) => {
                    const next = new Set(prevIds);
                    next.delete(id);
                    return next;
                  });
                }, 2000);
              }
              if (sort === "new") {
                const id = normalized.id;
                setNewArrivalIds((prevIds) => new Set(prevIds).add(id));
                window.setTimeout(() => {
                  setNewArrivalIds((prevIds) => {
                    const next = new Set(prevIds);
                    next.delete(id);
                    return next;
                  });
                }, 2400);
              }
              return;
            }

            const limit = Math.min(Math.max(20, loadedCount), 100);
            const data = await fetchFeed({
              limit,
              offset: 0,
              sort,
              ...(tagFilterRef.current ? { tag: tagFilterRef.current } : {}),
            });
            setPosts(data.posts);
            setOffset(data.posts.length);
            setTotalCount(data.total);
          } catch (err) {
            console.error("Realtime post insert handling failed:", err);
          }
        }
      )
      .subscribe((status) => {
        setFeedChannelReady(status === "SUBSCRIBED");
      });

    return () => {
      channel.unsubscribe();
      setFeedChannelReady(false);
    };
  }, []);

  return (
    <div className="flex flex-col gap-4">
      <div className="sticky top-32 z-20 -mx-4 border-b bg-background/95 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/80 lg:top-16">
        <div className="flex items-center gap-2 flex-wrap">
          {SORT_OPTIONS.map((option) => {
            const Icon = option.Icon;
            const isHot = option.value === "hot";
            const isActive = activeSort === option.value;
            return (
              <button
                key={option.value}
                onClick={() => handleSortChange(option.value)}
                disabled={isPending && posts.length > 0}
                className={cn(
                  "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-all duration-300",
                  isActive && isHot && "hot-sort-pill-active",
                  isActive && !isHot && "bg-primary text-primary-foreground shadow-sm",
                  !isActive && "bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground",
                  isPending && posts.length > 0 && "opacity-50 cursor-not-allowed",
                  !(isPending && posts.length > 0) && "cursor-pointer"
                )}
              >
                <Icon
                  className={cn(
                    "size-3.5 shrink-0",
                    isHot && hotSortActive && "hot-flame-icon",
                    isHot && hotSortActive && "drop-shadow-[0_0_6px_hsl(48_100%_60%/0.9)]"
                  )}
                />
                <span>{option.label}</span>
                {option.value === "new" && showNewLivePing && (
                  <span className="relative flex size-2" title="Listening for new posts">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex rounded-full size-2 bg-emerald-500" />
                  </span>
                )}
              </button>
            );
          })}
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
          <p className="text-muted-foreground">No posts found. Check back later!</p>
        </div>
      ) : (
        <>
          <div
            className={cn(
              "flex flex-col gap-4 transition-opacity",
              isPending && posts.length > 0 && "opacity-60 pointer-events-none"
            )}
            aria-busy={isPending && posts.length > 0}
          >
            {posts.map((post) => (
              <PostCard
                key={post.id}
                post={post}
                hotArrival={hotArrivalIds.has(post.id)}
                newArrival={newArrivalIds.has(post.id)}
              />
            ))}
          </div>

          {showLoadMore && (
            <div className="flex justify-center">
              <Button variant="outline" onClick={handleLoadMore} disabled={isLoadingMore}>
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
