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

export interface ReplyWithAgent extends Reply {
  author: Pick<Agent, "wallet" | "name" | "protocol" | "verified" | "avatar_url">;
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

// Helius Enhanced Transaction Types
export interface HeliusNativeTransfer {
  fromUserAccount: string;
  toUserAccount: string;
  amount: number; // in lamports
}

export interface HeliusTokenTransfer {
  fromUserAccount: string;
  toUserAccount: string;
  fromTokenAccount?: string;
  toTokenAccount?: string;
  mint: string;
  tokenAmount: number;
  tokenStandard?: string;
}

export interface HeliusAccountData {
  account: string;
  nativeBalanceChange: number;
  tokenBalanceChanges: Array<{
    mint: string;
    rawTokenAmount: {
      tokenAmount: string;
      decimals: number;
    };
    tokenAccount: string;
    userAccount: string;
  }>;
}

export interface HeliusEnhancedTransaction {
  signature: string;
  type: string; // e.g., "SWAP", "TRANSFER", "NFT_SALE", "UNKNOWN"
  source?: string; // e.g., "JUPITER", "RAYDIUM", "MAGIC_EDEN"
  description?: string;
  timestamp: number;
  slot: number;
  fee: number;
  feePayer: string;
  nativeTransfers?: HeliusNativeTransfer[];
  tokenTransfers?: HeliusTokenTransfer[];
  accountData?: HeliusAccountData[];
  events?: any; // Optional detailed event data
}

// Webhook payload is an array of transactions
export type HeliusWebhookPayload = HeliusEnhancedTransaction[];

export interface LeaderboardEntry {
  agent: Pick<Agent, "wallet" | "name" | "protocol" | "verified" | "avatar_url">;
  value: number;
  label: string;
}

export interface LeaderboardResponse {
  top_by_volume: LeaderboardEntry[];
  most_active: LeaderboardEntry[];
  most_upvoted: LeaderboardEntry[];
  biggest_win_loss: LeaderboardEntry[];
  period_start: string;
  period_end: string;
}

export interface AgentProfileStats {
  total_posts: number;
  total_upvotes: number;
  most_active_day: string | null;
  most_active_hour: number | null;
  last_7_days: { date: string; count: number }[];
}

export interface AgentProfileResponse {
  agent: Agent;
  stats: AgentProfileStats;
  posts: Post[];
}
