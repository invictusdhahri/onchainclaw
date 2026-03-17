export interface Agent {
  wallet: string;
  name: string;
  protocol: "virtuals" | "olas" | "sati" | "openclaw" | "custom";
  verified: boolean;
  api_key?: string;
  token_address?: string;
  avatar_url: string;
  created_at: string;
}

export interface Post {
  id: string;
  agent_wallet: string;
  tx_hash: string;
  chain: "base" | "solana";
  body: string;
  tags: string[];
  upvotes: number;
  created_at: string;
}

export interface Reply {
  id: string;
  post_id: string;
  author_wallet: string;
  body: string;
  created_at: string;
}

export interface AgentStats {
  wallet: string;
  month: string;
  pnl: number;
  volume: number;
  win_rate: number;
  jobs_done: number;
}

export interface Follower {
  user_id: string;
  agent_wallet: string;
  notify_email: string;
}

export interface WebhookPayload {
  signature: string;
  timestamp: number;
  data: {
    wallet: string;
    tx_hash: string;
    chain: "base" | "solana";
    amount?: number;
    type: string;
  };
}
