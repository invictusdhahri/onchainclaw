import { logger } from "./logger.js";
import {
  getTokenMetadataCache,
  mgetTokenMetadataCache,
  setTokenMetadataCache,
} from "./redis.js";
/**
 * Codex API client for fetching Solana token metadata.
 * Docs: https://docs.codex.io/
 */

const DEFAULT_CODEX_GRAPHQL = "https://graph.codex.io/graphql";
const CODEX_API_URL =
  process.env.CODEX_GRAPHQL_URL?.trim() || DEFAULT_CODEX_GRAPHQL;
const CODEX_API_KEY = process.env.CODEX_API_KEY;

const TRANSIENT_NETWORK_CODES = new Set([
  "ENOTFOUND",
  "ECONNREFUSED",
  "ETIMEDOUT",
  "EAI_AGAIN",
]);

let loggedCodexNetworkIssue = false;

function errnoFromError(error: unknown): string | undefined {
  if (!error || typeof error !== "object") return undefined;
  const e = error as NodeJS.ErrnoException & { cause?: unknown };
  if (typeof e.code === "string") return e.code;
  if (e.cause && typeof e.cause === "object" && e.cause !== null) {
    const c = e.cause as NodeJS.ErrnoException;
    if (typeof c.code === "string") return c.code;
  }
  return undefined;
}
const SOLANA_NETWORK_ID = 1399811149;

export interface TokenMetadata {
  name: string | null;
  symbol: string | null;
  imageUrl: string | null;
}

interface CodexGraphqlResponse {
  errors?: unknown;
  data?: {
    token?: {
      name?: string | null;
      symbol?: string | null;
      info?: { imageSmallUrl?: string | null } | null;
    } | null;
  };
}

// In-memory cache to avoid redundant API calls for the same mint within a process lifetime
const metadataCache = new Map<string, TokenMetadata>();

/** Timeout for individual Codex GraphQL requests (ms) */
const CODEX_FETCH_TIMEOUT_MS = 5000;

/**
 * Fetch token metadata from Codex API.
 * Cache hierarchy: in-memory → Redis (24 h TTL) → Codex API.
 */
export async function fetchTokenMetadata(
  mintAddress: string
): Promise<TokenMetadata | null> {
  // 1. In-memory cache (fastest — same process)
  if (metadataCache.has(mintAddress)) {
    return metadataCache.get(mintAddress)!;
  }

  // 2. Redis cache (survives server restarts / multiple instances)
  const redisHit = await getTokenMetadataCache(mintAddress);
  if (redisHit) {
    metadataCache.set(mintAddress, redisHit);
    return redisHit;
  }

  if (!CODEX_API_KEY) {
    logger.warn("CODEX_API_KEY not set, skipping token metadata fetch");
    return null;
  }

  try {
    const query = `
      query GetToken($address: String!, $networkId: Int!) {
        token(input: { address: $address, networkId: $networkId }) {
          name
          symbol
          info {
            imageSmallUrl
          }
        }
      }
    `;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), CODEX_FETCH_TIMEOUT_MS);

    let response: Response;
    try {
      response = await fetch(CODEX_API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: CODEX_API_KEY,
        },
        body: JSON.stringify({
          query,
          variables: {
            address: mintAddress,
            networkId: SOLANA_NETWORK_ID,
          },
        }),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeoutId);
    }

    if (!response.ok) {
      logger.error(
        `Codex API error: ${response.status} ${response.statusText}`
      );
      return null;
    }

    const result = (await response.json()) as CodexGraphqlResponse;

    if (result.errors) {
      logger.error("Codex GraphQL errors:", result.errors);
      return null;
    }

    const token = result.data?.token;
    if (!token) {
      logger.warn(`Token ${mintAddress} not found in Codex`);
      return null;
    }

    const metadata: TokenMetadata = {
      name: token.name || null,
      symbol: token.symbol || null,
      imageUrl: token.info?.imageSmallUrl || null,
    };

    // Store in both caches
    metadataCache.set(mintAddress, metadata);
    void setTokenMetadataCache(mintAddress, metadata);

    return metadata;
  } catch (error) {
    const code = errnoFromError(error);
    if (code && TRANSIENT_NETWORK_CODES.has(code)) {
      if (!loggedCodexNetworkIssue) {
        loggedCodexNetworkIssue = true;
        logger.warn(
          `[codex] Cannot reach Codex API (${code} → ${CODEX_API_URL}). ` +
            "Token metadata will be skipped until DNS/network works. " +
            "Endpoint is correct per docs; fix VPN/firewall/DNS or try another network."
        );
      }
      return null;
    }
    // AbortError = timeout
    if (error instanceof Error && error.name === "AbortError") {
      logger.warn(`[codex] Timeout fetching metadata for ${mintAddress}`);
      return null;
    }
    logger.error(`Failed to fetch token metadata for ${mintAddress}:`, error);
    return null;
  }
}

/**
 * Batch fetch token metadata for multiple mints.
 * Uses Redis MGET for a single round-trip on warm cache, then fans out to Codex
 * only for the remaining misses.
 * Returns a Map of mintAddress -> TokenMetadata.
 */
export async function fetchBatchTokenMetadata(
  mintAddresses: string[]
): Promise<Map<string, TokenMetadata>> {
  const results = new Map<string, TokenMetadata>();
  if (mintAddresses.length === 0) return results;

  // 1. Satisfy as many hits as possible from in-memory cache
  const misses: string[] = [];
  for (const mint of mintAddresses) {
    const cached = metadataCache.get(mint);
    if (cached) {
      results.set(mint, cached);
    } else {
      misses.push(mint);
    }
  }
  if (misses.length === 0) return results;

  // 2. Single Redis MGET round-trip for remaining misses
  const redisHits = await mgetTokenMetadataCache(misses);
  const codexMisses: string[] = [];
  for (const mint of misses) {
    const hit = redisHits.get(mint);
    if (hit) {
      metadataCache.set(mint, hit);
      results.set(mint, hit);
    } else {
      codexMisses.push(mint);
    }
  }
  if (codexMisses.length === 0) return results;

  // 3. Fetch remaining from Codex in parallel
  await Promise.all(
    codexMisses.map(async (mint) => {
      const metadata = await fetchTokenMetadata(mint);
      if (metadata) {
        results.set(mint, metadata);
      }
    })
  );

  return results;
}
