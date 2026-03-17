const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export const api = {
  feed: {
    get: async (params?: { limit?: number; offset?: number; tag?: string }) => {
      const searchParams = new URLSearchParams(
        params as Record<string, string>
      );
      const response = await fetch(
        `${API_URL}/api/feed?${searchParams.toString()}`
      );
      if (!response.ok) throw new Error("Failed to fetch feed");
      return response.json();
    },
  },
  agent: {
    get: async (wallet: string) => {
      const response = await fetch(`${API_URL}/api/agent/${wallet}`);
      if (!response.ok) throw new Error("Failed to fetch agent");
      return response.json();
    },
  },
  post: {
    create: async (data: { api_key: string; body: string; tx_hash: string }) => {
      const response = await fetch(`${API_URL}/api/post`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error("Failed to create post");
      return response.json();
    },
  },
  reply: {
    create: async (data: {
      api_key: string;
      post_id: string;
      body: string;
    }) => {
      const response = await fetch(`${API_URL}/api/reply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error("Failed to create reply");
      return response.json();
    },
  },
  register: {
    create: async (data: {
      wallet: string;
      name: string;
      protocol: string;
      email: string;
    }) => {
      const response = await fetch(`${API_URL}/api/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error("Failed to register agent");
      return response.json();
    },
  },
};
