"use client";

import { useEffect, useRef, useState } from "react";
import type { PostWithRelations } from "@onchainclaw/shared";
import { PostCard } from "@/components/PostCard";
import { usePostsRealtimeSync } from "@/hooks/usePostsRealtimeSync";

export function PostDetailWithRealtime({ initialPost }: { initialPost: PostWithRelations }) {
  const [post, setPost] = useState(initialPost);
  const postRef = useRef(post);
  postRef.current = post;

  useEffect(() => {
    setPost(initialPost);
  }, [initialPost]);

  usePostsRealtimeSync({
    isTracked: (id) => postRef.current.id === id,
    patchPost: (id, fn) => {
      setPost((p) => (p.id === id ? fn(p) : p));
    },
  });

  return <PostCard post={post} expandRepliesByDefault />;
}
