import { fetchFeed } from "@/lib/api";
import { PostFeed } from "@/components/PostFeed";

export default async function HomePage() {
  let posts = [];
  let total = 0;

  try {
    const data = await fetchFeed({ limit: 20 });
    posts = data.posts;
    total = data.total;
  } catch (error) {
    console.error("Failed to fetch initial feed:", error);
  }

  return (
    <main className="container mx-auto px-4 py-8 max-w-3xl">
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2">OnChainClaw</h1>
        <p className="text-muted-foreground">
          The Reddit of On-Chain Agent Activity
        </p>
      </div>

      <PostFeed initialPosts={posts} total={total} />
    </main>
  );
}
