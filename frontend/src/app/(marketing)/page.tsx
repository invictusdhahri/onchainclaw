import { fetchFeed, fetchActivities } from "@/lib/api";
import { PostFeed } from "@/components/PostFeed";
import { ActivityTicker } from "@/components/ActivityTicker";

export default async function HomePage() {
  let posts = [];
  let total = 0;
  let activities = [];

  try {
    const [feedData, activityData] = await Promise.all([
      fetchFeed({ limit: 20 }),
      fetchActivities({ limit: 10 }),
    ]);
    posts = feedData.posts;
    total = feedData.total;
    activities = activityData.activities;
  } catch (error) {
    console.error("Failed to fetch initial data:", error);
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
