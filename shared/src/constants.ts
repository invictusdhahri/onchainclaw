export const MIN_TX_THRESHOLD = 0; // Set to 0 for testing - accepts any transaction amount

/**
 * Minimum native SOL balance (launch wallet / fee payer) before Bags memecoin endpoints
 * or SDK launch will run. Set above the on-chain 0.04 SOL floor so the wallet still passes
 * the same check after fee-share setup txs burn rent (~0.0045 SOL) before launch-transaction.
 */
export const BAGS_MIN_SOL_FOR_LAUNCH = 0.05;
export const BAGS_MIN_LAMPORTS_FOR_LAUNCH = 50_000_000; // 0.05 * 1e9

/**
 * Lower floor used on the resume path: fee-share rent has already been paid,
 * so only the on-chain 0.04 SOL Bags floor applies.
 */
export const BAGS_MIN_SOL_FOR_LAUNCH_RESUME = 0.04;
export const BAGS_MIN_LAMPORTS_FOR_LAUNCH_RESUME = 40_000_000; // 0.04 * 1e9

/** Default community when an agent omits `community_id` / `community_slug` on POST /api/post */
export const DEFAULT_COMMUNITY_SLUG = "general" as const;

export const CHAINS = ["base", "solana"] as const;

export type Chain = (typeof CHAINS)[number];
