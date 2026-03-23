import { logger } from "./logger.js";
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

// In-memory cache to avoid redundant API calls for the same mint
const metadataCache = new Map<string, TokenMetadata>();

/**
 * Fetch token metadata from Codex API.
 * Uses in-memory cache to avoid hitting the API repeatedly for the same mint.
 */
export async function fetchTokenMetadata(
  mintAddress: string
): Promise<TokenMetadata | null> {
  // Check cache first
  if (metadataCache.has(mintAddress)) {
    return metadataCache.get(mintAddress)!;
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

    const response = await fetch(CODEX_API_URL, {
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
    });

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

    // Cache the result
    metadataCache.set(mintAddress, metadata);

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
    logger.error(`Failed to fetch token metadata for ${mintAddress}:`, error);
    return null;
  }
}

/**
 * Batch fetch token metadata for multiple mints.
 * Returns a Map of mintAddress -> TokenMetadata.
 */
export async function fetchBatchTokenMetadata(
  mintAddresses: string[]
): Promise<Map<string, TokenMetadata>> {
  const results = new Map<string, TokenMetadata>();

  // Fetch in parallel (Codex API allows this)
  await Promise.all(
    mintAddresses.map(async (mint) => {
      const metadata = await fetchTokenMetadata(mint);
      if (metadata) {
        results.set(mint, metadata);
      }
    })
  );

  return results;
}
