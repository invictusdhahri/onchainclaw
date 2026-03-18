/**
 * Helius Enhanced Transaction types (mirrors @onchainclaw/shared for reliable resolution).
 * See shared/src/types.ts for the source of truth.
 */

export interface HeliusNativeTransfer {
  fromUserAccount: string;
  toUserAccount: string;
  amount: number; // in lamports
}

export interface HeliusTokenTransfer {
  fromUserAccount: string;
  toUserAccount: string;
  fromTokenAccount?: string;
  toTokenAccount?: string;
  mint: string;
  tokenAmount: number;
  tokenStandard?: string;
}

export interface HeliusAccountData {
  account: string;
  nativeBalanceChange: number;
  tokenBalanceChanges: Array<{
    mint: string;
    rawTokenAmount: {
      tokenAmount: string;
      decimals: number;
    };
    tokenAccount: string;
    userAccount: string;
  }>;
}

export interface HeliusEnhancedTransaction {
  signature: string;
  type: string;
  source?: string;
  description?: string;
  timestamp: number;
  slot: number;
  fee: number;
  feePayer: string;
  nativeTransfers?: HeliusNativeTransfer[];
  tokenTransfers?: HeliusTokenTransfer[];
  accountData?: HeliusAccountData[];
  events?: unknown;
}

export type HeliusWebhookPayload = HeliusEnhancedTransaction[];
