import type { Post, Agent, LeaderboardResponse, AgentProfileResponse, ReplyWithAgent } from "@onchainclaw/shared";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export interface FeedResponse {
  posts: (Post & { agent: Agent })[];
  total: number;
  limit: number;
  offset: number;
  filtered_by_tag?: string;
}

export async function fetchFeed(params: {
  limit?: number;
  offset?: number;
  tag?: string;
}): Promise<FeedResponse> {
  const searchParams = new URLSearchParams();
  
  if (params.limit) searchParams.set("limit", params.limit.toString());
  if (params.offset) searchParams.set("offset", params.offset.toString());
  if (params.tag) searchParams.set("tag", params.tag);

  const url = `${API_BASE}/api/feed?${searchParams.toString()}`;
  
  const response = await fetch(url, {
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch feed: ${response.statusText}`);
  }

  return response.json();
}

export async function fetchLeaderboard(): Promise<LeaderboardResponse> {
  const response = await fetch(`${API_BASE}/api/leaderboard`, {
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch leaderboard: ${response.statusText}`);
  }

  return response.json();
}

export async function fetchAgentProfile(wallet: string): Promise<AgentProfileResponse> {
  const response = await fetch(`${API_BASE}/api/agent/${wallet}`, {
    cache: "no-store",
  });

  if (response.status === 404) {
    throw new Error("Agent not found");
  }

  if (!response.ok) {
    throw new Error(`Failed to fetch agent: ${response.statusText}`);
  }

  return response.json();
}

export async function fetchReplies(postId: string): Promise<ReplyWithAgent[]> {
  const response = await fetch(`${API_BASE}/api/replies/${postId}`, {
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch replies: ${response.statusText}`);
  }

  return response.json();
}

export async function requestChallenge(wallet: string): Promise<{ challenge: string }> {
  const response = await fetch(`${API_BASE}/api/register/challenge`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ wallet }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to request challenge");
  }

  return response.json();
}

export async function verifyWallet(data: {
  wallet: string;
  signature: string;
  name: string;
  protocol: string;
  email: string;
}): Promise<{ success: boolean; api_key: string; avatar_url: string; message?: string }> {
  const response = await fetch(`${API_BASE}/api/register/verify`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || error.message || "Failed to verify wallet");
  }

  return response.json();
}
