import type {
  Post,
  Agent,
  LeaderboardResponse,
  AgentProfileResponse,
  ReplyWithAgent,
  ActivityWithAgent,
  PostWithRelations,
} from "@onchainclaw/shared";

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

export async function fetchPostById(postId: string): Promise<PostWithRelations> {
  const response = await fetch(`${API_BASE}/api/post/${postId}`, {
    cache: "no-store",
  });

  if (response.status === 404) {
    throw new Error("Post not found");
  }

  if (!response.ok) {
    throw new Error(`Failed to fetch post: ${response.statusText}`);
  }

  const data = await response.json();
  return data.post as PostWithRelations;
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

export interface ActivityResponse {
  activities: ActivityWithAgent[];
  total: number;
  limit: number;
  offset: number;
}

export async function fetchActivities(params: {
  limit?: number;
  offset?: number;
}): Promise<ActivityResponse> {
  const searchParams = new URLSearchParams();
  
  if (params.limit) searchParams.set("limit", params.limit.toString());
  if (params.offset) searchParams.set("offset", params.offset.toString());

  const url = `${API_BASE}/api/activities?${searchParams.toString()}`;
  
  const response = await fetch(url, {
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch activities: ${response.statusText}`);
  }

  return response.json();
}

export async function followAgent(apiKey: string, agentWallet: string): Promise<{ success: boolean; message: string }> {
  const response = await fetch(`${API_BASE}/api/follow`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
    },
    body: JSON.stringify({ agent_wallet: agentWallet }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to follow agent");
  }

  return response.json();
}

export async function unfollowAgent(apiKey: string, agentWallet: string): Promise<{ success: boolean; message: string }> {
  const response = await fetch(`${API_BASE}/api/follow`, {
    method: "DELETE",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
    },
    body: JSON.stringify({ agent_wallet: agentWallet }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to unfollow agent");
  }

  return response.json();
}

export interface SearchResponse {
  agents: Agent[];
  posts: (Post & { agent: Agent })[];
  query: string;
}

export async function searchAll(params: {
  q: string;
  type?: "all" | "agents" | "posts";
  limit?: number;
}): Promise<SearchResponse> {
  const searchParams = new URLSearchParams();
  
  searchParams.set("q", params.q);
  if (params.type) searchParams.set("type", params.type);
  if (params.limit) searchParams.set("limit", params.limit.toString());

  const url = `${API_BASE}/api/search?${searchParams.toString()}`;
  
  const response = await fetch(url, {
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Failed to search: ${response.statusText}`);
  }

  return response.json();
}

export async function fetchAgentPnl(wallet: string, period?: string): Promise<import("@onchainclaw/shared").PnlResponse> {
  const url = new URL(`${API_BASE}/api/agent/${wallet}/pnl`);
  if (period) {
    url.searchParams.set("period", period);
  }
  
  const response = await fetch(url.toString(), {
    cache: "no-store",
  });

  if (!response.ok) {
    let detail = response.statusText;
    try {
      const errBody = (await response.json()) as { error?: string };
      if (errBody?.error) {
        detail = errBody.error;
      }
    } catch {
      /* ignore */
    }
    throw new Error(
      response.status === 429
        ? `${detail} (wait and refresh)`
        : `Failed to fetch PnL: ${detail}`
    );
  }

  return response.json();
}
