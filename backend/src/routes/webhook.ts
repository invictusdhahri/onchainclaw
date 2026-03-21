import { Router } from "express";
import type { Request, Response } from "express";
import {
  verifyHeliusWebhook,
  parseHeliusTransaction,
  isSystemProgramTransfer,
} from "../lib/helius.js";
import { supabase } from "../lib/supabase.js";
import { generatePost } from "../services/postGenerator.js";
import type { HeliusWebhookPayload, HeliusEnhancedTransaction } from "../types/helius.js";
import { heliusWebhookPayloadSchema } from "../validation/schemas.js";

// Transaction threshold (imported from shared in runtime, defined here for TypeScript)
const MIN_TX_THRESHOLD = 0;

export const webhookRouter: Router = Router();

// Solana token constants
const WSOL_MINT = "So11111111111111111111111111111111111111112";
const NATIVE_SOL = "11111111111111111111111111111111";

/**
 * Map Helius transaction type to human-readable action.
 * On Solana, there are no native buy/sell - only swaps and transfers.
 * Buy/sell is determined by swap direction (WSOL→Token = buy, Token→WSOL = sell).
 */
function mapTypeToAction(
  type: string,
  tx: HeliusEnhancedTransaction,
  agentWallet: string
): "buy" | "sell" | "send" | "receive" | "swap" | "unknown" {
  const upperType = type.toUpperCase();
  
  // Check if it's a swap (explicit type or inferred from token transfers)
  const isSwap = upperType.includes("SWAP") || 
    (tx.tokenTransfers && tx.tokenTransfers.length > 0 && 
     (tx.tokenTransfers.map(t => t.mint).filter((v, i, a) => a.indexOf(v) === i).length >= 2));
  
  if (isSwap && tx.tokenTransfers && tx.tokenTransfers.length > 0) {
    // Determine swap direction: did agent receive WSOL or SPL token?
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
    
    // Buy: Agent received SPL token (gave WSOL/SOL)
    if (receivedSplToken && !receivedWSol) {
      return "buy";
    }
    
    // Sell: Agent received WSOL (gave SPL token)
    if (receivedWSol && !receivedSplToken) {
      return "sell";
    }
    
    // Generic swap (token-to-token or unclear direction)
    return "swap";
  }
  
  // Handle transfers (not swaps)
  if (upperType.includes("TRANSFER") || (tx.nativeTransfers && tx.nativeTransfers.length > 0)) {
    // Check if agent is receiving or sending
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
    return "send"; // default to send if unclear
  }
  
  return "unknown";
}

/**
 * Extract the non-SOL/non-WSOL token mint from a transaction.
 * Returns the SPL token involved in a swap, or null if none found.
 */
function extractSplMint(tx: HeliusEnhancedTransaction): string | null {
  if (!tx.tokenTransfers || tx.tokenTransfers.length === 0) {
    return null;
  }
  
  // Find the first non-WSOL mint
  for (const transfer of tx.tokenTransfers) {
    if (transfer.mint !== WSOL_MINT && transfer.mint !== NATIVE_SOL) {
      return transfer.mint;
    }
  }
  
  return null;
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

    const payloadCheck = heliusWebhookPayloadSchema.safeParse(req.body);
    if (!payloadCheck.success) {
      return res.status(400).json({
        error: "Invalid webhook payload",
        details: payloadCheck.error.flatten(),
      });
    }
    const validatedPayload = payloadCheck.data as HeliusWebhookPayload;

    // 2. Store raw payload in webhook_logs for debugging
    const { data: logEntry, error: logError } = await supabase
      .from("webhook_logs")
      .insert({
        source: "helius",
        raw_payload: validatedPayload,
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
    processWebhookAsync(validatedPayload, logId).catch((error) => {
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
        const action = mapTypeToAction(parsed.type, transaction, agent.wallet);
        const counterparty = findCounterparty(transaction, agent.wallet);
        
        // Extract the correct SPL mint (non-WSOL token for swaps)
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
          console.error("Failed to insert activity:", activityError);
          // Continue anyway - activity is optional
        } else {
          console.log(`✓ Activity recorded: ${agent.name} - ${action}`);
        }

        // 7. Only auto-post for agents who have not completed wallet verification
        // (agents.verified is a separate badge; webhook uses wallet_verified only)
        if (agent.wallet_verified) {
          console.log(
            `✓ Agent ${agent.name} has wallet_verified=true - skipping auto-post, activity recorded`
          );
          continue;
        }

        console.log(
          `✓ Agent ${agent.name} (wallet_verified=false), generating post...`
        );

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
