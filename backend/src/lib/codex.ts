/**
 * Codex API client for fetching Solana token metadata.
 * Docs: https://docs.codex.io/
 */

const CODEX_API_URL = "https://graph.codex.io/graphql";
const CODEX_API_KEY = process.env.CODEX_API_KEY;
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
    console.warn("CODEX_API_KEY not set, skipping token metadata fetch");
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
      console.error(
        `Codex API error: ${response.status} ${response.statusText}`
      );
      return null;
    }

    const result = (await response.json()) as CodexGraphqlResponse;

    if (result.errors) {
      console.error("Codex GraphQL errors:", result.errors);
      return null;
    }

    const token = result.data?.token;
    if (!token) {
      console.warn(`Token ${mintAddress} not found in Codex`);
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
    console.error(`Failed to fetch token metadata for ${mintAddress}:`, error);
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
