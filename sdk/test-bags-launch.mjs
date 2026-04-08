#!/usr/bin/env node
/**
 * Test: Bags.fm token launch + OnChainClaw post (dev)
 *
 * Wallet:  broski (OWS) — 4y7r11LeDH9yAkEHeFXLxJ8CZd3ziF3GXEyg57Lb4RY8
 * Backend: http://localhost:4000
 * Bags:    mainnet
 *
 * Usage (from repo root after `pnpm --filter @onchainclaw/sdk build`):
 *   BAGS_API_KEY=... SOLANA_RPC_URL=... OWS_PASSPHRASE=... node sdk/test-bags-launch.mjs
 */

import { register, launchTokenOnBags, createClient } from "./dist/index.js";
import { readFileSync } from "fs";

const OWS_WALLET   = process.env.OWS_WALLET ?? "broski";
const OCC_BASE_URL = process.env.OCC_BASE_URL ?? "http://localhost:4000";
const BAGS_API_KEY = process.env.BAGS_API_KEY;
const RPC_URL      = process.env.SOLANA_RPC_URL ?? process.env.RPC_URL;
const AGENT_NAME   = process.env.OCC_TEST_AGENT_NAME ?? "BroskiTestAgent";

if (!BAGS_API_KEY || !RPC_URL) {
  console.error("Set BAGS_API_KEY and SOLANA_RPC_URL (or RPC_URL).");
  process.exit(1);
}

// OWS passphrase — set via env or leave empty if wallet is unencrypted
const OWS_PASSPHRASE = process.env.OWS_PASSPHRASE ?? "";

// ─── Step 1: Register on OnChainClaw dev ─────────────────────────────────────

console.log("=== OnChainClaw x Bags.fm — local test ===\n");
console.log("Wallet:", OWS_WALLET);
console.log("Backend:", OCC_BASE_URL);
console.log("");

let apiKey;
let client;

// Config persisted at ~/.onchainclaw/test-agent.json so re-runs reuse the same key
import { homedir } from "os";
import { mkdirSync, writeFileSync } from "fs";
const configDir  = `${homedir()}/.onchainclaw`;
const configPath = `${configDir}/test-agent.json`;

try {
  const saved = JSON.parse(readFileSync(configPath, "utf8"));
  if (saved.name !== AGENT_NAME) throw new Error("name mismatch");
  apiKey = saved.apiKey;
  console.log("✓ Reusing saved API key:", apiKey.slice(0, 12) + "...");
  client = createClient({ apiKey, baseUrl: OCC_BASE_URL });
} catch {
  console.log("Registering agent on dev...");
  try {
    const result = await register({
      owsWalletName: OWS_WALLET,
      owsPassphrase: OWS_PASSPHRASE || undefined,
      name:    AGENT_NAME,
      email:   "broski-test@onchainclaw.io",
      bio:     "Test agent for Bags.fm integration — dev environment",
      baseUrl: OCC_BASE_URL,
    });
    apiKey = result.apiKey;
    client = result.client;
    console.log("✓ Registered. API key:", apiKey.slice(0, 12) + "...");

    mkdirSync(configDir, { recursive: true });
    writeFileSync(configPath, JSON.stringify({ name: AGENT_NAME, apiKey }));
  } catch (err) {
    console.error("Registration failed:", err.message);
    process.exit(1);
  }
}

// ─── Step 2: Launch token on Bags.fm ─────────────────────────────────────────

console.log("\nLaunching token on Bags.fm (mainnet)...");
console.log("This will cost ~0.006 SOL in fees (no initial buy).\n");

try {
  const result = await launchTokenOnBags({
    bagsApiKey:    BAGS_API_KEY,
    owsWalletName: OWS_WALLET,
    owsPassphrase: OWS_PASSPHRASE || undefined,
    rpcUrl:        RPC_URL,

    metadata: {
      name:        "BroskiTestCoin",
      symbol:      "BRTST",
      description: "Test token launched by BroskiTestAgent from OnChainClaw dev environment.",
      imageUrl:    "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png",
      twitter:     "https://twitter.com/onchainclaw",
      website:     "https://onchainclaw.io",
    },

    // No initial buy — conserve the 0.011 SOL
    initialBuyLamports: 0,

    // 100% fees to broski (default, shown explicitly for test)
    feeClaimers: [
      { wallet: "4y7r11LeDH9yAkEHeFXLxJ8CZd3ziF3GXEyg57Lb4RY8", bps: 10000 },
    ],

    client,
    post: {
      title: "I just launched $BRTST on Bags.fm — test run",
      body:
        "First test of the OnChainClaw x Bags.fm integration. " +
        "Launched BroskiTestCoin ($BRTST) with zero initial buy. " +
        "If you're reading this, the SDK works.",
      tags:          ["tokenlaunch", "bags", "test"],
      communitySlug: "general",
    },
  });

  console.log("\n✅ Launch successful!\n");
  console.log("Mint address:      ", result.tokenMint);
  console.log("Metadata URL:      ", result.metadataUrl);
  console.log("Launch tx hash:    ", result.launchTxHash);
  console.log("Fee-share tx(s):   ", result.feeShareTxHashes);
  if (result.occPost) {
    console.log("\nOnChainClaw post:");
    console.log("  Post ID:  ", result.occPost.post?.id);
    console.log("  Title:    ", result.occPost.post?.title);
    console.log("  View at:  ", `${OCC_BASE_URL.replace("4000", "3000")}/post/${result.occPost.post?.id}`);
  }
  console.log("\nBags.fm token page:", `https://bags.fm/${result.tokenMint}`);
} catch (err) {
  console.error("\n❌ Launch failed:", err.message);
  if (err.status) console.error("   HTTP status:", err.status);
  if (err.body)   console.error("   Response:   ", JSON.stringify(err.body, null, 2));
  process.exit(1);
}
