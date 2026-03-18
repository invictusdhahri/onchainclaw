import { Router } from "express";
import type { Request, Response } from "express";
import {
  verifyHeliusWebhook,
  parseHeliusTransaction,
  isSystemProgramTransfer,
} from "../lib/helius.js";
import { supabase } from "../lib/supabase.js";
import { generatePost } from "../services/postGenerator.js";
import { MIN_TX_THRESHOLD } from "@onchainclaw/shared";
import type { HeliusWebhookPayload, HeliusEnhancedTransaction } from "@onchainclaw/shared";

export const webhookRouter = Router();

/**
 * Map Helius transaction type to human-readable action
 */
function mapTypeToAction(
  type: string,
  tx: HeliusEnhancedTransaction
): "buy" | "sell" | "send" | "receive" | "swap" | "unknown" {
  const upperType = type.toUpperCase();
  
  if (upperType.includes("SWAP")) {
    return "swap";
  }
  
  if (upperType.includes("BUY") || upperType.includes("PURCHASE")) {
    return "buy";
  }
  
  if (upperType.includes("SELL")) {
    return "sell";
  }
  
  if (upperType.includes("TRANSFER")) {
    // Determine if send or receive based on native transfers
    if (tx.nativeTransfers && tx.nativeTransfers.length > 0) {
      // For now, default to "send" - could be enhanced to detect direction
      return "send";
    }
  }
  
  return "unknown";
}

/**
 * Find the counterparty (other wallet) in a transaction
 */
function findCounterparty(tx: HeliusEnhancedTransaction, agentWallet: string): string | null {
  // Check native transfers
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
  
  // Check token transfers
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

// POST /api/webhook/helius - Receive blockchain transaction webhooks
webhookRouter.post("/helius", async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers["authorization"];

    // Phase A: Validate, log, and respond immediately

    // 1. Verify webhook (Helius sends authHeader in Authorization header)
    if (!verifyHeliusWebhook(authHeader)) {
      console.error("Invalid webhook signature (check HELIUS_WEBHOOK_SECRET matches authHeader in Helius dashboard)");
      return res.status(401).json({ error: "Invalid signature" });
    }

    // 2. Store raw payload in webhook_logs for debugging
    const { data: logEntry, error: logError } = await supabase
      .from("webhook_logs")
      .insert({
        source: "helius",
        raw_payload: req.body,
        processed: false,
      })
      .select()
      .single();

    if (logError) {
      console.error("Failed to log webhook payload:", logError);
      // Continue anyway - don't fail webhook delivery
    }

    const logId = logEntry?.id;

    // 3. Respond immediately to Helius (they have short timeouts)
    res.json({ received: true, log_id: logId });

    // Phase B: Process in background (fire-and-forget)
    processWebhookAsync(req.body as HeliusWebhookPayload, logId).catch((error) => {
      console.error("Background webhook processing failed:", error);
    });

  } catch (error) {
    console.error("Webhook error:", error);
    res.status(500).json({ error: "Webhook processing failed" });
  }
});

// Background processor - runs after response is sent
async function processWebhookAsync(
  payload: HeliusWebhookPayload,
  logId?: string
) {
  try {
    // Helius sends an array of transactions
    if (!Array.isArray(payload)) {
      throw new Error("Expected array of transactions from Helius");
    }

    console.log(`Processing ${payload.length} transaction(s) from webhook`);

    for (const transaction of payload) {
      try {
        if (isSystemProgramTransfer(transaction)) {
          console.log(
            `Skipping SYSTEM_PROGRAM transfer: ${transaction.signature.slice(0, 8)}...`
          );
          continue;
        }

        // 1. Parse the transaction
        const parsed = parseHeliusTransaction(transaction);
        console.log(
          `Parsed transaction: ${parsed.tx_hash.slice(0, 8)}... from wallet ${parsed.wallet} ($${parsed.amount.toFixed(2)}) [${transaction.type}]`
        );

        // 2. Check if tx_hash already exists (prevent duplicates)
        const { data: existingPost } = await supabase
          .from("posts")
          .select("id")
          .eq("tx_hash", parsed.tx_hash)
          .single();

        if (existingPost) {
          console.log(`Transaction ${parsed.tx_hash.slice(0, 8)}... already posted, skipping`);
          continue;
        }

        // 3. Collect all wallets involved in this transaction
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

        console.log(`Checking ${involvedWallets.size} involved wallet(s):`, Array.from(involvedWallets).join(", "));

        // 4. Look up ANY of the involved wallets in agents table
        const { data: agents, error: agentError } = await supabase
          .from("agents")
          .select("*")
          .in("wallet", Array.from(involvedWallets));

        if (agentError || !agents || agents.length === 0) {
          console.log(
            `❌ None of the involved wallets are registered agents, skipping`
          );
          
          // Show all registered agents for debugging
          const { data: allAgents } = await supabase
            .from("agents")
            .select("wallet, name");
          console.log("Registered agents in DB:", allAgents?.map(a => `${a.name}: ${a.wallet}`).join(", ") || "none");
          continue;
        }

        // Use the first matching agent (or prioritize feePayer if multiple matches)
        const agent = agents.find(a => a.wallet === transaction.feePayer) || agents[0];
        
        console.log(`✓ Agent found: ${agent.name} (${agent.wallet})`);

        // Update parsed.wallet to use the actual agent's wallet
        parsed.wallet = agent.wallet;

        // 5. Check if transaction meets threshold
        if (parsed.amount < MIN_TX_THRESHOLD) {
          console.log(
            `Transaction amount $${parsed.amount.toFixed(2)} below threshold $${MIN_TX_THRESHOLD}, skipping`
          );
          continue;
        }

        // 6. Always insert activity (for the ticker) - for both verified and unverified agents
        const action = mapTypeToAction(parsed.type, transaction);
        const counterparty = findCounterparty(transaction, agent.wallet);
        
        const { error: activityError } = await supabase.from("activities").insert({
          agent_wallet: agent.wallet,
          tx_hash: parsed.tx_hash,
          chain: parsed.chain,
          action,
          amount: parsed.amount,
          token: parsed.tokens?.[0] || null,
          counterparty,
          dex: parsed.dex || null,
        });

        if (activityError) {
          console.error("Failed to insert activity:", activityError);
          // Continue anyway - activity is optional
        } else {
          console.log(`✓ Activity recorded: ${agent.name} - ${action}`);
        }

        // 7. Only generate posts for UNVERIFIED agents
        if (agent.wallet_verified) {
          console.log(
            `✓ Verified agent ${agent.name} - skipping auto-post, activity recorded`
          );
          continue;
        }

        console.log(`✓ Unverified agent ${agent.name}, generating post...`);

        // 8. Fetch recent posts for voice consistency
        const { data: recentPosts } = await supabase
          .from("posts")
          .select("body")
          .eq("agent_wallet", agent.wallet)
          .order("created_at", { ascending: false })
          .limit(3);

        const recentBodies = recentPosts?.map((p) => p.body) || [];

        // 9. Generate post using Claude API
        const postBody = await generatePost(
          {
            wallet: parsed.wallet,
            tx_hash: parsed.tx_hash,
            chain: parsed.chain,
            amount: parsed.amount,
            type: parsed.type,
            tokens: parsed.tokens,
            dex: parsed.dex,
          },
          agent,
          recentBodies
        );

        console.log(`✓ Post generated: "${postBody.slice(0, 60)}..."`);

        // 10. Determine tags based on transaction type
        const tags: string[] = [];
        if (parsed.type.includes("trading") || parsed.type.includes("SWAP")) {
          tags.push("trading");
        }
        if (parsed.amount > 10000) {
          tags.push("whale_moves");
        }

        // 11. Insert post into database
        const { error: insertError } = await supabase.from("posts").insert({
          agent_wallet: agent.wallet,
          tx_hash: parsed.tx_hash,
          chain: parsed.chain,
          body: postBody,
          tags,
          upvotes: 0,
        });

        if (insertError) {
          console.error("Failed to insert post:", insertError);
          throw insertError;
        }

        console.log(`✓ Post created for ${agent.name}: ${parsed.tx_hash.slice(0, 8)}...`);

      } catch (txError) {
        console.error(`Failed to process transaction:`, txError);
        // Continue with next transaction
      }
    }

    // 12. Mark webhook log as processed
    if (logId) {
      await supabase
        .from("webhook_logs")
        .update({ processed: true })
        .eq("id", logId);
    }

    console.log(`✓ Webhook processing complete`);

  } catch (error) {
    console.error("Webhook processing error:", error);
    
    // Log the error in webhook_logs
    if (logId) {
      await supabase
        .from("webhook_logs")
        .update({
          processed: true,
          error: error instanceof Error ? error.message : String(error),
        })
        .eq("id", logId);
    }
    
    throw error;
  }
}
