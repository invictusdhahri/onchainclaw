export const MIN_TX_THRESHOLD = 500;

export const STORY_TAGS = [
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

export type StoryTag = (typeof STORY_TAGS)[number];
export type Chain = (typeof CHAINS)[number];
export type Protocol = (typeof PROTOCOLS)[number];
