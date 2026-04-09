/**
 * Smoke checks for Bags proxy helpers and validation (no network, no DB).
 * Run: pnpm exec tsx src/scripts/smoke-bags-proxy.ts
 */
import { strict as assert } from "node:assert";
import {
  bagsMetadataBodySchema,
  bagsFeeShareBodySchema,
  bagsLaunchTxBodySchema,
  bagsBroadcastBodySchema,
} from "../validation/schemas.js";
import {
  createBagsSdkContext,
  dicebearAgentAvatarUrl,
  getSolanaRpcUrl,
} from "../lib/bagsClient.js";
import { BAGS_MIN_LAMPORTS_FOR_LAUNCH } from "@onchainclaw/shared";

function ok(name: string, fn: () => void) {
  try {
    fn();
    console.log("✓", name);
  } catch (e) {
    console.error("✗", name, e);
    process.exit(1);
  }
}

// --- Zod: metadata ---
ok("bagsMetadataBodySchema accepts minimal body", () => {
  const r = bagsMetadataBodySchema.safeParse({
    name: "T",
    symbol: "T",
    description: "D",
  });
  assert(r.success);
});

ok("bagsMetadataBodySchema rejects bad image_url", () => {
  const r = bagsMetadataBodySchema.safeParse({
    name: "T",
    symbol: "T",
    description: "D",
    image_url: "http://insecure.com/x.png",
  });
  assert(!r.success);
});

// --- Zod: fee share ---
ok("bagsFeeShareBodySchema defaults-friendly token_mint only", () => {
  const r = bagsFeeShareBodySchema.safeParse({
    token_mint: "So11111111111111111111111111111111111111112",
  });
  assert(r.success);
});

ok("bagsFeeShareBodySchema rejects wrong BPS sum", () => {
  const r = bagsFeeShareBodySchema.safeParse({
    token_mint: "So11111111111111111111111111111111111111112",
    fee_claimers: [
      { wallet: "So11111111111111111111111111111111111111112", bps: 5000 },
      { wallet: "So11111111111111111111111111111111111111112", bps: 4000 },
    ],
  });
  assert(!r.success);
});

ok("bagsFeeShareBodySchema accepts 10000 BPS", () => {
  const r = bagsFeeShareBodySchema.safeParse({
    token_mint: "So11111111111111111111111111111111111111112",
    fee_claimers: [
      { wallet: "So11111111111111111111111111111111111111112", bps: 10000 },
    ],
  });
  assert(r.success);
});

// --- Zod: launch + broadcast ---
ok("bagsLaunchTxBodySchema parses", () => {
  const r = bagsLaunchTxBodySchema.safeParse({
    token_mint: "So11111111111111111111111111111111111111112",
    metadata_url: "https://example.com/meta",
    meteora_config_key: "So11111111111111111111111111111111111111112",
    initial_buy_lamports: 0,
  });
  assert(r.success);
});

ok("bagsBroadcastBodySchema parses hex", () => {
  const r = bagsBroadcastBodySchema.safeParse({
    signed_transaction_hex: "deadbeef",
  });
  assert(r.success);
});

// --- bagsClient (no real key) ---
const prevKey = process.env.BAGS_API_KEY;
delete process.env.BAGS_API_KEY;

ok("createBagsSdkContext returns null without BAGS_API_KEY", () => {
  assert.equal(createBagsSdkContext(), null);
});

process.env.BAGS_API_KEY = "bags_smoke_dummy_key_not_used_for_network";
ok("createBagsSdkContext returns context with dummy key", () => {
  const ctx = createBagsSdkContext();
  assert(ctx !== null);
  assert(ctx.connection);
  assert(ctx.sdk);
});

if (prevKey !== undefined) process.env.BAGS_API_KEY = prevKey;
else delete process.env.BAGS_API_KEY;

ok("dicebearAgentAvatarUrl is https bottts", () => {
  const u = dicebearAgentAvatarUrl("So11111111111111111111111111111111111111112");
  assert(u.includes("api.dicebear.com"));
  assert(u.includes("bottts"));
});

ok("getSolanaRpcUrl is non-empty", () => {
  assert(getSolanaRpcUrl().length > 10);
});

ok("BAGS_MIN_LAMPORTS_FOR_LAUNCH is 0.04 SOL", () => {
  assert.equal(BAGS_MIN_LAMPORTS_FOR_LAUNCH, 40_000_000);
});

console.log("\nAll smoke-bags-proxy checks passed.");
