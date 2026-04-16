import { Router } from "express";
import type { Request, Response } from "express";
import { z } from "zod";
import { fetchTokenMetadata, fetchBatchTokenMetadata } from "../lib/codex.js";
import { validateParams } from "../validation/middleware.js";
import { solanaAddressSchema } from "../validation/schemas.js";
import { logger } from "../lib/logger.js";

const mintParamSchema = z.object({
  mint: solanaAddressSchema,
});

const batchBodySchema = z.object({
  mints: z.array(solanaAddressSchema).min(1).max(50),
});

export const tokenMetadataRouter: Router = Router();

/** GET /api/token-metadata/:mint — public; uses Codex (CODEX_API_KEY) + in-memory cache */
tokenMetadataRouter.get(
  "/:mint",
  validateParams(mintParamSchema),
  async (req: Request, res: Response) => {
    try {
      const { mint } = (req as Request & { validatedParams: z.infer<typeof mintParamSchema> })
        .validatedParams;

      const meta = await fetchTokenMetadata(mint);

      // Token metadata is stable — allow browsers/CDN to cache for 5 min,
      // serve stale for up to 1 h while revalidating in background.
      res.setHeader("Cache-Control", "public, max-age=300, stale-while-revalidate=3600");
      res.json({
        mint,
        name: meta?.name ?? null,
        symbol: meta?.symbol ?? null,
        imageUrl: meta?.imageUrl ?? null,
      });
    } catch (error) {
      logger.error("token-metadata error:", error);
      res.status(500).json({ error: "Failed to fetch token metadata" });
    }
  }
);

/** POST /api/token-metadata/batch — fetch metadata for up to 50 mints in one request */
tokenMetadataRouter.post(
  "/batch",
  async (req: Request, res: Response) => {
    try {
      const parsed = batchBodySchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: "Invalid request", details: parsed.error.flatten() });
        return;
      }

      const { mints } = parsed.data;
      const results = await fetchBatchTokenMetadata(mints);

      // Return as object keyed by mint address
      const out: Record<string, { mint: string; name: string | null; symbol: string | null; imageUrl: string | null }> = {};
      for (const mint of mints) {
        const meta = results.get(mint);
        out[mint] = {
          mint,
          name: meta?.name ?? null,
          symbol: meta?.symbol ?? null,
          imageUrl: meta?.imageUrl ?? null,
        };
      }

      res.setHeader("Cache-Control", "public, max-age=300, stale-while-revalidate=3600");
      res.json(out);
    } catch (error) {
      logger.error("token-metadata batch error:", error);
      res.status(500).json({ error: "Failed to fetch token metadata" });
    }
  }
);
