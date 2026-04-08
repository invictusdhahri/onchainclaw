import { Router, type IRouter } from "express";
import type { Request, Response } from "express";
import { PublicKey, VersionedTransaction } from "@solana/web3.js";
import type { z } from "zod";
import { validateApiKey } from "../middleware/apiKey.js";
import { writeLimiter } from "../middleware/rateLimit.js";
import { validateBody } from "../validation/middleware.js";
import {
  bagsMetadataBodySchema,
  bagsFeeShareBodySchema,
  bagsLaunchTxBodySchema,
  bagsBroadcastBodySchema,
} from "../validation/schemas.js";
import { createBagsSdkContext, dicebearAgentAvatarUrl } from "../lib/bagsClient.js";
import { logger } from "../lib/logger.js";

type AgentRow = { wallet: string; name: string };

function bagsDisabled(res: Response) {
  return res.status(503).json({
    error: "Bags proxy is not configured",
    message: "Set BAGS_API_KEY on the server (e.g. Render environment variables).",
  });
}

export const bagsRouter: IRouter = Router();

bagsRouter.post(
  "/metadata",
  writeLimiter,
  validateApiKey,
  validateBody(bagsMetadataBodySchema),
  async (req: Request, res: Response) => {
    const ctx = createBagsSdkContext();
    if (!ctx) return bagsDisabled(res);

    const agent = (req as Request & { agent: AgentRow }).agent;
    const body = req.body as z.infer<typeof bagsMetadataBodySchema>;

    const imageUrlRaw = body.image_url?.trim();
    const imageUrl =
      imageUrlRaw && imageUrlRaw.length > 0
        ? imageUrlRaw
        : dicebearAgentAvatarUrl(agent.wallet);

    try {
      const { tokenMint, tokenMetadata } =
        await ctx.sdk.tokenLaunch.createTokenInfoAndMetadata({
          imageUrl,
          name: body.name,
          symbol: body.symbol,
          description: body.description,
          ...(body.telegram && { telegram: body.telegram }),
          ...(body.twitter && { twitter: body.twitter }),
          ...(body.website && { website: body.website }),
        });

      res.json({
        token_mint: tokenMint,
        metadata_url: tokenMetadata,
      });
    } catch (e) {
      logger.error("POST /api/bags/metadata", e);
      res.status(500).json({ error: "Failed to create Bags token metadata" });
    }
  }
);

bagsRouter.post(
  "/fee-share-transactions",
  writeLimiter,
  validateApiKey,
  validateBody(bagsFeeShareBodySchema),
  async (req: Request, res: Response) => {
    const ctx = createBagsSdkContext();
    if (!ctx) return bagsDisabled(res);

    const agent = (req as Request & { agent: AgentRow }).agent;
    const body = req.body as z.infer<typeof bagsFeeShareBodySchema>;

    const launchWallet = new PublicKey(agent.wallet);
    const tokenMint = new PublicKey(body.token_mint);

    const feeClaimers =
      body.fee_claimers && body.fee_claimers.length > 0
        ? body.fee_claimers.map((c) => ({
            user: new PublicKey(c.wallet),
            userBps: c.bps,
          }))
        : [{ user: launchWallet, userBps: 10_000 }];

    try {
      const { transactions: feeShareTxs, meteoraConfigKey } =
        await ctx.sdk.config.createBagsFeeShareConfig({
          feeClaimers,
          payer: launchWallet,
          baseMint: tokenMint,
        });

      const transactions_hex = feeShareTxs.map((tx) =>
        Buffer.from(tx.serialize()).toString("hex")
      );

      const configKey =
        meteoraConfigKey instanceof PublicKey
          ? meteoraConfigKey.toBase58()
          : String(meteoraConfigKey);

      res.json({
        transactions_hex,
        meteora_config_key: configKey,
      });
    } catch (e) {
      logger.error("POST /api/bags/fee-share-transactions", e);
      res.status(500).json({ error: "Failed to build Bags fee-share transactions" });
    }
  }
);

bagsRouter.post(
  "/launch-transaction",
  writeLimiter,
  validateApiKey,
  validateBody(bagsLaunchTxBodySchema),
  async (req: Request, res: Response) => {
    const ctx = createBagsSdkContext();
    if (!ctx) return bagsDisabled(res);

    const agent = (req as Request & { agent: AgentRow }).agent;
    const body = req.body as z.infer<typeof bagsLaunchTxBodySchema>;

    const launchWallet = new PublicKey(agent.wallet);
    const tokenMint = new PublicKey(body.token_mint);
    const configKey = new PublicKey(body.meteora_config_key);

    try {
      const launchTx = await ctx.sdk.tokenLaunch.createLaunchTransaction({
        metadataUrl: body.metadata_url,
        tokenMint,
        launchWallet,
        initialBuyLamports: body.initial_buy_lamports,
        configKey,
        ...(body.jito_tip && {
          tipConfig: {
            tipWallet: new PublicKey(body.jito_tip.tip_wallet),
            tipLamports: body.jito_tip.tip_lamports,
          },
        }),
      });

      const transaction_hex = Buffer.from(launchTx.serialize()).toString("hex");
      res.json({ transaction_hex });
    } catch (e) {
      logger.error("POST /api/bags/launch-transaction", e);
      res.status(500).json({ error: "Failed to build Bags launch transaction" });
    }
  }
);

bagsRouter.post(
  "/broadcast",
  writeLimiter,
  validateApiKey,
  validateBody(bagsBroadcastBodySchema),
  async (req: Request, res: Response) => {
    const ctx = createBagsSdkContext();
    if (!ctx) return bagsDisabled(res);

    const body = req.body as z.infer<typeof bagsBroadcastBodySchema>;

    try {
      const raw = Buffer.from(body.signed_transaction_hex, "hex");
      const tx = VersionedTransaction.deserialize(raw);
      const sig = await ctx.connection.sendRawTransaction(tx.serialize(), {
        skipPreflight: false,
        maxRetries: 3,
      });
      const { blockhash, lastValidBlockHeight } =
        await ctx.connection.getLatestBlockhash("processed");
      await ctx.connection.confirmTransaction(
        { signature: sig, blockhash, lastValidBlockHeight },
        "processed"
      );
      res.json({ signature: sig });
    } catch (e) {
      logger.error("POST /api/bags/broadcast", e);
      res.status(400).json({
        error: "Failed to broadcast transaction",
        message:
          process.env.NODE_ENV === "development" && e instanceof Error
            ? e.message
            : undefined,
      });
    }
  }
);
