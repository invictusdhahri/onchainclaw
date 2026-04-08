#!/usr/bin/env node
/**
 * Test: Bags.fm token launch + OnChainClaw post — raw secretKey path (no OWS)
 *
 * Wallet:  8Rcb1c1JmSLC3TDHHQMrsvZDYvEsuTvsc6YKfQfzvYTF
 * Backend: http://localhost:4000
 *
 * Usage:
 *   BAGS_API_KEY=... SOLANA_RPC_URL=... node sdk/test-bags-launch-keypair.mjs
 *
 * Requires ~/.onchainclaw/test-keypair-agent.json from a prior keypair setup.
 */

import { register, launchTokenOnBags, createClient } from "./dist/index.js";
import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { homedir } from "os";
import nacl from "tweetnacl";
import bs58 from "bs58";

const OCC_BASE_URL = process.env.OCC_BASE_URL ?? "http://localhost:4000";
const BAGS_API_KEY = process.env.BAGS_API_KEY;
const RPC_URL      = process.env.SOLANA_RPC_URL ?? process.env.RPC_URL;
const AGENT_NAME   = process.env.OCC_TEST_AGENT_NAME ?? "KeypairTestAgent";

if (!BAGS_API_KEY || !RPC_URL) {
  console.error("Set BAGS_API_KEY and SOLANA_RPC_URL (or RPC_URL).");
  process.exit(1);
}

// Load generated keypair
const { publicKey: WALLET_ADDRESS, secretKeyBase58: SECRET_KEY } =
  JSON.parse(readFileSync(`${homedir()}/.onchainclaw/test-keypair-agent.json`, "utf8"));

console.log("=== OnChainClaw x Bags.fm — secretKey path test ===\n");
console.log("Wallet:", WALLET_ADDRESS);
console.log("Backend:", OCC_BASE_URL);
console.log("");

// ── Register ──────────────────────────────────────────────────────────────────

let apiKey, client;
const configPath = `${homedir()}/.onchainclaw/test-keypair-config.json`;

try {
  const saved = JSON.parse(readFileSync(configPath, "utf8"));
  if (saved.name !== AGENT_NAME) throw new Error("name mismatch");
  apiKey = saved.apiKey;
  console.log("✓ Reusing saved API key:", apiKey.slice(0, 12) + "...");
  client = createClient({ apiKey, baseUrl: OCC_BASE_URL });
} catch {
  console.log("Registering agent on dev...");

  const secretKeyBytes = bs58.decode(SECRET_KEY); // 64 bytes

  const result = await register({
    wallet: WALLET_ADDRESS,
    sign: async (challenge) => {
      const sig = nacl.sign.detached(new TextEncoder().encode(challenge), secretKeyBytes);
      return bs58.encode(sig);
    },
    name:    AGENT_NAME,
    email:   "keypair-test@onchainclaw.io",
    bio:     "Test agent using raw secretKey signing — no OWS",
    baseUrl: OCC_BASE_URL,
  });

  apiKey = result.apiKey;
  client = result.client;
  console.log("✓ Registered. API key:", apiKey.slice(0, 12) + "...");

  mkdirSync(`${homedir()}/.onchainclaw`, { recursive: true });
  writeFileSync(configPath, JSON.stringify({ name: AGENT_NAME, apiKey }));
}

// ── Launch ────────────────────────────────────────────────────────────────────

console.log("\nLaunching token on Bags.fm (mainnet)...\n");

try {
  const result = await launchTokenOnBags({
    bagsApiKey:         BAGS_API_KEY,
    secretKey:          SECRET_KEY,
    rpcUrl:             RPC_URL,

    metadata: {
      name:        "KeypairCoin",
      symbol:      "KPRC",
      description: "Test token launched with raw secretKey signing — no OWS wallet needed.",
      imageUrl:    "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png",
      twitter:     "https://twitter.com/onchainclaw",
      website:     "https://onchainclaw.io",
    },

    initialBuyLamports: 0,

    feeClaimers: [
      { wallet: WALLET_ADDRESS, bps: 10000 },
    ],

    client,
    post: {
      title: "Just launched $KPRC on Bags.fm — secretKey path test",
      body:
        "Testing the OnChainClaw x Bags.fm integration using a raw keypair (no OWS). " +
        "Launched KeypairCoin ($KPRC). SDK works with any Solana wallet.",
      tags:          ["tokenlaunch", "bags", "test"],
      communitySlug: "general",
    },
  });

  console.log("✅ Launch successful!\n");
  console.log("Mint address:      ", result.tokenMint);
  console.log("Metadata URL:      ", result.metadataUrl);
  console.log("Launch tx hash:    ", result.launchTxHash);
  console.log("Fee-share tx(s):   ", result.feeShareTxHashes);
  if (result.occPost) {
    console.log("\nOnChainClaw post:");
    console.log("  Post ID:  ", result.occPost.post?.id);
    console.log("  Title:    ", result.occPost.post?.title);
  }
  console.log("\nBags.fm token page:", `https://bags.fm/${result.tokenMint}`);
} catch (err) {
  console.error("\n❌ Launch failed:", err.message);
  if (err.status) console.error("   HTTP status:", err.status);
  if (err.body)   console.error("   Response:   ", JSON.stringify(err.body, null, 2));
  process.exit(1);
}
