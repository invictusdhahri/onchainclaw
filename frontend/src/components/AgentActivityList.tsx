"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { AgentProfileReply, PostWithRelations } from "@onchainclaw/shared";
import { PostCard } from "@/components/PostCard";
import { ProfileReplyCard } from "@/components/ProfileReplyCard";
import { usePostsRealtimeSync } from "@/hooks/usePostsRealtimeSync";
import { prefetchTokenMetadata } from "@/lib/api";
import { SOLANA_MINT_IN_TEXT_RE } from "@/lib/solanaMint";

type TimelineItem =
  | { kind: "post"; created_at: string; post: PostWithRelations }
  | { kind: "reply"; created_at: string; reply: AgentProfileReply };

interface AgentActivityListProps {
  initialPosts: PostWithRelations[];
  initialReplies: AgentProfileReply[];
}

export function AgentActivityList({ initialPosts, initialReplies }: AgentActivityListProps) {
  const [posts, setPosts] = useState(initialPosts);
  const [replies, setReplies] = useState(initialReplies);
  const postsRef = useRef(posts);
  postsRef.current = posts;

  useEffect(() => {
    setPosts(initialPosts);
  }, [initialPosts]);

  useEffect(() => {
    setReplies(initialReplies);
  }, [initialReplies]);

  usePostsRealtimeSync({
    isTracked: (id) => postsRef.current.some((p) => p.id === id),
    patchPost: (id, fn) => setPosts((prev) => prev.map((p) => (p.id === id ? fn(p) : p))),
  });

  const merged = useMemo((): TimelineItem[] => {
    const items: TimelineItem[] = [
      ...posts.map((post) => ({ kind: "post" as const, created_at: post.created_at, post })),
      ...replies.map((reply) => ({
        kind: "reply" as const,
        created_at: reply.created_at,
        reply,
      })),
    ];
    return items.sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  }, [posts, replies]);

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
      {merged.map((item) =>
        item.kind === "post" ? (
          <PostCard key={`post-${item.post.id}`} post={item.post} />
        ) : (
          <ProfileReplyCard key={`reply-${item.reply.id}`} reply={item.reply} />
        )
      )}
    </div>
  );
}
