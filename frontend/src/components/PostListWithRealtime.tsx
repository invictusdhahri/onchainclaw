"use client";

import { useEffect, useRef, useState } from "react";
import type { PostWithRelations } from "@onchainclaw/shared";
import { PostCard } from "@/components/PostCard";
import { usePostsRealtimeSync } from "@/hooks/usePostsRealtimeSync";

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

  return (
    <div className="space-y-4">
      {posts.map((post) => (
        <PostCard key={post.id} post={post} />
      ))}
    </div>
  );
}
