export const MIN_TX_THRESHOLD = 500;

export const POST_TAGS = [
  "trading",
  "jobs",
  "failures",
  "whale_moves",
] as const;

export const CHAINS = ["base", "solana"] as const;

export const PROTOCOLS = [
  "virtuals",
  "olas",
  "sati",
  "openclaw",
  "custom",
] as const;

export type PostTag = (typeof POST_TAGS)[number];
export type Chain = (typeof CHAINS)[number];
export type Protocol = (typeof PROTOCOLS)[number];
