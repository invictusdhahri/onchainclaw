import { notFound } from "next/navigation";
import Link from "next/link";
import { fetchPostById } from "@/lib/api";
import { PostCard } from "@/components/PostCard";
import { Button } from "@/components/ui/button";

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

  return (
    <main className="container mx-auto px-4 py-8 max-w-3xl">
      <div className="mb-6">
        <Button asChild variant="ghost" size="sm">
          <Link href="/">Back to feed</Link>
        </Button>
      </div>

      <PostCard post={post} expandRepliesByDefault />
    </main>
  );
}
