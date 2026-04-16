import { logger } from "./logger.js";
import type {
  HeliusEnhancedTransaction,
  HeliusNativeTransfer,
  HeliusTokenTransfer,
} from "../types/helius.js";

const HELIUS_WEBHOOK_SECRET_RAW = process.env.HELIUS_WEBHOOK_SECRET;
const HELIUS_API_KEY = process.env.HELIUS_API_KEY;
const HELIUS_WEBHOOK_ID = process.env.HELIUS_WEBHOOK_ID;
const HELIUS_API_BASE = "https://api-mainnet.helius-rpc.com/v0/webhooks";
const HELIUS_FETCH_TIMEOUT_MS = 30_000;
const SYSTEM_PROGRAM_ADDRESS = "11111111111111111111111111111111";

function fetchWithTimeout(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), HELIUS_FETCH_TIMEOUT_MS);
  return fetch(url, { ...options, signal: controller.signal }).finally(() =>
    clearTimeout(timeout)
  );
}

const isProduction = () => process.env.NODE_ENV === "production";

/**
 * Verify webhook came from Helius.
 * Helius echoes your authHeader value in the Authorization header (see Helius docs).
 * Production: fails closed if HELIUS_WEBHOOK_SECRET is missing unless
 * ALLOW_UNVERIFIED_HELIUS_WEBHOOK=true (explicit escape hatch only).
 * Non-production: allows missing secret for local dev without Helius credentials.
 */
export function verifyHeliusWebhook(authHeader: string | undefined): boolean {
  const secret = HELIUS_WEBHOOK_SECRET_RAW?.trim();
  if (!secret) {
    if (isProduction()) {
      if (process.env.ALLOW_UNVERIFIED_HELIUS_WEBHOOK === "true") {
        logger.warn(
          "⚠️  ALLOW_UNVERIFIED_HELIUS_WEBHOOK: Helius webhooks are not authenticated"
        );
        return true;
      }
      logger.error(
        "CRITICAL: HELIUS_WEBHOOK_SECRET not configured — rejecting webhook requests"
      );
      return false;
    }
    return true;
  }
  if (!authHeader) {
    logger.error(
      "Helius webhook: missing Authorization header — in Helius, set the webhook Authentication / auth header to a secret, then set HELIUS_WEBHOOK_SECRET on the server to the same value"
    );
    return false;
  }
  const ok = authHeader === secret || authHeader === `Bearer ${secret}`;
  if (!ok) {
    logger.error(
      "Helius webhook: Authorization header does not match HELIUS_WEBHOOK_SECRET (check both sides for typos, extra spaces, or Bearer prefix)"
    );
  }
  return ok;
}

/** True when DISABLE_TX_VERIFICATION is honored (never in production unless dual escape hatch). */
export function isTxVerificationBypassActive(): boolean {
  if (process.env.DISABLE_TX_VERIFICATION !== "true") {
    return false;
  }
  if (!isProduction()) {
    return true;
  }
  return process.env.ALLOW_INSECURE_TX_BYPASS === "true";
}

interface ParsedTransaction {
  wallet: string; // Primary wallet involved (usually the one with largest balance change)
  tx_hash: string;
  chain: "solana";
  amount: number; // USD equivalent (estimated from SOL price)
  type: string;
  timestamp: number;
  tokens?: string[];
}

// SOL price hardcoded for MVP - in production, fetch from an oracle
const SOL_PRICE_USD = 150;

export function parseHeliusTransaction(
  tx: HeliusEnhancedTransaction
): ParsedTransaction {
  // Extract primary wallet - the one with the largest native balance change
  let primaryWallet = tx.feePayer;
  let maxBalanceChange = 0;

  if (tx.accountData) {
    for (const account of tx.accountData) {
      const absChange = Math.abs(account.nativeBalanceChange);
      if (absChange > maxBalanceChange) {
        maxBalanceChange = absChange;
        primaryWallet = account.account;
      }
    }
  }

  // Calculate total transaction amount in USD
  let totalLamports = 0;
  if (tx.nativeTransfers && tx.nativeTransfers.length > 0) {
    // Sum all native transfers
    totalLamports = tx.nativeTransfers.reduce(
      (sum: number, transfer: HeliusNativeTransfer) =>
        sum + Math.abs(transfer.amount),
      0
    );
  } else if (maxBalanceChange > 0) {
    // Fallback to largest balance change
    totalLamports = maxBalanceChange;
  }

  // Convert lamports to SOL (1 SOL = 1e9 lamports) then to USD
  const solAmount = totalLamports / 1e9;
  const usdAmount = solAmount * SOL_PRICE_USD;

  // Extract token mints if any
  const tokens: string[] = [];
  if (tx.tokenTransfers) {
    const mints: string[] = tx.tokenTransfers.map(
      (t: HeliusTokenTransfer) => t.mint
    );
    tokens.push(...Array.from(new Set(mints)));
  }

  // Map Helius type to our internal categories
  let txType = tx.type || "UNKNOWN";
  if (txType.includes("SWAP")) {
    txType = "trading";
  } else if (txType.includes("NFT")) {
    txType = "trading";
  } else if (txType.includes("TRANSFER")) {
    txType = "transfer";
  }

  return {
    wallet: primaryWallet,
    tx_hash: tx.signature,
    chain: "solana",
    amount: usdAmount,
    type: txType,
    timestamp: tx.timestamp,
    tokens: tokens.length > 0 ? tokens : undefined,
  };
}

/**
 * Returns true when a transaction is just moving SOL via the System Program.
 * These are often noise (rent/funding/system account movements) and should not
 * generate social posts.
 */
export function isSystemProgramTransfer(tx: HeliusEnhancedTransaction): boolean {
  const source = tx.source?.toUpperCase();
  const nativeTransferCount = tx.nativeTransfers?.length ?? 0;
  const tokenTransferCount = tx.tokenTransfers?.length ?? 0;

  // Keep single plain SOL transfers so they can be recorded as activities.
  const isSinglePlainTransfer =
    source === "SYSTEM_PROGRAM" &&
    nativeTransferCount === 1 &&
    tokenTransferCount === 0;
  if (isSinglePlainTransfer) {
    return false;
  }

  if (source === "SYSTEM_PROGRAM") {
    return true;
  }

  if (nativeTransferCount === 0) {
    return false;
  }

  return (tx.nativeTransfers ?? []).some(
    (transfer: { fromUserAccount: string; toUserAccount: string }) =>
      transfer.fromUserAccount === SYSTEM_PROGRAM_ADDRESS ||
      transfer.toUserAccount === SYSTEM_PROGRAM_ADDRESS
  );
}

/**
 * Sync agent wallet addresses to the Helius webhook.
 * Call this when an agent registers (or is removed) to update monitored addresses.
 * Costs 100 Helius credits per call.
 */
export async function syncHeliusWebhookAddresses(
  accountAddresses: string[]
): Promise<{ success: boolean; error?: string }> {
  if (!HELIUS_API_KEY || !HELIUS_WEBHOOK_ID) {
    logger.warn(
      "HELIUS_API_KEY or HELIUS_WEBHOOK_ID not set, skipping webhook sync"
    );
    return { success: true };
  }

  try {
    // Fetch current webhook config
    const listRes = await fetchWithTimeout(
      `${HELIUS_API_BASE}?api-key=${HELIUS_API_KEY}`
    );
    if (!listRes.ok) {
      throw new Error(`Helius list webhooks failed: ${listRes.status}`);
    }

    const webhooks = (await listRes.json()) as Array<{
      webhookID: string;
      webhookURL: string;
      transactionTypes: string[];
      accountAddresses: string[];
      webhookType: string;
      authHeader?: string;
    }>;

    const webhook = webhooks.find((w) => w.webhookID === HELIUS_WEBHOOK_ID);
    if (!webhook) {
      throw new Error(
        `Webhook ${HELIUS_WEBHOOK_ID} not found. Check HELIUS_WEBHOOK_ID in .env`
      );
    }

    // Update webhook with new address list (preserve other config)
    const updateRes = await fetchWithTimeout(
      `${HELIUS_API_BASE}/${HELIUS_WEBHOOK_ID}?api-key=${HELIUS_API_KEY}`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          webhookURL: webhook.webhookURL,
          webhookType: webhook.webhookType,
          transactionTypes: webhook.transactionTypes,
          accountAddresses,
          ...(webhook.authHeader && { authHeader: webhook.authHeader }),
        }),
      }
    );

    if (!updateRes.ok) {
      const errText = await updateRes.text();
      throw new Error(`Helius update webhook failed: ${updateRes.status} - ${errText}`);
    }

    logger.info(
      `✓ Helius webhook synced: ${accountAddresses.length} agent address(es)`
    );
    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error("Helius webhook sync failed:", message);
    return { success: false, error: message };
  }
}

/**
 * Verify that a wallet address is involved in a transaction.
 * 
 * Step 1: Fetch parsed transaction from Helius Enhanced Transactions API
 * Step 2: Check if the transaction exists (reject fake tx_hash)
 * Step 3: Check if walletAddress appears in the transaction
 * 
 * Uses the same api-mainnet.helius-rpc.com domain as the webhook (proven to work).
 * See: https://www.helius.dev/docs/api-reference/enhanced-transactions/llms.txt
 */
export async function verifyWalletInTransaction(
  txHash: string,
  walletAddress: string
): Promise<{ verified: boolean; parsedTx?: ParsedTransaction; error?: string }> {
  if (isTxVerificationBypassActive()) {
    if (isProduction()) {
      logger.error(
        "⚠️  TX VERIFICATION BYPASS ACTIVE IN PRODUCTION (DISABLE_TX_VERIFICATION + ALLOW_INSECURE_TX_BYPASS)"
      );
    } else {
      logger.warn("⚠️  TX VERIFICATION DISABLED via DISABLE_TX_VERIFICATION (non-production)");
    }
    return { verified: true };
  }
  if (process.env.DISABLE_TX_VERIFICATION === "true" && isProduction()) {
    logger.error(
      "DISABLE_TX_VERIFICATION ignored in production without ALLOW_INSECURE_TX_BYPASS=true"
    );
  }

  if (!HELIUS_API_KEY) {
    logger.error("❌ HELIUS_API_KEY not set, cannot verify transaction");
    return { verified: false, error: "Transaction verification unavailable" };
  }

  logger.info(`🔍 Verifying wallet ${walletAddress.slice(0, 8)}... in tx ${txHash.slice(0, 12)}...`);

  try {
    // Use the correct Helius Enhanced Transactions endpoint
    // Same domain as HELIUS_API_BASE (api-mainnet.helius-rpc.com) which already works for webhooks
    const url = `https://api-mainnet.helius-rpc.com/v0/transactions?api-key=${HELIUS_API_KEY}`;

    const response = await fetchWithTimeout(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ transactions: [txHash] }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.error(`❌ Helius API ${response.status}: ${errorText}`);
      return { verified: false, error: "Unable to verify transaction. Please try again." };
    }

    const transactions = (await response.json()) as HeliusEnhancedTransaction[];

    // Step 2: Check if transaction exists
    if (!transactions || transactions.length === 0) {
      logger.error(`❌ Transaction ${txHash.slice(0, 12)}... does not exist`);
      return { verified: false, error: "Transaction not found. Provide a valid Solana transaction signature." };
    }

    const tx = transactions[0];
    logger.info(`📦 Found tx: type=${tx.type}, source=${tx.source || "N/A"}, feePayer=${tx.feePayer.slice(0, 8)}...`);

    // Step 3: Check if wallet is involved
    const involvedWallets = new Set<string>();
    involvedWallets.add(tx.feePayer);

    if (tx.accountData) {
      for (const account of tx.accountData) {
        involvedWallets.add(account.account);
      }
    }
    if (tx.nativeTransfers) {
      for (const t of tx.nativeTransfers) {
        involvedWallets.add(t.fromUserAccount);
        involvedWallets.add(t.toUserAccount);
      }
    }
    if (tx.tokenTransfers) {
      for (const t of tx.tokenTransfers) {
        involvedWallets.add(t.fromUserAccount);
        involvedWallets.add(t.toUserAccount);
      }
    }

    if (involvedWallets.has(walletAddress)) {
      logger.info(`✅ Wallet ${walletAddress.slice(0, 8)}... IS in the transaction`);
      return { verified: true, parsedTx: parseHeliusTransaction(tx), rawTx: tx };
    }

    logger.error(`❌ Wallet ${walletAddress.slice(0, 8)}... NOT in transaction (${involvedWallets.size} wallets checked)`);
    return {
      verified: false,
      error: "Your wallet is not involved in this transaction.",
    };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    logger.error(`❌ Verification error: ${msg}`);
    return { verified: false, error: "Unable to verify transaction. Please try again." };
  }
}
