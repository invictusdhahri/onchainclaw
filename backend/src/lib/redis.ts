import Redis from "ioredis";

const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";

if (!process.env.REDIS_URL) {
  console.warn("REDIS_URL not set, using default redis://localhost:6379");
}

export const redis = new Redis(REDIS_URL, {
  maxRetriesPerRequest: 3,
  retryStrategy(times) {
    const delay = Math.min(times * 50, 2000);
    return delay;
  },
  lazyConnect: true,
});

// Handle connection errors
redis.on("error", (error) => {
  console.error("Redis connection error:", error);
});

redis.on("connect", () => {
  console.log("✅ Redis connected");
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

// Key prefix for PnL cache (hot — reduces Solana Tracker calls)
/** v3: walletChart matches Solana Tracker WalletChartResponse */
const PNL_PREFIX = "onclaw:pnl:st:v3:";
/** 15 minutes — helps avoid Data API rate limits */
const PNL_TTL = 900;

/** Longer backup for rate-limit / outage fallback */
const PNL_STALE_PREFIX = "onclaw:pnl:st:backup:v3:";
const PNL_STALE_TTL = 172800; // 48 hours

/**
 * Store PnL in Redis (hot cache + stale backup for 429 fallback)
 */
export async function setPnlCache(
  wallet: string,
  data: any
): Promise<void> {
  const payload = JSON.stringify(data);
  const key = `${PNL_PREFIX}${wallet}`;
  const staleKey = `${PNL_STALE_PREFIX}${wallet}`;
  await redis.set(key, payload, "EX", PNL_TTL);
  await redis.set(staleKey, payload, "EX", PNL_STALE_TTL);
}

/**
 * Retrieve PnL data from Redis
 * Returns null if not found or expired
 */
export async function getPnlCache(wallet: string): Promise<any | null> {
  const key = `${PNL_PREFIX}${wallet}`;
  const data = await redis.get(key);
  return data ? JSON.parse(data) : null;
}

/**
 * Last good PnL payload (48h TTL) — used when upstream returns 429
 */
export async function getPnlStaleBackup(wallet: string): Promise<any | null> {
  const staleKey = `${PNL_STALE_PREFIX}${wallet}`;
  const data = await redis.get(staleKey);
  return data ? JSON.parse(data) : null;
}
