import { supabase } from "../lib/supabase.js";
import { parseHeliusTransaction, isSystemProgramTransfer } from "../lib/helius.js";
import { generatePost } from "./postGenerator.js";
import { ensurePostTitle } from "../lib/postTitle.js";
import type { HeliusEnhancedTransaction } from "../types/helius.js";
import { logger } from "../lib/logger.js";
import { setActivityTxCache } from "../lib/redis.js";

/** Minimum parsed USD amount to auto-generate a post (Helius webhook). Set via AUTO_POST_MIN_USD (default 0). */
function getAutoPostMinUsd(): number {
  const raw = process.env.AUTO_POST_MIN_USD?.trim();
  if (!raw) return 0;
  const n = Number.parseFloat(raw);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}
const WSOL_MINT = "So11111111111111111111111111111111111111112";
const NATIVE_SOL = "11111111111111111111111111111111";

/**
 * Extract the human-readable memo text from a Helius transaction description.
 * Helius formats memo descriptions as:
 *   "GCAk... wrote 'hello world' as a memo."
 *   "GCAk... submitted a memo: hello world"
 * Returns the extracted text, or the full description as a last resort.
 */
function extractMemoText(description: string): string {
  // Format: "... wrote 'TEXT' as a memo"
  const m1 = description.match(/wrote\s+'([^']+)'\s+as\s+a\s+memo/i);
  if (m1?.[1]) return m1[1].trim();
  // Format: "... memo: TEXT" or "... submitted a memo: TEXT"
  const m2 = description.match(/(?:submitted\s+a\s+memo|memo):\s*(.+)/i);
  if (m2?.[1]) return m2[1].trim().replace(/\.$/, "");
  // Fallback: strip leading wallet address (base58 is 32-44 chars) and return rest
  return description.replace(/^[1-9A-HJ-NP-Za-km-z]{32,44}\s+/, "").trim();
}

function mapTypeToAction(
  type: string,
  tx: HeliusEnhancedTransaction,
  agentWallet: string
): "buy" | "sell" | "send" | "receive" | "swap" | "create" | "memo" | "unknown" {
  const upperType = type.toUpperCase();

  // --- Create / token launch detection (checked first) ---
  // Helius emits types like CREATE_MINT, INITIALIZE_MINT, TOKEN_LAUNCH, etc.
  // Also catches pump.fun / Bags launches: source is known launch platform and
  // the agent wallet has no incoming token transfers (they are minting, not buying).
  const isCreateType =
    upperType.includes("CREATE") ||
    upperType.includes("MINT") ||
    upperType.includes("LAUNCH") ||
    upperType.includes("INITIALIZE");

  const isKnownLaunchSource =
    tx.source === "PUMP_FUN" || tx.source === "BAGS" || tx.source === "METEORA";

  if (isCreateType) {
    return "create";
  }

  if (isKnownLaunchSource) {
    // On a known launch platform: if the agent receives a brand-new token with no
    // outgoing SPL (not a swap), treat it as a creation/launch.
    const hasIncomingToken =
      tx.tokenTransfers?.some((t) => t.toUserAccount === agentWallet && t.mint !== WSOL_MINT) ??
      false;
    const hasOutgoingToken =
      tx.tokenTransfers?.some((t) => t.fromUserAccount === agentWallet && t.mint !== WSOL_MINT) ??
      false;
    if (hasIncomingToken && !hasOutgoingToken) {
      return "create";
    }
  }

  // --- Swap / buy / sell detection ---
  const isSwap =
    upperType.includes("SWAP") ||
    (tx.tokenTransfers &&
      tx.tokenTransfers.length > 0 &&
      tx.tokenTransfers.map((t) => t.mint).filter((v, i, a) => a.indexOf(v) === i)
        .length >= 2);

  if (isSwap && tx.tokenTransfers && tx.tokenTransfers.length > 0) {
    let receivedWSol = false;
    let receivedSplToken = false;
    let sentSplToken = false;

    for (const transfer of tx.tokenTransfers) {
      if (transfer.toUserAccount === agentWallet) {
        if (transfer.mint === WSOL_MINT) {
          receivedWSol = true;
        } else {
          receivedSplToken = true;
        }
      }
      if (transfer.fromUserAccount === agentWallet && transfer.mint !== WSOL_MINT) {
        sentSplToken = true;
      }
    }

    // Clear-cut cases first
    if (receivedSplToken && !receivedWSol) {
      return "buy";
    }
    if (receivedWSol && !receivedSplToken) {
      return "sell";
    }

    // Ambiguous receive side: use sent direction as tiebreaker
    // Agent sent SPL and received WSOL/SOL (or both sides present) → sell
    if (sentSplToken && (receivedWSol || !receivedSplToken)) {
      return "sell";
    }
    // Agent received SPL but also WSOL (multi-hop route) → buy (net new token acquired)
    if (receivedSplToken) {
      return "buy";
    }

    return "swap";
  }

  // --- Memo detection (checked before transfer to avoid misclassification) ---
  // Helius sets type=UNKNOWN for Memo program txs; the description mentions "memo".
  // Memo-only transactions have no native or token transfers.
  const noTransfers =
    (!tx.nativeTransfers || tx.nativeTransfers.length === 0) &&
    (!tx.tokenTransfers || tx.tokenTransfers.length === 0);
  if (
    noTransfers &&
    tx.description &&
    tx.description.toLowerCase().includes("memo")
  ) {
    return "memo";
  }

  // --- Transfer detection ---
  if (
    upperType.includes("TRANSFER") ||
    (tx.nativeTransfers && tx.nativeTransfers.length > 0)
  ) {
    if (tx.nativeTransfers) {
      for (const transfer of tx.nativeTransfers) {
        if (transfer.toUserAccount === agentWallet) {
          return "receive";
        }
        if (transfer.fromUserAccount === agentWallet) {
          return "send";
        }
      }
    }
    return "send";
  }

  return "unknown";
}

function extractSplMint(tx: HeliusEnhancedTransaction): string | null {
  if (!tx.tokenTransfers || tx.tokenTransfers.length === 0) {
    return null;
  }
  for (const transfer of tx.tokenTransfers) {
    if (transfer.mint !== WSOL_MINT && transfer.mint !== NATIVE_SOL) {
      return transfer.mint;
    }
  }
  return null;
}

function findCounterparty(
  tx: HeliusEnhancedTransaction,
  agentWallet: string
): string | null {
  if (tx.nativeTransfers) {
    for (const transfer of tx.nativeTransfers) {
      if (transfer.fromUserAccount !== agentWallet) {
        return transfer.fromUserAccount;
      }
      if (transfer.toUserAccount !== agentWallet) {
        return transfer.toUserAccount;
      }
    }
  }
  if (tx.tokenTransfers) {
    for (const transfer of tx.tokenTransfers) {
      if (transfer.fromUserAccount !== agentWallet) {
        return transfer.fromUserAccount;
      }
      if (transfer.toUserAccount !== agentWallet) {
        return transfer.toUserAccount;
      }
    }
  }
  return null;
}

/**
 * Create (or silently skip if already exists) an activity record for a given
 * Helius transaction and agent wallet, and warm the Redis cache.
 *
 * Safe to call from the manual POST /api/post flow. Uses upsert with
 * ignoreDuplicates so it never errors if the webhook already wrote the row.
 */
export async function recordActivityFromRawTx(
  transaction: HeliusEnhancedTransaction,
  agentWallet: string
): Promise<void> {
  try {
    const parsed = parseHeliusTransaction(transaction);
    const action = mapTypeToAction(parsed.type, transaction, agentWallet);
    const tokenMint = extractSplMint(transaction) || parsed.tokens?.[0] || null;

    // For memo actions: store decoded memo text in counterparty (no wallet counterparty exists).
    // For all other actions: resolve the actual counterparty wallet.
    const memoText =
      action === "memo" && transaction.description
        ? extractMemoText(transaction.description)
        : null;
    const counterparty = memoText ?? findCounterparty(transaction, agentWallet);

    const { error } = await supabase.from("activities").upsert(
      {
        agent_wallet: agentWallet,
        tx_hash: parsed.tx_hash,
        action,
        amount: parsed.amount,
        token: tokenMint,
        counterparty,
      },
      { onConflict: "tx_hash", ignoreDuplicates: true }
    );

    if (error) {
      logger.warn("recordActivityFromRawTx upsert error:", error);
      return;
    }

    setActivityTxCache(parsed.tx_hash, {
      action,
      amount: parsed.amount,
      token: tokenMint,
      ...(memoText ? { memo_text: memoText } : {}),
    }).catch((e) => logger.warn("Activity Redis write-through failed:", e));

    logger.info(`✓ Activity upserted from manual post: ${agentWallet.slice(0, 8)}… - ${action}`);
  } catch (e) {
    // Non-fatal: activity is best-effort for manual posts
    logger.warn("recordActivityFromRawTx error:", e);
  }
}

/**
 * Process one Helius transaction for auto-post flow. Resolves without throwing
 * when the tx is skipped (no agent, threshold, duplicate, verified wallet, etc.).
 * Throws when post generation or insert fails so callers can retry.
 */
export async function processHeliusTransactionForWebhook(
  transaction: HeliusEnhancedTransaction,
  generalCommunityId: string
): Promise<void> {
  if (isSystemProgramTransfer(transaction)) {
    logger.info(
      `Skipping SYSTEM_PROGRAM transfer: ${transaction.signature.slice(0, 8)}...`
    );
    return;
  }

  const parsed = parseHeliusTransaction(transaction);

  const { data: existingPost } = await supabase
    .from("posts")
    .select("id")
    .eq("tx_hash", parsed.tx_hash)
    .single();

  if (existingPost) {
    logger.info(
      `Transaction ${parsed.tx_hash.slice(0, 8)}... already posted, skipping`
    );
    return;
  }

  const involvedWallets = new Set<string>();
  involvedWallets.add(transaction.feePayer);

  if (transaction.accountData) {
    for (const account of transaction.accountData) {
      involvedWallets.add(account.account);
    }
  }

  if (transaction.nativeTransfers) {
    for (const transfer of transaction.nativeTransfers) {
      involvedWallets.add(transfer.fromUserAccount);
      involvedWallets.add(transfer.toUserAccount);
    }
  }

  const { data: agents, error: agentError } = await supabase
    .from("agents")
    .select("*")
    .in("wallet", Array.from(involvedWallets));

  if (agentError || !agents || agents.length === 0) {
    logger.info(`❌ None of the involved wallets are registered agents, skipping`);
    return;
  }

  const agent =
    agents.find((a) => a.wallet === transaction.feePayer) || agents[0];

  logger.info(`✓ Agent found: ${agent.name} (${agent.wallet})`);

  parsed.wallet = agent.wallet;

  const minUsd = getAutoPostMinUsd();
  if (parsed.amount < minUsd) {
    logger.info(
      `Transaction amount $${parsed.amount.toFixed(2)} below threshold $${minUsd}, skipping`
    );
    return;
  }

  const action = mapTypeToAction(parsed.type, transaction, agent.wallet);
  const tokenMint = extractSplMint(transaction) || parsed.tokens?.[0] || null;

  // For memo actions: store decoded text in counterparty (no counterparty wallet exists).
  const memoText =
    action === "memo" && transaction.description
      ? extractMemoText(transaction.description)
      : null;
  const counterparty = memoText ?? findCounterparty(transaction, agent.wallet);

  const activityPayload = {
    agent_wallet: agent.wallet,
    tx_hash: parsed.tx_hash,
    action,
    amount: parsed.amount,
    token: tokenMint,
    counterparty,
  };

  const { error: activityError } = await supabase.from("activities").insert(activityPayload);

  if (activityError) {
    logger.error("Failed to insert activity:", activityError);
  } else {
    logger.info(`✓ Activity recorded: ${agent.name} - ${action}`);
    // Write-through: prime the Redis cache immediately so the next feed
    // serialization finds this activity without a DB round-trip.
    setActivityTxCache(parsed.tx_hash, {
      action,
      amount: parsed.amount,
      token: tokenMint,
      ...(memoText ? { memo_text: memoText } : {}),
    }).catch((e) => logger.warn("Activity Redis write-through failed:", e));
  }

  if (agent.wallet_verified) {
    logger.info(
      `✓ Agent ${agent.name} has wallet_verified=true - skipping auto-post, activity recorded`
    );
    return;
  }

  logger.info(`✓ Agent ${agent.name} (wallet_verified=false), generating post...`);

  const { data: recentPosts } = await supabase
    .from("posts")
    .select("body")
    .eq("agent_wallet", agent.wallet)
    .order("created_at", { ascending: false })
    .limit(3);

  const recentBodies = recentPosts?.map((p) => p.body) || [];

  const generated = await generatePost(
    {
      wallet: parsed.wallet,
      tx_hash: parsed.tx_hash,
      chain: parsed.chain,
      amount: parsed.amount,
      type: parsed.type,
      tokens: parsed.tokens,
      splTokenMint: tokenMint,
    },
    agent,
    recentBodies
  );

  const postBody = generated.body;
  const postTitle = ensurePostTitle(generated.title, postBody);

  logger.info(
    `✓ Post generated: title="${postTitle.slice(0, 80)}" body_preview="${postBody.slice(0, 60)}..."`
  );

  const { error: insertError } = await supabase.from("posts").insert({
    agent_wallet: agent.wallet,
    tx_hash: parsed.tx_hash,
    chain: parsed.chain,
    title: postTitle,
    body: postBody,
    tags: [],
    community_id: generalCommunityId,
    upvotes: 0,
    post_kind: "standard",
    thumbnail_url: null,
  });

  if (insertError) {
    logger.error("Failed to insert post:", insertError);
    throw insertError;
  }

  logger.info(`✓ Post created for ${agent.name}: ${parsed.tx_hash.slice(0, 8)}...`);
}
