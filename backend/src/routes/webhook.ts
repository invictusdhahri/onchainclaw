import { Router } from "express";
import type { Request, Response } from "express";
import { verifyHeliusWebhook } from "../lib/helius.js";
import { supabase } from "../lib/supabase.js";
import { getGeneralCommunityId } from "../lib/generalCommunity.js";
import type { HeliusWebhookPayload } from "../types/helius.js";
import { heliusWebhookPayloadSchema } from "../validation/schemas.js";
import { processHeliusTransactionForWebhook } from "../services/processHeliusWebhookTx.js";
import { enqueueWebhookPostRetry } from "../lib/webhookPostQueue.js";
import { logger } from "../lib/logger.js";

export const webhookRouter: Router = Router();

// POST /api/webhook/helius - Receive blockchain transaction webhooks
webhookRouter.post("/helius", async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers["authorization"];

    if (!verifyHeliusWebhook(authHeader)) {
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
      logger.error("Failed to log webhook payload:", logError);
    }

    const logId = logEntry?.id;

    res.json({ received: true, log_id: logId });

    processWebhookAsync(validatedPayload, logId).catch((error) => {
      logger.error("Background webhook processing failed:", error);
    });
  } catch (error) {
    logger.error("Webhook error:", error);
    res.status(500).json({ error: "Webhook processing failed" });
  }
});

async function processWebhookAsync(
  payload: HeliusWebhookPayload,
  logId?: string
) {
  try {
    if (!Array.isArray(payload)) {
      throw new Error("Expected array of transactions from Helius");
    }

    logger.info(`Processing ${payload.length} transaction(s) from webhook`);

    const generalCommunityId = await getGeneralCommunityId();
    if (!generalCommunityId) {
      throw new Error("general community not found — run migrations");
    }

    let txFailures = 0;

    for (const transaction of payload) {
      try {
        await processHeliusTransactionForWebhook(
          transaction,
          generalCommunityId
        );
      } catch (txError) {
        logger.error(`Failed to process transaction:`, txError);
        txFailures += 1;
        try {
          await enqueueWebhookPostRetry(transaction);
        } catch (enqueueErr) {
          logger.error("Failed to enqueue webhook post retry:", enqueueErr);
        }
      }
    }

    if (logId) {
      const errorNote =
        txFailures > 0
          ? `${txFailures} transaction(s) failed initial processing; queued for retry where possible`
          : null;
      await supabase
        .from("webhook_logs")
        .update({ processed: true, error: errorNote })
        .eq("id", logId);
    }

    logger.info(`✓ Webhook processing complete`);
  } catch (error) {
    logger.error("Webhook processing error:", error);

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
