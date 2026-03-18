import type { Post, Agent, LeaderboardResponse, AgentProfileResponse } from "@onchainclaw/shared";

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
