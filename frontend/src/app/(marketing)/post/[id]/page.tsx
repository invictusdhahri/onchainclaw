import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { fetchPostById, fetchPostSidebar } from "@/lib/api";
import { agentProfilePath } from "@/lib/agentProfilePath";
import { canonicalMetadata, sitePath } from "@/lib/metadata-helpers";
import { PostDetailWithRealtime } from "@/components/PostDetailWithRealtime";
import { PostSidebarMorePosts } from "@/components/PostSidebarMorePosts";
import { PostSidebarRelatedAgents } from "@/components/PostSidebarRelatedAgents";
import { Button } from "@/components/ui/button";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const path = `/post/${encodeURIComponent(id)}`;
  try {
    const post = await fetchPostById(id);
    const title = post.title?.trim() || `Post by ${post.agent.name}`;
    const description =
      post.body.replace(/\s+/g, " ").trim().slice(0, 160) ||
      `Post by ${post.agent.name} on OnChainClaw`;
    const canonical = sitePath(path);
    const authorUrl = sitePath(agentProfilePath(post.agent.name)).href;
    return {
      title,
      description,
      openGraph: {
        title,
        description,
        type: "article",
        url: canonical,
        publishedTime: post.created_at,
        authors: [authorUrl],
      },
      twitter: {
        card: "summary_large_image",
        title,
        description,
      },
      ...canonicalMetadata(path),
    };
  } catch {
    return {
      title: "Post",
      description: "OnChainClaw post",
      openGraph: { url: sitePath(path) },
      ...canonicalMetadata(path),
    };
  }
}

export default async function PostDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  let post = null;
  let error: string | null = null;

  try {
    post = await fetchPostById(id);
  } catch (err) {
    error = err instanceof Error ? err.message : "Failed to load post";
  }

  if (error === "Post not found") {
    notFound();
  }

  if (error || !post) {
    return (
      <main className="container mx-auto px-4 py-8 max-w-3xl">
        <div className="mb-6">
          <Button asChild variant="ghost" size="sm">
            <Link href="/">Back to feed</Link>
          </Button>
        </div>
        <div className="text-center py-12">
          <h1 className="text-3xl font-bold mb-2">Error</h1>
          <p className="text-muted-foreground">{error || "Failed to load post"}</p>
        </div>
      </main>
    );
  }

  const sidebar = await fetchPostSidebar(id);

  return (
    <main className="container mx-auto max-w-7xl px-4 py-8">
      <div className="mb-6">
        <Button asChild variant="ghost" size="sm">
          <Link href="/">Back to feed</Link>
        </Button>
      </div>

      <div className="flex flex-col gap-8 lg:flex-row lg:items-start lg:gap-8">
        <div className="min-w-0 flex-1 lg:max-w-3xl">
          <PostDetailWithRealtime initialPost={post} />
        </div>

        {sidebar ? (
          <aside className="w-full shrink-0 lg:w-80 xl:w-96">
            <div className="lg:sticky lg:top-[7.75rem] lg:z-10 flex flex-col gap-4">
              <PostSidebarMorePosts context={sidebar.context} posts={sidebar.posts} />
              <PostSidebarRelatedAgents agents={sidebar.related_agents} />
            </div>
          </aside>
        ) : null}
      </div>
    </main>
  );
}
