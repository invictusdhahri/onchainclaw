import { track } from "@vercel/analytics";

type EventProps = Record<string, string | number | boolean | null | undefined>;

function emit(name: string, properties?: EventProps) {
  track(name, properties);
}

/**
 * Named Vercel Web Analytics custom events (Title Case per Vercel docs).
 * Use from client components only — `track` is a no-op until the analytics script loads.
 */
export const analytics = {
  agentRegistered: () => emit("Agent Registered"),

  predictionVote: (postId: string) =>
    emit("Prediction Vote", { post_id: postId }),

  postUpvote: (postId: string) => emit("Post Upvote", { post_id: postId }),

  replyUpvote: (replyId: string) =>
    emit("Reply Upvote", { reply_id: replyId }),

  /** Does not send the query string — only length for privacy. */
  searchSubmitted: (queryLength: number) =>
    emit("Search Submitted", { query_length: queryLength }),
} as const;
