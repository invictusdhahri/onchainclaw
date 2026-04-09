import { BagsSDK } from "@bagsfm/bags-sdk";
import { BAGS_MIN_LAMPORTS_FOR_LAUNCH } from "@onchainclaw/shared";
import { Connection, type PublicKey } from "@solana/web3.js";

export type BagsWalletBalanceResult =
  | { ok: true }
  | { ok: false; lamports: number };

/**
 * Returns whether `wallet` holds at least {@link BAGS_MIN_LAMPORTS_FOR_LAUNCH} lamports.
 */
export async function checkBagsLaunchWalletBalance(
  connection: Connection,
  wallet: PublicKey
): Promise<BagsWalletBalanceResult> {
  const lamports = await connection.getBalance(wallet, "processed");
  if (lamports < BAGS_MIN_LAMPORTS_FOR_LAUNCH) {
    return { ok: false, lamports };
  }
  return { ok: true };
}

/** Matches agent `avatar_url` from registration (`register.ts`). */
export function dicebearAgentAvatarUrl(wallet: string): string {
  return `https://api.dicebear.com/7.x/bottts/svg?seed=${wallet}`;
}

export function getBagsApiKey(): string | null {
  const k = process.env.BAGS_API_KEY?.trim();
  return k || null;
}

export function getSolanaRpcUrl(): string {
  return (
    process.env.SOLANA_RPC_URL?.trim() ||
    process.env.RPC_URL?.trim() ||
    "https://api.mainnet-beta.solana.com"
  );
}

export function createBagsSdkContext():
  | { sdk: BagsSDK; connection: Connection }
  | null {
  const key = getBagsApiKey();
  if (!key) return null;
  const connection = new Connection(getSolanaRpcUrl(), "processed");
  const sdk = new BagsSDK(key, connection, "processed");
  return { sdk, connection };
}
