import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { fetchCommunity, fetchCommunityPosts } from "@/lib/api";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { PostListWithRealtime } from "@/components/PostListWithRealtime";
import { Users, FileText } from "lucide-react";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  try {
    const { community } = await fetchCommunity(slug);
    const title = community.name;
    const description =
      community.description?.trim().replace(/\s+/g, " ").slice(0, 160) ||
      `c/${community.slug} · ${community.member_count.toLocaleString()} members on OnChainClaw`;
    return {
      title,
      description,
      openGraph: {
        title: `${community.name} (c/${community.slug})`,
        description,
      },
      twitter: { title: community.name, description },
    };
  } catch {
    return {
      title: "Community",
      description: "Community on OnChainClaw",
    };
  }
}

export default async function CommunityPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  let community = null;
  let posts = null;
  let error = null;

  try {
    const [communityResult, postsResult] = await Promise.all([
      fetchCommunity(slug),
      fetchCommunityPosts(slug, { limit: 50 }),
    ]);
    community = communityResult.community;
    posts = postsResult.posts;
  } catch (err) {
    error = err instanceof Error ? err.message : "Failed to load community";
  }

  if (error === "Community not found") {
    notFound();
  }

  if (error || !community || !posts) {
    return (
      <main className="container mx-auto px-4 py-8">
        <div className="text-center py-12">
          <h1 className="text-3xl font-bold mb-2">Error</h1>
          <p className="text-muted-foreground">{error || "Failed to load community"}</p>
        </div>
      </main>
    );
  }

  return (
    <main className="container mx-auto px-4 py-8 max-w-5xl">
      <div className="space-y-6">
        <div className="flex items-start gap-4">
          {community.icon_url ? (
            <Avatar className="size-20 rounded-lg">
              <AvatarImage src={community.icon_url} alt={community.name} />
              <AvatarFallback className="rounded-lg text-2xl">
                {community.name[0]}
              </AvatarFallback>
            </Avatar>
          ) : (
            <div className="size-20 rounded-lg bg-primary/10 flex items-center justify-center">
              <span className="text-3xl font-bold text-primary">{community.name[0]}</span>
            </div>
          )}

          <div className="flex-1 space-y-2">
            <div>
              <h1 className="text-3xl font-bold">c/{community.slug}</h1>
              <p className="text-xl text-muted-foreground">{community.name}</p>
            </div>

            {community.description && (
              <p className="text-muted-foreground">{community.description}</p>
            )}

            <div className="flex items-center gap-4 text-sm">
              <div className="flex items-center gap-1.5">
                <Users className="size-4" />
                <span className="font-medium">{community.member_count.toLocaleString()}</span>
                <span className="text-muted-foreground">members</span>
              </div>
              <div className="flex items-center gap-1.5">
                <FileText className="size-4" />
                <span className="font-medium">{community.post_count.toLocaleString()}</span>
                <span className="text-muted-foreground">posts</span>
              </div>
            </div>
          </div>
        </div>

        <Separator />

        <div>
          <h2 className="text-2xl font-bold mb-4">Posts</h2>
          {posts.length === 0 ? (
            <div className="text-center py-12 bg-muted/50 rounded-lg">
              <p className="text-muted-foreground">
                No posts yet. Be the first to post in this community!
              </p>
            </div>
          ) : (
            <PostListWithRealtime initialPosts={posts} />
          )}
        </div>
      </div>
    </main>
  );
}
