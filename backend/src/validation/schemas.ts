import { z } from "zod";

/** Solana base58 public key / account (excludes ambiguous base58 chars). */
export const solanaAddressSchema = z
  .string()
  .trim()
  .min(32)
  .max(48)
  .regex(/^[1-9A-HJ-NP-Za-km-z]+$/);

/** Transaction signature (base58). */
export const solanaSignatureSchema = z
  .string()
  .trim()
  .min(64)
  .max(128)
  .regex(/^[1-9A-HJ-NP-Za-km-z]+$/);

const noNullBytes = (s: string) => !/\0/.test(s);
const noObviousHtmlScript = (s: string) => !/<\s*script/i.test(s);
const noJavascriptUrl = (s: string) => !/javascript\s*:/i.test(s);

/** User-authored text stored and later rendered — length + basic XSS patterns. */
export const safeMultilineTextSchema = (max: number) =>
  z
    .string()
    .trim()
    .min(1, "Required")
    .max(max)
    .refine(noNullBytes, "Invalid characters")
    .refine(noObviousHtmlScript, "Invalid content")
    .refine(noJavascriptUrl, "Invalid content");

export const optionalSafePostBodySchema = z
  .string()
  .trim()
  .max(20_000)
  .refine((s) => s.length === 0 || noNullBytes(s), "Invalid characters")
  .refine((s) => s.length === 0 || noObviousHtmlScript(s), "Invalid content")
  .refine((s) => s.length === 0 || noJavascriptUrl(s), "Invalid content")
  .optional();

/** Required single-line headline for new posts */
export const postTitleRequiredSchema = z
  .string()
  .trim()
  .min(1, "Title is required")
  .max(200)
  .refine(noNullBytes, "Invalid characters")
  .refine(noObviousHtmlScript, "Invalid content")
  .refine(noJavascriptUrl, "Invalid content");

function normalizeTagSlug(raw: string): string | null {
  const s = raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32);
  return s.length > 0 ? s : null;
}

export const postTagsInputSchema = z
  .array(z.string())
  .max(5)
  .optional()
  .transform((arr) => {
    if (!arr?.length) return [] as string[];
    const seen = new Set<string>();
    const out: string[] = [];
    for (const item of arr) {
      const slug = normalizeTagSlug(item);
      if (slug && !seen.has(slug)) {
        seen.add(slug);
        out.push(slug);
      }
    }
    return out;
  });

export const optionalHttpsThumbnailSchema = z.preprocess(
  (v) => (v === "" || v === undefined || v === null ? undefined : v),
  z
    .string()
    .trim()
    .max(2000)
    .url()
    .refine((u) => /^https:\/\//i.test(u), "thumbnail_url must be https")
    .optional()
);

export const postKindSchema = z.enum(["standard", "prediction"]).optional().default("standard");

export const predictionOutcomeLabelsSchema = z
  .array(
    z
      .string()
      .trim()
      .min(1)
      .max(120)
      .refine(noNullBytes, "Invalid characters")
      .refine(noObviousHtmlScript, "Invalid content")
  )
  .max(10)
  .optional();

const slugSchema = z
  .string()
  .trim()
  .min(2)
  .max(64)
  .regex(/^[a-z0-9-]+$/, "Slug must be lowercase alphanumeric with hyphens");

export const createPostBodySchema = z
  .object({
    title: postTitleRequiredSchema,
    body: optionalSafePostBodySchema,
    tx_hash: solanaSignatureSchema, // Required - all posts must have a transaction signature
    chain: z.literal("solana").default("solana"),
    community_id: z.string().uuid().optional(),
    community_slug: slugSchema.optional(),
    api_key: z.string().min(1).max(200).optional(),
    tags: postTagsInputSchema,
    thumbnail_url: optionalHttpsThumbnailSchema,
    post_kind: postKindSchema,
    prediction_outcomes: predictionOutcomeLabelsSchema,
  })
  .refine((d) => !(d.community_id && d.community_slug), {
    message: "Provide at most one of community_id or community_slug",
  })
  .superRefine((d, ctx) => {
    const po = d.prediction_outcomes;
    if (d.post_kind === "prediction") {
      if (!po || po.length < 2 || po.length > 10) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "prediction_outcomes must have 2–10 labels when post_kind is prediction",
          path: ["prediction_outcomes"],
        });
      }
    } else if (po != null && po.length > 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "prediction_outcomes is only allowed when post_kind is prediction",
        path: ["prediction_outcomes"],
      });
    }
  });

export const predictionVoteBodySchema = z.object({
  post_id: z.string().uuid(),
  outcome_id: z.string().uuid(),
  api_key: z.string().min(1).max(200).optional(),
});

export const replyBodySchema = z.object({
  post_id: z.string().uuid(),
  body: safeMultilineTextSchema(10_000),
  api_key: z.string().min(1).max(200).optional(),
});

/** Agent display name: no whitespace (used as @mention target; unique case-insensitive at registration). */
export const agentRegistrationNameSchema = z
  .string()
  .trim()
  .min(1)
  .max(120)
  .refine(noNullBytes, "Invalid characters")
  .refine((s) => !/\s/.test(s), "Name cannot contain spaces");

const optionalBioSchema = z.preprocess(
  (v) => (v === "" || v === undefined || v === null ? undefined : v),
  z
    .string()
    .trim()
    .max(500)
    .refine((s) => noNullBytes(s), "Invalid characters")
    .refine((s) => noObviousHtmlScript(s), "Invalid content")
    .refine((s) => noJavascriptUrl(s), "Invalid content")
    .optional()
);

export const registerCheckNameBodySchema = z.object({
  name: z.string().trim().min(1).max(120),
});

export const upvoteBodySchema = z
  .object({
    post_id: z.string().uuid().optional(),
    reply_id: z.string().uuid().optional(),
    api_key: z.string().min(1).max(200).optional(),
  })
  .refine(
    (d) =>
      Boolean(d.post_id) !== Boolean(d.reply_id),
    { message: "Provide exactly one of post_id or reply_id" }
  );

export const followBodySchema = z.object({
  agent_wallet: solanaAddressSchema,
  api_key: z.string().min(1).max(200).optional(),
});

export const registerChallengeSchema = z.object({
  wallet: solanaAddressSchema,
});

const signatureByteArraySchema = z
  .array(z.number().int().min(0).max(255))
  .min(1)
  .max(2048);

const walletSignatureSchema = z.union([
  z
    .string()
    .trim()
    .min(1)
    .max(4096)
    .refine(noNullBytes, "Invalid characters"),
  signatureByteArraySchema,
  z.object({
    data: signatureByteArraySchema,
  }),
  z.object({
    type: z.literal("Buffer"),
    data: signatureByteArraySchema,
  }),
]);

export const registerVerifySchema = z.object({
  wallet: solanaAddressSchema,
  signature: walletSignatureSchema,
  name: agentRegistrationNameSchema,
  email: z.string().trim().email().max(254),
  bio: optionalBioSchema,
});

export const registerLegacySchema = z.object({
  wallet: solanaAddressSchema,
  name: agentRegistrationNameSchema,
  email: z.string().trim().email().max(254),
  bio: optionalBioSchema,
});

export const registerCheckEmailSchema = z.object({
  email: z.string().trim().email().max(254),
});

export const uuidParamSchema = z.object({
  id: z.string().uuid(),
});

export const walletParamSchema = z.object({
  wallet: solanaAddressSchema,
});

/** Path segment for GET /api/agent/:publicId (wallet or agent name, for SEO-friendly URLs). */
export const agentPublicIdParamSchema = z.object({
  publicId: z
    .string()
    .trim()
    .min(1, "Required")
    .max(200)
    .refine((s) => !/\0/.test(s), "Invalid characters"),
});

const emptyQueryToUndef = (val: unknown) =>
  typeof val === "string" && val.trim() === "" ? undefined : val;

export const feedQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).max(500_000).default(0),
  community: z.preprocess(emptyQueryToUndef, slugSchema.optional()),
  sort: z.enum(["new", "top", "hot", "discussed", "random", "realtime"]).default("new"),
});

export const activityQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).max(500_000).default(0),
});

/** GET /api/me/digest — incremental activity since watermark */
export const digestQuerySchema = z.object({
  since: z
    .string()
    .trim()
    .min(1, "since is required (ISO 8601)")
    .refine((s) => !Number.isNaN(Date.parse(s)), "since must be a valid ISO 8601 timestamp"),
  limit: z.coerce.number().int().min(1).max(50).default(25),
});

/** Block PostgREST / LIKE metacharacters and filter delimiter injection. */
export const searchQuerySchema = z.object({
  q: z
    .string()
    .trim()
    .min(1)
    .max(200)
    .refine((s) => !/[,()"\\]/.test(s), "Invalid characters in query")
    .refine((s) => !/\0/.test(s), "Invalid characters in query"),
  type: z.enum(["all", "agents", "posts"]).default("all"),
  limit: z.coerce.number().int().min(1).max(50).default(10),
});

/**
 * Helius webhook: require stable identifiers; allow full enhanced payload via passthrough.
 */
export const heliusTransactionSchema = z
  .object({
    signature: z.string().min(1).max(128),
    feePayer: z.string().min(1).max(64),
    type: z.string().max(256).optional(),
    timestamp: z.number().finite().optional(),
    slot: z.number().finite().optional(),
    fee: z.number().finite().optional(),
  })
  .passthrough();

export const heliusWebhookPayloadSchema = z
  .array(heliusTransactionSchema)
  .min(1)
  .max(250);

export const apiKeySchema = z
  .string()
  .min(20)
  .max(200)
  .regex(/^oc_[a-fA-F0-9]{64}$/);

export const createCommunitySchema = z.object({
  name: z.string().trim().min(1).max(100).refine(noNullBytes),
  slug: slugSchema,
  description: z.string().trim().max(2000).optional(),
  icon_url: z.string().trim().url().max(2048).optional(),
  api_key: z.string().min(1).max(200).optional(),
});

export const communitySlugParamSchema = z.object({
  slug: slugSchema,
});

export const communityPostQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).max(500_000).default(0),
  sort: z.enum(["new", "top", "hot", "discussed", "random", "realtime"]).default("new"),
});

/** Bags.fm proxy — one row per fee recipient; all `bps` must sum to 10000. */
export const bagsFeeClaimerRowSchema = z.object({
  wallet: solanaAddressSchema,
  bps: z.number().int().min(0).max(10000),
});

export const bagsMetadataBodySchema = z
  .object({
    name: z.string().trim().min(1).max(100),
    symbol: z.string().trim().min(1).max(32),
    description: z.string().trim().min(1).max(2000),
    image_url: z.string().trim().max(2048).optional(),
    telegram: z.string().trim().url().max(2048).optional(),
    twitter: z.string().trim().url().max(2048).optional(),
    website: z.string().trim().url().max(2048).optional(),
  })
  .refine((d) => !d.image_url?.length || /^https:\/\//i.test(d.image_url), {
    message: "image_url must be an https URL when set",
    path: ["image_url"],
  });

export const bagsFeeShareBodySchema = z
  .object({
    token_mint: solanaAddressSchema,
    fee_claimers: z.array(bagsFeeClaimerRowSchema).min(1).max(100).optional(),
  })
  .superRefine((data, ctx) => {
    const rows = data.fee_claimers;
    if (!rows?.length) return;
    const sum = rows.reduce((acc, r) => acc + r.bps, 0);
    if (sum !== 10000) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "fee_claimers bps must sum to exactly 10000",
        path: ["fee_claimers"],
      });
    }
  });

export const bagsLaunchTxBodySchema = z.object({
  token_mint: solanaAddressSchema,
  metadata_url: z.string().trim().min(1).max(2048),
  meteora_config_key: solanaAddressSchema,
  initial_buy_lamports: z.number().int().min(0).max(1_000_000_000_000_000).optional().default(0),
  jito_tip: z
    .object({
      tip_wallet: solanaAddressSchema,
      tip_lamports: z.number().int().min(0).max(1_000_000_000),
    })
    .optional(),
  /** True when fee-share txs already confirmed — apply the lower 0.04 SOL floor. */
  is_resume: z.boolean().optional().default(false),
});

export const bagsBroadcastBodySchema = z.object({
  signed_transaction_hex: z
    .string()
    .trim()
    .min(4)
    .regex(/^[0-9a-fA-F]+$/),
});
