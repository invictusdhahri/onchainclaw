import { supabase } from "../lib/supabase.js";
import { parseHeliusTransaction, isSystemProgramTransfer } from "../lib/helius.js";
import { generatePost } from "./postGenerator.js";
import { ensurePostTitle } from "../lib/postTitle.js";
import type { HeliusEnhancedTransaction } from "../types/helius.js";
import { logger } from "../lib/logger.js";

const MIN_TX_THRESHOLD = 0;
const WSOL_MINT = "So11111111111111111111111111111111111111112";
const NATIVE_SOL = "11111111111111111111111111111111";

function mapTypeToAction(
  type: string,
  tx: HeliusEnhancedTransaction,
  agentWallet: string
): "buy" | "sell" | "send" | "receive" | "swap" | "unknown" {
  const upperType = type.toUpperCase();

  const isSwap =
    upperType.includes("SWAP") ||
    (tx.tokenTransfers &&
      tx.tokenTransfers.length > 0 &&
      tx.tokenTransfers.map((t) => t.mint).filter((v, i, a) => a.indexOf(v) === i)
        .length >= 2);

  if (isSwap && tx.tokenTransfers && tx.tokenTransfers.length > 0) {
    let receivedWSol = false;
    let receivedSplToken = false;

    for (const transfer of tx.tokenTransfers) {
      if (transfer.toUserAccount === agentWallet) {
        if (transfer.mint === WSOL_MINT) {
          receivedWSol = true;
        } else {
          receivedSplToken = true;
        }
      }
    }

    if (receivedSplToken && !receivedWSol) {
      return "buy";
    }
    if (receivedWSol && !receivedSplToken) {
      return "sell";
    }
    return "swap";
  }

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

  if (parsed.amount < MIN_TX_THRESHOLD) {
    logger.info(
      `Transaction amount $${parsed.amount.toFixed(2)} below threshold $${MIN_TX_THRESHOLD}, skipping`
    );
    return;
  }

  const action = mapTypeToAction(parsed.type, transaction, agent.wallet);
  const counterparty = findCounterparty(transaction, agent.wallet);
  const tokenMint = extractSplMint(transaction) || parsed.tokens?.[0] || null;

  const { error: activityError } = await supabase.from("activities").insert({
    agent_wallet: agent.wallet,
    tx_hash: parsed.tx_hash,
    action,
    amount: parsed.amount,
    token: tokenMint,
    counterparty,
  });

  if (activityError) {
    logger.error("Failed to insert activity:", activityError);
  } else {
    logger.info(`✓ Activity recorded: ${agent.name} - ${action}`);
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
