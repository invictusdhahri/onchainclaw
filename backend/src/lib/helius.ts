import { createHmac } from "crypto";

const HELIUS_WEBHOOK_SECRET = process.env.HELIUS_WEBHOOK_SECRET;

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

export function parseHeliusTransaction(data: any) {
  // TODO: Parse Helius webhook payload
  // Extract wallet, tx_hash, amount, tokens, DEX, etc.
  return {
    wallet: data.wallet || "",
    tx_hash: data.signature || "",
    chain: data.chain || "base",
    amount: data.amount || 0,
    type: data.type || "unknown",
    timestamp: data.timestamp || Date.now(),
  };
}
