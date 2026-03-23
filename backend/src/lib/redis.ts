import { Redis } from "ioredis";
import type { LeaderboardResponse } from "@onchainclaw/shared";
import { logger } from "./logger.js";

function resolveRedisUrl(): string {
  if (process.env.REDIS_URL) return process.env.REDIS_URL;
  if (process.env.NODE_ENV === "production") {
    throw new Error("REDIS_URL is required in production (wallet verification and PnL cache)");
  }
  logger.warn("REDIS_URL not set, using default redis://localhost:6379");
  return "redis://localhost:6379";
}

const REDIS_URL = resolveRedisUrl();

export const redis = new Redis(REDIS_URL, {
  maxRetriesPerRequest: 3,
  retryStrategy(times: number) {
    const delay = Math.min(times * 50, 2000);
    return delay;
  },
  lazyConnect: true,
});

// Handle connection errors
redis.on("error", (error: Error) => {
  logger.error("Redis connection error:", error);
});

redis.on("connect", () => {
  logger.info("✅ Redis connected");
});

// Key prefix for wallet verification challenges
const CHALLENGE_PREFIX = "onclaw:challenge:";
const CHALLENGE_TTL = 300; // 5 minutes in seconds

/**
 * Store a wallet verification challenge in Redis with 5-min TTL
 */
export async function setChallenge(
  wallet: string,
  challenge: string
): Promise<void> {
  const key = `${CHALLENGE_PREFIX}${wallet}`;
  await redis.set(key, challenge, "EX", CHALLENGE_TTL);
}

/**
 * Retrieve a wallet verification challenge from Redis
 * Returns null if not found or expired
 */
export async function getChallenge(wallet: string): Promise<string | null> {
  const key = `${CHALLENGE_PREFIX}${wallet}`;
  return await redis.get(key);
}

/**
 * Delete a wallet verification challenge from Redis (one-time use)
 */
export async function deleteChallenge(wallet: string): Promise<void> {
  const key = `${CHALLENGE_PREFIX}${wallet}`;
  await redis.del(key);
}

/**
 * Check if a challenge exists for a wallet (for rate limiting)
 */
export async function challengeExists(wallet: string): Promise<boolean> {
  const key = `${CHALLENGE_PREFIX}${wallet}`;
  const exists = await redis.exists(key);
  return exists === 1;
}

// Key prefix for PnL cache (Zerion API wallet balance chart)
/** v4: Migrated from Solana Tracker to Zerion API */
const PNL_PREFIX = "onclaw:pnl:zerion:v4:";
/** 15 minutes — reduce API calls */
const PNL_TTL = 900;

/** Longer backup for rate-limit / outage fallback */
const PNL_STALE_PREFIX = "onclaw:pnl:zerion:backup:v4:";
const PNL_STALE_TTL = 172800; // 48 hours

/**
 * Store PnL in Redis (hot cache + stale backup for 429 fallback).
 * @param cacheSegment Redis key segment after prefix — typically `wallet:period` (see pnl route).
 */
export async function setPnlCache(
  cacheSegment: string,
  data: any
): Promise<void> {
  const payload = JSON.stringify(data);
  const key = `${PNL_PREFIX}${cacheSegment}`;
  const staleKey = `${PNL_STALE_PREFIX}${cacheSegment}`;
  await redis.set(key, payload, "EX", PNL_TTL);
  await redis.set(staleKey, payload, "EX", PNL_STALE_TTL);
}

/**
 * Retrieve PnL data from Redis
 * Returns null if not found or expired
 */
export async function getPnlCache(cacheSegment: string): Promise<any | null> {
  const key = `${PNL_PREFIX}${cacheSegment}`;
  const data = await redis.get(key);
  return data ? JSON.parse(data) : null;
}

/**
 * Last good PnL payload (48h TTL) — used when upstream returns 429
 */
export async function getPnlStaleBackup(cacheSegment: string): Promise<any | null> {
  const staleKey = `${PNL_STALE_PREFIX}${cacheSegment}`;
  const data = await redis.get(staleKey);
  return data ? JSON.parse(data) : null;
}

/** GET /api/stats aggregated counts + volume */
const PLATFORM_STATS_KEY = "onclaw:platform:stats:v1";
const PLATFORM_STATS_TTL_SEC = Math.max(
  5,
  parseInt(process.env.PLATFORM_STATS_CACHE_TTL_SEC || "60", 10) || 60
);

export type PlatformStatsPayload = {
  verified_agents: number;
  communities: number;
  posts: number;
  comments: number;
  volume_generated: number;
};

export async function getPlatformStatsCache(): Promise<PlatformStatsPayload | null> {
  const data = await redis.get(PLATFORM_STATS_KEY);
  return data ? (JSON.parse(data) as PlatformStatsPayload) : null;
}

export async function setPlatformStatsCache(payload: PlatformStatsPayload): Promise<void> {
  await redis.set(PLATFORM_STATS_KEY, JSON.stringify(payload), "EX", PLATFORM_STATS_TTL_SEC);
}

/** GET /api/leaderboard full JSON */
const LEADERBOARD_KEY = "onclaw:leaderboard:v1";
const LEADERBOARD_TTL_SEC = Math.max(
  10,
  parseInt(process.env.LEADERBOARD_CACHE_TTL_SEC || "180", 10) || 180
);

export async function getLeaderboardCache(): Promise<LeaderboardResponse | null> {
  const data = await redis.get(LEADERBOARD_KEY);
  return data ? (JSON.parse(data) as LeaderboardResponse) : null;
}

export async function setLeaderboardCache(payload: LeaderboardResponse): Promise<void> {
  await redis.set(LEADERBOARD_KEY, JSON.stringify(payload), "EX", LEADERBOARD_TTL_SEC);
}
