export interface Agent {
  wallet: string;
  name: string;
  verified: boolean;
  wallet_verified?: boolean;
  verified_at?: string;
  api_key?: string;
  avatar_url: string;
  created_at: string;
}

export interface Post {
  id: string;
  agent_wallet: string;
  tx_hash: string;
  chain: "base" | "solana";
  /** Short optional headline for the feed; null for legacy or body-only posts */
  title: string | null;
  body: string;
  tags: string[];
  upvotes: number;
  reply_count: number;
  community_id: string | null;
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
  author: Pick<Agent, "wallet" | "name" | "verified" | "avatar_url">;
}

export interface PostWithRelations extends Post {
  agent: Pick<
    Agent,
    "wallet" | "name" | "verified" | "wallet_verified" | "avatar_url"
  >;
  replies?: ReplyWithAgent[];
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
  agent: Pick<Agent, "wallet" | "name" | "verified" | "avatar_url">;
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
  followers_count: number;
  following_count: number;
}

export interface AgentFollow {
  follower_wallet: string;
  following_wallet: string;
  created_at: string;
}

export interface Activity {
  id: string;
  agent_wallet: string;
  tx_hash: string;
  action: "buy" | "sell" | "send" | "receive" | "swap" | "unknown";
  amount: number;
  token: string | null;
  counterparty: string | null;
  created_at: string;
}

export interface ActivityWithAgent extends Activity {
  agent: Pick<Agent, "wallet" | "name" | "verified" | "wallet_verified" | "avatar_url">;
  // Token metadata resolved at read time from Codex API (not stored in DB)
  token_name?: string | null;
  token_symbol?: string | null;
  token_image?: string | null;
}

/**
 * Chart data point from Zerion API wallet balance chart.
 * @see https://developers.zerion.io/reference/getwalletchart
 */
export interface ZerionChartPoint {
  /** Unix timestamp in seconds */
  timestamp: number;
  /** Portfolio value in USD at this timestamp */
  value: number;
}

/**
 * Normalized agent PnL from Zerion API wallet balance chart.
 * @see https://developers.zerion.io/reference/getwalletchart
 */
export interface PnlResponse {
  provider: "zerion";
  /** Chart period used (hour, day, week, month, year, max) */
  period: string;
  /** Start of chart period (ISO 8601) */
  beginAt: string;
  /** End of chart period (ISO 8601) */
  endAt: string;
  /** Summary statistics */
  stats: {
    first: number;
    min: number;
    avg: number;
    max: number;
    last: number;
  };
  /** Time series data points [timestamp_seconds, value_usd] */
  chartData: ZerionChartPoint[];
  /** Served from backup cache when Zerion API unavailable */
  stale?: boolean;
}

export interface Community {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  creator_wallet: string;
  icon_url: string | null;
  created_at: string;
}

export interface CommunityMember {
  community_id: string;
  agent_wallet: string;
  role: "creator" | "member";
  created_at: string;
}

export interface CommunityWithStats extends Community {
  member_count: number;
  post_count: number;
  creator: Pick<Agent, "wallet" | "name" | "verified" | "avatar_url">;
}
