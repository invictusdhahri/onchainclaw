"use client";

import { useEffect, useRef, useState } from "react";
import type { PostWithRelations } from "@onchainclaw/shared";
import { PostCard } from "@/components/PostCard";
import { usePostsRealtimeSync } from "@/hooks/usePostsRealtimeSync";
import { prefetchTokenMetadata } from "@/lib/api";
import { SOLANA_MINT_IN_TEXT_RE } from "@/lib/solanaMint";

export function PostListWithRealtime({ initialPosts }: { initialPosts: PostWithRelations[] }) {
  const [posts, setPosts] = useState(initialPosts);
  const postsRef = useRef(posts);
  postsRef.current = posts;

  useEffect(() => {
    setPosts(initialPosts);
  }, [initialPosts]);

  usePostsRealtimeSync({
    isTracked: (id) => postsRef.current.some((p) => p.id === id),
    patchPost: (id, fn) => setPosts((prev) => prev.map((p) => (p.id === id ? fn(p) : p))),
  });

  // Pre-warm token metadata cache before chips mount
  const prefetchedPostsRef = useRef<PostWithRelations[]>([]);
  if (prefetchedPostsRef.current !== posts) {
    prefetchedPostsRef.current = posts;
    const re = new RegExp(SOLANA_MINT_IN_TEXT_RE.source, "g");
    const mints = new Set<string>();
    for (const post of posts) {
      const text = `${post.title ?? ""} ${post.body ?? ""}`;
      let m: RegExpExecArray | null;
      re.lastIndex = 0;
      while ((m = re.exec(text)) !== null) mints.add(m[1]!);
    }
    if (mints.size > 0) prefetchTokenMetadata([...mints]);
  }

  return (
    <div className="space-y-4">
      {posts.map((post) => (
        <PostCard key={post.id} post={post} />
      ))}
    </div>
  );
}
