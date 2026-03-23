import { Queue, Worker } from "bullmq";
import { Redis } from "ioredis";
import { getGeneralCommunityId } from "./generalCommunity.js";
import { processHeliusTransactionForWebhook } from "../services/processHeliusWebhookTx.js";
import type { HeliusEnhancedTransaction } from "../types/helius.js";
import { logger } from "./logger.js";

const QUEUE_NAME = "helius-webhook-auto-post";

function newRedisConnection() {
  const url = process.env.REDIS_URL;
  if (!url) {
    throw new Error("REDIS_URL is required for the webhook post retry queue");
  }
  return new Redis(url, { maxRetriesPerRequest: null });
}

let queueInstance: Queue | null = null;
let queueConnection: ReturnType<typeof newRedisConnection> | null = null;

function getQueue(): Queue | null {
  if (!process.env.REDIS_URL) {
    return null;
  }
  if (!queueInstance) {
    queueConnection = newRedisConnection();
    queueInstance = new Queue(QUEUE_NAME, {
      // BullMQ may resolve a different ioredis minor than the app; instances are compatible at runtime.
      connection: queueConnection as unknown as import("bullmq").ConnectionOptions,
      defaultJobOptions: {
        attempts: 6,
        backoff: { type: "exponential", delay: 10_000 },
        removeOnComplete: { count: 1000 },
        removeOnFail: { count: 2000 },
      },
    });
  }
  return queueInstance;
}

export async function enqueueWebhookPostRetry(
  transaction: HeliusEnhancedTransaction
): Promise<void> {
  const queue = getQueue();
  if (!queue) {
    logger.warn("Webhook post retry skipped (REDIS_URL not set)");
    return;
  }
  await queue.add(
    "generate-post",
    { transaction },
    { jobId: `helius-post-${transaction.signature}` }
  );
}

export function startWebhookPostRetryWorker(): void {
  if (!process.env.REDIS_URL) {
    logger.warn("Webhook post retry worker not started (REDIS_URL not set)");
    return;
  }

  const connection = newRedisConnection();

  const worker = new Worker(
    QUEUE_NAME,
    async (job) => {
      const { transaction } = job.data as {
        transaction: HeliusEnhancedTransaction;
      };
      const generalCommunityId = await getGeneralCommunityId();
      if (!generalCommunityId) {
        throw new Error("general community not found — run migrations");
      }
      await processHeliusTransactionForWebhook(
        transaction,
        generalCommunityId
      );
    },
    {
      connection: connection as unknown as import("bullmq").ConnectionOptions,
      concurrency: 2,
    }
  );
  worker.on("failed", (job, err) => {
    logger.error(
      `Webhook retry job failed (id=${job?.id}, attempts=${job?.attemptsMade}):`,
      err
    );
  });

  logger.info("✅ Helius webhook post retry worker started");
}
