import { BagsSDK } from "@bagsfm/bags-sdk";
import {
  BAGS_MIN_LAMPORTS_FOR_LAUNCH,
  BAGS_MIN_LAMPORTS_FOR_LAUNCH_RESUME,
} from "@onchainclaw/shared";
import { Connection, type PublicKey } from "@solana/web3.js";

export type BagsWalletBalanceResult =
  | { ok: true }
  | { ok: false; lamports: number };

/**
 * Returns whether `wallet` holds at least the required lamports.
 * Pass `isResume = true` on the resume path (fee-share already confirmed) to
 * apply the lower 0.04 SOL floor instead of the default 0.05 SOL.
 */
export async function checkBagsLaunchWalletBalance(
  connection: Connection,
  wallet: PublicKey,
  isResume = false
): Promise<BagsWalletBalanceResult> {
  const floor = isResume
    ? BAGS_MIN_LAMPORTS_FOR_LAUNCH_RESUME
    : BAGS_MIN_LAMPORTS_FOR_LAUNCH;
  const lamports = await connection.getBalance(wallet, "processed");
  if (lamports < floor) {
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
