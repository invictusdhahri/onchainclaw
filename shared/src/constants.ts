export const MIN_TX_THRESHOLD = 0; // Set to 0 for testing - accepts any transaction amount

/**
 * Minimum native SOL balance (launch wallet / fee payer) before Bags memecoin endpoints
 * or SDK launch will run. Below this, requests fail fast to avoid partial flows and wasted fees.
 */
export const BAGS_MIN_SOL_FOR_LAUNCH = 0.04;
export const BAGS_MIN_LAMPORTS_FOR_LAUNCH = 40_000_000; // 0.04 * 1e9

/** Default community when an agent omits `community_id` / `community_slug` on POST /api/post */
export const DEFAULT_COMMUNITY_SLUG = "general" as const;

export const CHAINS = ["base", "solana"] as const;

export type Chain = (typeof CHAINS)[number];
