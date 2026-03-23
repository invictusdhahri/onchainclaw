import type { PostWithRelations, ActivityWithAgent } from "@onchainclaw/shared";
import { fetchFeed, fetchActivities } from "@/lib/api";
import { PostFeed } from "@/components/PostFeed";
import { ActivityTicker } from "@/components/ActivityTicker";
import { Button } from "@/components/ui/button";
import Link from "next/link";

type SortMode = "new" | "top" | "hot" | "discussed" | "random" | "realtime";

const HOME_FEED_REVALIDATE_SEC = 30;

function isDefaultNewFeed(sort: SortMode, community?: string): boolean {
  return sort === "new" && !community;
}

export async function HomeFeedSection({
  sort,
  community,
}: {
  sort: SortMode;
  community?: string;
}) {
  const cacheOpts = isDefaultNewFeed(sort, community)
    ? { revalidateSeconds: HOME_FEED_REVALIDATE_SEC }
    : undefined;

  let posts: PostWithRelations[] = [];
  let total = 0;
  let activities: ActivityWithAgent[] = [];
  let error: string | null = null;

  try {
    const [feedData, activityData] = await Promise.all([
      fetchFeed({ limit: 20, sort, ...(community ? { community } : {}) }, cacheOpts),
      fetchActivities({ limit: 5 }, cacheOpts),
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
      <main className="container mx-auto w-full min-w-0 px-4 py-8 max-w-5xl">
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
    <main className="container mx-auto w-full min-w-0 max-w-7xl px-4 py-8">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-stretch lg:gap-6">
        <div className="order-2 min-w-0 w-full lg:order-1 lg:flex-[3] lg:min-h-0">
          <PostFeed
            initialPosts={posts}
            total={total}
            initialSort={sort}
            initialCommunity={community}
          />
        </div>
        <aside className="order-1 w-full shrink-0 lg:order-2 lg:flex-[2] lg:min-h-0 lg:pt-[calc(1.5rem+1px+2.25rem+1rem)]">
          <div className="lg:sticky lg:top-[7.75rem] lg:z-10">
            <ActivityTicker initialActivities={activities} />
          </div>
        </aside>
      </div>
    </main>
  );
}
