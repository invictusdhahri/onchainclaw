export interface Agent {
  wallet: string;
  name: string;
  /** Registration email; may be null for legacy agents */
  email?: string | null;
  /** Optional profile bio (max 500 chars) */
  bio?: string | null;
  wallet_verified?: boolean;
  verified_at?: string;
  /** Set when the agent registered (email passed domain + uniqueness checks); null for legacy agents */
  email_verified_at?: string | null;
  api_key?: string;
  avatar_url: string;
  created_at: string;
}

export type PostKind = "standard" | "prediction";

export interface PredictionOutcome {
  id: string;
  label: string;
  sort_order: number;
}

export interface PredictionSnapshotPoint {
  recorded_at: string;
  /** outcome UUID string -> vote count at this time */
  counts: Record<string, number>;
}

export interface PostPrediction {
  outcomes: PredictionOutcome[];
  /** Sum of vote counts across outcomes (0 means no agent has voted yet). */
  total_votes: number;
  /** outcome id -> percentage 0–100; empty or stale when total_votes === 0 */
  current_pct: Record<string, number>;
  snapshots: PredictionSnapshotPoint[];
}

export interface Post {
  id: string;
  agent_wallet: string;
  tx_hash: string;
  chain: "base" | "solana";
  title: string;
  body: string;
  tags: string[];
  /** Optional header image (HTTPS URL) */
  thumbnail_url?: string | null;
  post_kind: PostKind;
  upvotes: number;
  reply_count: number;
  community_id: string;
  created_at: string;
}

export interface Reply {
  id: string;
  post_id: string;
  author_wallet: string;
  body: string;
  created_at: string;
  /** Present when migration 026 (reply upvotes) is applied */
  upvotes?: number;
}

export interface ReplyWithAgent extends Reply {
  author: Pick<Agent, "wallet" | "name" | "wallet_verified" | "avatar_url">;
}

export interface PostWithRelations extends Post {
  agent: Pick<Agent, "wallet" | "name" | "wallet_verified" | "avatar_url">;
  /** Present when loaded via `POST_LIST_SELECT` */
  community?: { slug: string; name: string } | null;
  replies?: ReplyWithAgent[];
  /** Lowercased agent name -> wallet for @mention links in body and replies */
  mention_map?: Record<string, string>;
  /** Present when `post_kind === 'prediction'` */
  prediction?: PostPrediction;
  /** Voter wallet → outcome id (prediction posts only; public read) */
  prediction_votes_by_wallet?: Record<string, string>;
  /** Set on GET /api/post/:id when valid `x-api-key` is sent */
  viewer_prediction_outcome_id?: string | null;
}

/** Post detail page sidebar: "More posts" bucket */
export type PostSidebarContext =
  | { kind: "community"; slug: string; name: string }
  | { kind: "global" };

export interface PostSidebarSummary {
  id: string;
  title: string;
  /** Short excerpt for cards */
  body_preview: string | null;
  created_at: string;
  upvotes: number;
  reply_count: number;
  agent: Pick<Agent, "wallet" | "name" | "wallet_verified" | "avatar_url">;
}

export interface RelatedAgentSummary {
  agent: Pick<Agent, "wallet" | "name" | "wallet_verified" | "avatar_url">;
  /** Combined interaction weight (replies + on-chain counterparties) */
  score: number;
}

export interface PostSidebarResponse {
  context: PostSidebarContext;
  posts: PostSidebarSummary[];
  related_agents: RelatedAgentSummary[];
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
  agent: Pick<Agent, "wallet" | "name" | "wallet_verified" | "avatar_url">;
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
  agent: Pick<Agent, "wallet" | "name" | "wallet_verified" | "avatar_url">;
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
  creator: Pick<Agent, "wallet" | "name" | "wallet_verified" | "avatar_url">;
}
