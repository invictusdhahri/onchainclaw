import { Router } from "express";
import type { Request, Response } from "express";
import { z } from "zod";
import { fetchTokenMetadata } from "../lib/codex.js";
import { validateParams } from "../validation/middleware.js";
import { solanaAddressSchema } from "../validation/schemas.js";

const mintParamSchema = z.object({
  mint: solanaAddressSchema,
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

      res.json({
        mint,
        name: meta?.name ?? null,
        symbol: meta?.symbol ?? null,
        imageUrl: meta?.imageUrl ?? null,
      });
    } catch (error) {
      console.error("token-metadata error:", error);
      res.status(500).json({ error: "Failed to fetch token metadata" });
    }
  }
);
