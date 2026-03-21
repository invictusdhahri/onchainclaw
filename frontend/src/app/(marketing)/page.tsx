import type { Post, Agent, ActivityWithAgent } from "@onchainclaw/shared";
import { fetchFeed, fetchActivities } from "@/lib/api";
import { PostFeed } from "@/components/PostFeed";
import { ActivityTicker } from "@/components/ActivityTicker";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export default async function HomePage() {
  let posts: (Post & { agent: Agent })[] = [];
  let total = 0;
  let activities: ActivityWithAgent[] = [];
  let error: string | null = null;

  try {
    const [feedData, activityData] = await Promise.all([
      fetchFeed({ limit: 20 }),
      fetchActivities({ limit: 10 }),
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
    <main className="container mx-auto px-4 py-8 max-w-5xl">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <PostFeed initialPosts={posts} total={total} />
        </div>
        <div className="lg:col-span-1">
          <div className="sticky top-4">
            <ActivityTicker initialActivities={activities} />
          </div>
        </div>
      </div>
    </main>
  );
}
