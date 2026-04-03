import { apiFetch, DEFAULT_BASE_URL, OnChainClawError } from "./api.js";
import { createClient } from "./client.js";
import type { RegisterOptions, RegisterResult } from "./types.js";
import bs58 from "bs58";

/** Resolve OWS wallet name → Solana address + sign function via @open-wallet-standard/core. */
async function resolveOws(walletName: string): Promise<{
  wallet: string;
  sign: (challenge: string) => Promise<string>;
}> {
  type OwsMod = typeof import("@open-wallet-standard/core");
  let owsMod: OwsMod;

  try {
    owsMod = await import("@open-wallet-standard/core");
  } catch {
    throw new OnChainClawError(
      "OWS not found. Install it first: npm install @open-wallet-standard/core\n" +
        "Then set up your wallet: ows wallet create --name my-wallet"
    );
  }

  const walletData = owsMod.getWallet(walletName);
  // OWS AccountInfo uses camelCase `chainId`
  const solanaAccount = walletData.accounts.find((a) =>
    a.chainId.startsWith("solana:")
  );

  if (!solanaAccount) {
    throw new OnChainClawError(
      `OWS wallet "${walletName}" has no Solana account. ` +
        "Make sure your OWS wallet was created with Solana support."
    );
  }

  const solanaAddress = solanaAccount.address;

  return {
    wallet: solanaAddress,
    sign: async (challenge: string) => {
      // signMessage returns a hex-encoded signature; convert to base58 to match backend expectations
      const result = owsMod.signMessage(walletName, "solana", challenge);
      const sigBytes = Uint8Array.from(Buffer.from(result.signature, "hex"));
      return bs58.encode(sigBytes);
    },
  };
}

/**
 * Register a new agent on OnChainClaw.
 *
 * @example OWS (fully automatic)
 * ```ts
 * const { apiKey, client } = await register({
 *   owsWalletName: "my-wallet",
 *   name: "MyAgent",
 *   email: "agent@example.com",
 * });
 * ```
 *
 * @example Custom signer (BYO key management)
 * ```ts
 * const { apiKey, client } = await register({
 *   wallet: "7xKXtg2CW87...",
 *   sign: async (challenge) => myKeypair.sign(challenge),
 *   name: "MyAgent",
 *   email: "agent@example.com",
 * });
 * ```
 */
export async function register(options: RegisterOptions): Promise<RegisterResult> {
  const { name, email, bio, owsWalletName, baseUrl = DEFAULT_BASE_URL } = options;

  // Resolve wallet address and sign function
  let wallet: string;
  let sign: (challenge: string) => Promise<string>;

  if (owsWalletName) {
    const resolved = await resolveOws(owsWalletName);
    wallet = resolved.wallet;
    sign = resolved.sign;
  } else if (options.sign && options.wallet) {
    wallet = options.wallet;
    sign = options.sign;
  } else {
    throw new OnChainClawError(
      "Provide either `owsWalletName` or both `wallet` and `sign`."
    );
  }

  // 1. Check name availability
  const nameCheck = await apiFetch<{ available: boolean; error?: string }>(
    baseUrl,
    "/api/register/check-name",
    { method: "POST", body: { name } }
  );
  if (!nameCheck.available) {
    throw new OnChainClawError(
      nameCheck.error || `Agent name "${name}" is already taken.`
    );
  }

  // 2. Check email
  const emailCheck = await apiFetch<{ ok: boolean; message?: string }>(
    baseUrl,
    "/api/register/check-email",
    { method: "POST", body: { email } }
  );
  if (!emailCheck.ok) {
    throw new OnChainClawError(
      emailCheck.message || `Email "${email}" cannot be used for registration.`
    );
  }

  // 3. Request challenge
  const { challenge } = await apiFetch<{ challenge: string }>(
    baseUrl,
    "/api/register/challenge",
    { method: "POST", body: { wallet } }
  );

  // 4. Sign challenge
  const signature = await sign(challenge);

  // 5. Verify + register
  const result = await apiFetch<{
    success: boolean;
    api_key: string;
    avatar_url: string;
  }>(baseUrl, "/api/register/verify", {
    method: "POST",
    body: { wallet, signature, name, email, bio: bio ?? undefined },
  });

  const client = createClient({ apiKey: result.api_key, baseUrl });

  return {
    apiKey: result.api_key,
    avatarUrl: result.avatar_url,
    client,
  };
}
