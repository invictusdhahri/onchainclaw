import { createHmac } from "crypto";
import type { HeliusEnhancedTransaction } from "@onchainclaw/shared";

const HELIUS_WEBHOOK_SECRET = process.env.HELIUS_WEBHOOK_SECRET;
const HELIUS_API_KEY = process.env.HELIUS_API_KEY;
const HELIUS_WEBHOOK_ID = process.env.HELIUS_WEBHOOK_ID;
const HELIUS_API_BASE = "https://api.helius.xyz/v0/webhooks";

export function verifyHeliusSignature(
  payload: string,
  signature: string
): boolean {
  if (!HELIUS_WEBHOOK_SECRET) {
    console.warn("HELIUS_WEBHOOK_SECRET not set, skipping signature verification");
    return true;
  }

  const hmac = createHmac("sha256", HELIUS_WEBHOOK_SECRET);
  hmac.update(payload);
  const expectedSignature = hmac.digest("hex");

  return signature === expectedSignature;
}

interface ParsedTransaction {
  wallet: string; // Primary wallet involved (usually the one with largest balance change)
  tx_hash: string;
  chain: "solana";
  amount: number; // USD equivalent (estimated from SOL price)
  type: string;
  timestamp: number;
  tokens?: string[];
  dex?: string;
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
      (sum, transfer) => sum + Math.abs(transfer.amount),
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
    const uniqueMints = new Set(tx.tokenTransfers.map((t) => t.mint));
    tokens.push(...uniqueMints);
  }

  // Extract DEX/source
  const dex = tx.source || undefined;

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
    dex,
  };
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
    console.warn(
      "HELIUS_API_KEY or HELIUS_WEBHOOK_ID not set, skipping webhook sync"
    );
    return { success: true };
  }

  try {
    // Fetch current webhook config
    const listRes = await fetch(
      `${HELIUS_API_BASE}?api-key=${HELIUS_API_KEY}`
    );
    if (!listRes.ok) {
      throw new Error(`Helius list webhooks failed: ${listRes.status}`);
    }

    const webhooks: Array<{
      webhookID: string;
      webhookURL: string;
      transactionTypes: string[];
      accountAddresses: string[];
      webhookType: string;
      authHeader?: string;
    }> = await listRes.json();

    const webhook = webhooks.find((w) => w.webhookID === HELIUS_WEBHOOK_ID);
    if (!webhook) {
      throw new Error(
        `Webhook ${HELIUS_WEBHOOK_ID} not found. Check HELIUS_WEBHOOK_ID in .env`
      );
    }

    // Update webhook with new address list (preserve other config)
    const updateRes = await fetch(
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

    console.log(
      `✓ Helius webhook synced: ${accountAddresses.length} agent address(es)`
    );
    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Helius webhook sync failed:", message);
    return { success: false, error: message };
  }
}
