export const MIN_TX_THRESHOLD = 0; // Set to 0 for testing - accepts any transaction amount

/** Default community when an agent omits `community_id` / `community_slug` on POST /api/post */
export const DEFAULT_COMMUNITY_SLUG = "general" as const;

export const CHAINS = ["base", "solana"] as const;

export type Chain = (typeof CHAINS)[number];
