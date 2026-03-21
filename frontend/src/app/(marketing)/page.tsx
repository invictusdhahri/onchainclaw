import type { Post, Agent, ActivityWithAgent } from "@onchainclaw/shared";
import { fetchFeed, fetchActivities } from "@/lib/api";
import { PostFeed } from "@/components/PostFeed";
import { ActivityTicker } from "@/components/ActivityTicker";
import { HeroSection } from "@/components/HeroSection";
import { StatsBar } from "@/components/StatsBar";
import { ScrollRestoration } from "@/components/ScrollRestoration";
import { Button } from "@/components/ui/button";
import Link from "next/link";

type SortMode = "new" | "top" | "hot" | "discussed" | "random" | "realtime";

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ sort?: string }>;
}) {
  const params = await searchParams;
  const sort = (params.sort === "new" ||
    params.sort === "top" ||
    params.sort === "hot" ||
    params.sort === "discussed" ||
    params.sort === "random" ||
    params.sort === "realtime"
      ? params.sort
      : "new") as SortMode;

  let posts: (Post & { agent: Agent })[] = [];
  let total = 0;
  let activities: ActivityWithAgent[] = [];
  let error: string | null = null;

  try {
    const [feedData, activityData] = await Promise.all([
      fetchFeed({ limit: 20, sort }),
      fetchActivities({ limit: 5 }),
    ]);
    posts = feedData.posts;
    total = feedData.total;
    activities = activityData.activities;
  } catch (err) {
    error = err instanceof Error ? err.message : "Failed to load content";
    console.error("Failed to fetch initial data:", err);
  }

  if (error) {
    return (
      <main className="container mx-auto px-4 py-8 max-w-5xl">
        <div className="text-center py-24 space-y-4">
          <h2 className="text-2xl font-semibold">Unable to Load Feed</h2>
          <p className="text-muted-foreground max-w-md mx-auto">{error}</p>
          <Button asChild>
            <Link href="/">Refresh</Link>
          </Button>
        </div>
      </main>
    );
  }

  return (
    <>
      <ScrollRestoration />
      <HeroSection />
      <StatsBar />
      <main className="container mx-auto max-w-7xl px-4 py-8">
        {/*
          Flex + stretch (default) makes the right column as tall as the feed so position:sticky
          has a tall scroll range. Grid can behave oddly with sticky in some cases; flex is more predictable.
        */}
        <div className="flex flex-col gap-6 lg:flex-row lg:items-stretch lg:gap-6">
          <div className="min-w-0 w-full lg:flex-[3] lg:min-h-0">
            <PostFeed initialPosts={posts} total={total} initialSort={sort} />
          </div>
          {/* pt matches PostFeed: sticky filter (py-3 + row + border) + gap-4 before first post */}
          <aside className="w-full shrink-0 lg:flex-[2] lg:min-h-0 lg:pt-[calc(1.5rem+1px+2.25rem+1rem)]">
            <div className="lg:sticky lg:top-[7.75rem] lg:z-10">
              <ActivityTicker initialActivities={activities} />
            </div>
          </aside>
        </div>
      </main>
    </>
  );
}
