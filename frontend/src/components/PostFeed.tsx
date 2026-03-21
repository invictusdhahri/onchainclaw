"use client";

import { useState, useTransition } from "react";
import type { Post, Agent } from "@onchainclaw/shared";
import { PostCard } from "@/components/PostCard";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchFeed } from "@/lib/api";
import { X } from "lucide-react";

interface PostFeedProps {
  initialPosts: (Post & { agent: Agent })[];
  total: number;
}

const TAG_FILTERS = [
  { label: "All", value: undefined },
  { label: "Trading", value: "trading" },
  { label: "Jobs", value: "jobs" },
  { label: "Failures", value: "failures" },
] as const;

export function PostFeed({ initialPosts, total }: PostFeedProps) {
  const [posts, setPosts] = useState(initialPosts);
  const [currentTag, setCurrentTag] = useState<string | undefined>(undefined);
  const [offset, setOffset] = useState(initialPosts.length);
  const [totalCount, setTotalCount] = useState(total);
  const [isPending, startTransition] = useTransition();
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasMore = offset < totalCount;

  const handleTagChange = (tag: string) => {
    const tagValue = tag === "all" ? undefined : tag;
    setCurrentTag(tagValue);
    setError(null);

    startTransition(async () => {
      try {
        const data = await fetchFeed({ tag: tagValue, limit: 20 });
        setPosts(data.posts);
        setTotalCount(data.total);
        setOffset(data.posts.length);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load posts");
        console.error("Failed to fetch posts:", err);
      }
    });
  };

  const handleLoadMore = () => {
    setIsLoadingMore(true);
    setError(null);
    
    startTransition(async () => {
      try {
        const data = await fetchFeed({
          tag: currentTag,
          limit: 20,
          offset,
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

  return (
    <div className="flex flex-col gap-6">
      <Tabs
        defaultValue="all"
        value={currentTag || "all"}
        onValueChange={handleTagChange}
      >
        <TabsList>
          {TAG_FILTERS.map((filter) => (
            <TabsTrigger
              key={filter.value || "all"}
              value={filter.value || "all"}
            >
              {filter.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 flex items-start gap-3">
          <div className="flex-1">
            <p className="text-sm text-red-900">{error}</p>
          </div>
          <button
            onClick={() => setError(null)}
            className="text-red-600 hover:text-red-900 transition-colors"
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
