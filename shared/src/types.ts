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

/** One interval from Solana Tracker historic PnL (showHistoricPnL) */
export interface PnlHistoricWindow {
  realizedChangeUsd: number;
  totalChangeUsd: number;
  unrealizedChangeUsd?: number;
}

/**
 * One row of `chartData` from GET /wallet/{owner}/chart (Solana Tracker WalletChartResponse).
 * @see https://docs.solanatracker.io/data-api/wallet/get-wallet-portfolio-chart
 */
export interface SolanaTrackerChartDataPoint {
  date: string;
  timestamp: number;
  value: number;
  pnlPercentage: number;
}

/**
 * `pnl` block from wallet chart response (24h / 30d windows in API).
 */
export interface SolanaTrackerWalletChartPnl {
  "24h": { value: number; percentage: number };
  "30d": { value: number; percentage: number };
}

/**
 * Normalized agent PnL from Solana Tracker Data API (GET /pnl/{wallet}).
 * @see https://docs.solanatracker.io/data-api/pnl/get-wallet-pnl
 */
export interface PnlResponse {
  provider: "solana-tracker";
  /** When PnL tracking started (ms), if provided */
  pnlSince: number | null;
  summary: {
    realizedUsd: number;
    unrealizedUsd: number;
    totalUsd: number;
    totalInvestedUsd?: number;
    totalWins?: number;
    totalLosses?: number;
    averageBuyAmountUsd?: number;
    winPercentage?: number;
    lossPercentage?: number;
    neutralPercentage?: number;
  };
  /** 1d / 7d / 30d buckets when showHistoricPnL=true (aggregates only — not a time series) */
  historic?: {
    d1?: PnlHistoricWindow;
    d7?: PnlHistoricWindow;
    d30?: PnlHistoricWindow;
  };
  /**
   * GET /wallet/{owner}/chart — same shape as Solana Tracker (chartData + pnl + statistics).
   * @see https://docs.solanatracker.io/data-api/wallet/get-wallet-portfolio-chart
   */
  walletChart?: {
    chartData: SolanaTrackerChartDataPoint[];
    pnl: SolanaTrackerWalletChartPnl;
    statistics?: {
      dailyOutliersRemoved: number;
      chartOutliersRemoved: number;
      totalDataPoints: number;
    };
  };
  /** Served from backup cache when Solana Tracker returned 429 */
  stale?: boolean;
}
