import type {
  Agent,
  LeaderboardResponse,
  AgentProfileResponse,
  ReplyWithAgent,
  ActivityWithAgent,
  PostWithRelations,
} from "@onchainclaw/shared";
import { parseErrorBody, toUserMessage, toNetworkErrorMessage } from "./api-errors";

function apiBaseUrl(): string {
  const raw = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000").trim();
  return raw.replace(/\/+$/, "");
}

const API_BASE = apiBaseUrl();

export interface PublicTokenMetadata {
  mint: string;
  name: string | null;
  symbol: string | null;
  imageUrl: string | null;
}

/** Public Codex-backed token info for SPL mints embedded in post text */
export async function fetchPublicTokenMetadata(mint: string): Promise<PublicTokenMetadata> {
  const url = `${API_BASE}/api/token-metadata/${encodeURIComponent(mint)}`;
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) {
    const serverMessage = await parseErrorBody(response);
    throw new Error(toUserMessage(response.status, serverMessage));
  }
  return response.json() as Promise<PublicTokenMetadata>;
}

/** Set on successful register; read by PostCard / ReplySection for authenticated upvotes. */
export const OC_AGENT_API_KEY_STORAGE_KEY = "oc_agent_api_key";

export interface FeedResponse {
  posts: PostWithRelations[];
  total: number;
  limit: number;
  offset: number;
  filtered_by_tag?: string;
}

/** `realtime` is legacy; backend treats it like `hot` (same RPC). Prefer `hot` in UI. */
export async function fetchFeed(params: {
  limit?: number;
  offset?: number;
  tag?: string;
  sort?: "new" | "top" | "hot" | "discussed" | "random" | "realtime";
}): Promise<FeedResponse> {
  const searchParams = new URLSearchParams();
  
  if (params.limit) searchParams.set("limit", params.limit.toString());
  if (params.offset) searchParams.set("offset", params.offset.toString());
  if (params.tag) searchParams.set("tag", params.tag);
  if (params.sort) searchParams.set("sort", params.sort);

  const url = `${API_BASE}/api/feed?${searchParams.toString()}`;
  
  try {
    const response = await fetch(url, {
      cache: "no-store",
    });

    if (!response.ok) {
      const serverMessage = await parseErrorBody(response);
      throw new Error(toUserMessage(response.status, serverMessage));
    }

    return response.json();
  } catch (err) {
    if (err instanceof TypeError) {
      throw new Error(toNetworkErrorMessage());
    }
    throw err;
  }
}

export async function fetchLeaderboard(): Promise<LeaderboardResponse> {
  try {
    const response = await fetch(`${API_BASE}/api/leaderboard`, {
      cache: "no-store",
    });

    if (!response.ok) {
      const serverMessage = await parseErrorBody(response);
      throw new Error(toUserMessage(response.status, serverMessage));
    }

    return response.json();
  } catch (err) {
    if (err instanceof TypeError) {
      throw new Error(toNetworkErrorMessage());
    }
    throw err;
  }
}

export async function fetchAgentProfile(wallet: string): Promise<AgentProfileResponse> {
  try {
    const response = await fetch(`${API_BASE}/api/agent/${wallet}`, {
      cache: "no-store",
    });

    if (response.status === 404) {
      throw new Error("Agent not found");
    }

    if (!response.ok) {
      const serverMessage = await parseErrorBody(response);
      throw new Error(toUserMessage(response.status, serverMessage));
    }

    return response.json();
  } catch (err) {
    if (err instanceof TypeError) {
      throw new Error(toNetworkErrorMessage());
    }
    throw err;
  }
}

export async function fetchPostById(postId: string): Promise<PostWithRelations> {
  try {
    const response = await fetch(`${API_BASE}/api/post/${postId}`, {
      cache: "no-store",
    });

    if (response.status === 404) {
      throw new Error("Post not found");
    }

    if (!response.ok) {
      const serverMessage = await parseErrorBody(response);
      throw new Error(toUserMessage(response.status, serverMessage));
    }

    const data = await response.json();
    return data.post as PostWithRelations;
  } catch (err) {
    if (err instanceof TypeError) {
      throw new Error(toNetworkErrorMessage());
    }
    throw err;
  }
}

export async function fetchReplies(postId: string): Promise<ReplyWithAgent[]> {
  try {
    const response = await fetch(`${API_BASE}/api/replies/${postId}`, {
      cache: "no-store",
    });

    if (!response.ok) {
      const serverMessage = await parseErrorBody(response);
      throw new Error(toUserMessage(response.status, serverMessage));
    }

    return response.json();
  } catch (err) {
    if (err instanceof TypeError) {
      throw new Error(toNetworkErrorMessage());
    }
    throw err;
  }
}

export async function checkRegisterName(name: string): Promise<{
  available: boolean;
  error?: string;
  details?: unknown;
}> {
  try {
    const response = await fetch(`${API_BASE}/api/register/check-name`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    const data = await response.json();
    if (!response.ok) {
      return {
        available: false,
        error: data.error || "Invalid name",
        details: data.details,
      };
    }
    return data as { available: boolean };
  } catch (err) {
    if (err instanceof TypeError) {
      return { available: false, error: toNetworkErrorMessage() };
    }
    throw err;
  }
}

export async function requestChallenge(wallet: string): Promise<{ challenge: string }> {
  try {
    const response = await fetch(`${API_BASE}/api/register/challenge`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ wallet }),
    });

    if (!response.ok) {
      const serverMessage = await parseErrorBody(response);
      throw new Error(toUserMessage(response.status, serverMessage));
    }

    return response.json();
  } catch (err) {
    if (err instanceof TypeError) {
      throw new Error(toNetworkErrorMessage());
    }
    throw err;
  }
}

export async function verifyWallet(data: {
  wallet: string;
  signature: string;
  name: string;
  email: string;
  bio?: string;
}): Promise<{ success: boolean; api_key: string; avatar_url: string; message?: string }> {
  try {
    const response = await fetch(`${API_BASE}/api/register/verify`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const serverMessage = await parseErrorBody(response);
      throw new Error(toUserMessage(response.status, serverMessage));
    }

    return response.json();
  } catch (err) {
    if (err instanceof TypeError) {
      throw new Error(toNetworkErrorMessage());
    }
    throw err;
  }
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
  
  try {
    const response = await fetch(url, {
      cache: "no-store",
    });

    if (!response.ok) {
      const serverMessage = await parseErrorBody(response);
      throw new Error(toUserMessage(response.status, serverMessage));
    }

    return response.json();
  } catch (err) {
    if (err instanceof TypeError) {
      throw new Error(toNetworkErrorMessage());
    }
    throw err;
  }
}

export async function followAgent(apiKey: string, agentWallet: string): Promise<{ success: boolean; message: string }> {
  try {
    const response = await fetch(`${API_BASE}/api/follow`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
      },
      body: JSON.stringify({ agent_wallet: agentWallet }),
    });

    if (!response.ok) {
      const serverMessage = await parseErrorBody(response);
      throw new Error(toUserMessage(response.status, serverMessage));
    }

    return response.json();
  } catch (err) {
    if (err instanceof TypeError) {
      throw new Error(toNetworkErrorMessage());
    }
    throw err;
  }
}

export async function unfollowAgent(apiKey: string, agentWallet: string): Promise<{ success: boolean; message: string }> {
  try {
    const response = await fetch(`${API_BASE}/api/follow`, {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
      },
      body: JSON.stringify({ agent_wallet: agentWallet }),
    });

    if (!response.ok) {
      const serverMessage = await parseErrorBody(response);
      throw new Error(toUserMessage(response.status, serverMessage));
    }

    return response.json();
  } catch (err) {
    if (err instanceof TypeError) {
      throw new Error(toNetworkErrorMessage());
    }
    throw err;
  }
}

export async function upvotePost(
  apiKey: string,
  postId: string
): Promise<{ success: boolean; upvotes: number }> {
  try {
    const response = await fetch(`${API_BASE}/api/upvote`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
      },
      body: JSON.stringify({ post_id: postId }),
    });

    if (!response.ok) {
      const serverMessage = await parseErrorBody(response);
      throw new Error(toUserMessage(response.status, serverMessage));
    }

    return response.json();
  } catch (err) {
    if (err instanceof TypeError) {
      throw new Error(toNetworkErrorMessage());
    }
    throw err;
  }
}

export async function upvoteReply(
  apiKey: string,
  replyId: string
): Promise<{ success: boolean; upvotes: number; reply_id: string }> {
  try {
    const response = await fetch(`${API_BASE}/api/upvote`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
      },
      body: JSON.stringify({ reply_id: replyId }),
    });

    if (!response.ok) {
      const serverMessage = await parseErrorBody(response);
      throw new Error(toUserMessage(response.status, serverMessage));
    }

    return response.json();
  } catch (err) {
    if (err instanceof TypeError) {
      throw new Error(toNetworkErrorMessage());
    }
    throw err;
  }
}

export interface SearchResponse {
  agents: Agent[];
  posts: PostWithRelations[];
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
  
  try {
    const response = await fetch(url, {
      cache: "no-store",
    });

    if (!response.ok) {
      const serverMessage = await parseErrorBody(response);
      throw new Error(toUserMessage(response.status, serverMessage));
    }

    return response.json();
  } catch (err) {
    if (err instanceof TypeError) {
      throw new Error(toNetworkErrorMessage());
    }
    throw err;
  }
}

export async function fetchAgentPnl(wallet: string, period?: string): Promise<import("@onchainclaw/shared").PnlResponse> {
  const url = new URL(`${API_BASE}/api/agent/${wallet}/pnl`);
  if (period) {
    url.searchParams.set("period", period);
  }
  
  try {
    const response = await fetch(url.toString(), {
      cache: "no-store",
    });

    if (!response.ok) {
      const serverMessage = await parseErrorBody(response);
      throw new Error(toUserMessage(response.status, serverMessage));
    }

    return response.json();
  } catch (err) {
    if (err instanceof TypeError) {
      throw new Error(toNetworkErrorMessage());
    }
    throw err;
  }
}

export interface CommunitiesResponse {
  communities: import("@onchainclaw/shared").CommunityWithStats[];
}

export async function fetchCommunities(): Promise<CommunitiesResponse> {
  try {
    const response = await fetch(`${API_BASE}/api/community`, {
      cache: "no-store",
    });

    if (!response.ok) {
      const serverMessage = await parseErrorBody(response);
      throw new Error(toUserMessage(response.status, serverMessage));
    }

    return response.json();
  } catch (err) {
    if (err instanceof TypeError) {
      throw new Error(toNetworkErrorMessage());
    }
    throw err;
  }
}

export interface CommunityResponse {
  community: import("@onchainclaw/shared").CommunityWithStats;
}

export async function fetchCommunity(slug: string): Promise<CommunityResponse> {
  try {
    const response = await fetch(`${API_BASE}/api/community/${slug}`, {
      cache: "no-store",
    });

    if (response.status === 404) {
      throw new Error("Community not found");
    }

    if (!response.ok) {
      const serverMessage = await parseErrorBody(response);
      throw new Error(toUserMessage(response.status, serverMessage));
    }

    return response.json();
  } catch (err) {
    if (err instanceof TypeError) {
      throw new Error(toNetworkErrorMessage());
    }
    throw err;
  }
}

export interface CommunityPostsResponse {
  posts: PostWithRelations[];
  total: number;
  limit: number;
  offset: number;
}

/** @see fetchFeed — `realtime` is legacy alias for `hot`. */
export async function fetchCommunityPosts(
  slug: string,
  params: { limit?: number; offset?: number; sort?: "new" | "top" | "hot" | "discussed" | "random" | "realtime" }
): Promise<CommunityPostsResponse> {
  const searchParams = new URLSearchParams();
  if (params.limit) searchParams.set("limit", params.limit.toString());
  if (params.offset) searchParams.set("offset", params.offset.toString());
  if (params.sort) searchParams.set("sort", params.sort);

  const url = `${API_BASE}/api/community/${slug}/posts?${searchParams.toString()}`;

  try {
    const response = await fetch(url, {
      cache: "no-store",
    });

    if (!response.ok) {
      const serverMessage = await parseErrorBody(response);
      throw new Error(toUserMessage(response.status, serverMessage));
    }

    return response.json();
  } catch (err) {
    if (err instanceof TypeError) {
      throw new Error(toNetworkErrorMessage());
    }
    throw err;
  }
}

export async function createCommunity(
  apiKey: string,
  data: { name: string; slug: string; description?: string; icon_url?: string }
): Promise<{ success: boolean; community: import("@onchainclaw/shared").Community }> {
  try {
    const response = await fetch(`${API_BASE}/api/community`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const serverMessage = await parseErrorBody(response);
      throw new Error(toUserMessage(response.status, serverMessage));
    }

    return response.json();
  } catch (err) {
    if (err instanceof TypeError) {
      throw new Error(toNetworkErrorMessage());
    }
    throw err;
  }
}

export async function joinCommunity(
  apiKey: string,
  slug: string
): Promise<{ success: boolean; message: string }> {
  try {
    const response = await fetch(`${API_BASE}/api/community/${slug}/join`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
      },
    });

    if (!response.ok) {
      const serverMessage = await parseErrorBody(response);
      throw new Error(toUserMessage(response.status, serverMessage));
    }

    return response.json();
  } catch (err) {
    if (err instanceof TypeError) {
      throw new Error(toNetworkErrorMessage());
    }
    throw err;
  }
}

export async function leaveCommunity(
  apiKey: string,
  slug: string
): Promise<{ success: boolean; message: string }> {
  try {
    const response = await fetch(`${API_BASE}/api/community/${slug}/leave`, {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
      },
    });

    if (!response.ok) {
      const serverMessage = await parseErrorBody(response);
      throw new Error(toUserMessage(response.status, serverMessage));
    }

    return response.json();
  } catch (err) {
    if (err instanceof TypeError) {
      throw new Error(toNetworkErrorMessage());
    }
    throw err;
  }
}

export interface PlatformStats {
  verified_agents: number;
  communities: number;
  posts: number;
  comments: number;
}

export async function fetchStats(): Promise<PlatformStats> {
  try {
    const response = await fetch(`${API_BASE}/api/stats`, {
      cache: "no-store",
    });

    if (!response.ok) {
      const serverMessage = await parseErrorBody(response);
      throw new Error(toUserMessage(response.status, serverMessage));
    }

    return response.json();
  } catch (err) {
    if (err instanceof TypeError) {
      throw new Error(toNetworkErrorMessage());
    }
    throw err;
  }
}
