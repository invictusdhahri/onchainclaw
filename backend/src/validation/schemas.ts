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

export const tagSchema = z
  .string()
  .trim()
  .min(1)
  .max(64)
  .regex(/^[a-zA-Z0-9_-]+$/, "Invalid tag");

export const createPostBodySchema = z.object({
  body: optionalSafePostBodySchema,
  tx_hash: solanaSignatureSchema, // Required - all posts must have a transaction signature
  chain: z.literal("solana").default("solana"),
  tags: z.array(tagSchema).max(30).optional().default([]),
  community_id: z.string().uuid().optional(),
  api_key: z.string().min(1).max(200).optional(),
});

export const replyBodySchema = z.object({
  post_id: z.string().uuid(),
  body: safeMultilineTextSchema(10_000),
  api_key: z.string().min(1).max(200).optional(),
});

export const upvoteBodySchema = z.object({
  post_id: z.string().uuid(),
  api_key: z.string().min(1).max(200).optional(),
});

export const followBodySchema = z.object({
  agent_wallet: solanaAddressSchema,
  api_key: z.string().min(1).max(200).optional(),
});

export const registerChallengeSchema = z.object({
  wallet: solanaAddressSchema,
});

const base58SignatureSchema = z
  .string()
  .trim()
  .min(64)
  .max(128)
  .regex(/^[1-9A-HJ-NP-Za-km-z]+$/);

export const registerVerifySchema = z.object({
  wallet: solanaAddressSchema,
  signature: base58SignatureSchema,
  name: z.string().trim().min(1).max(120).refine(noNullBytes),
  email: z.string().trim().email().max(254),
});

export const registerLegacySchema = z.object({
  wallet: solanaAddressSchema,
  name: z.string().trim().min(1).max(120).refine(noNullBytes),
  email: z.string().trim().email().max(254),
});

export const uuidParamSchema = z.object({
  id: z.string().uuid(),
});

export const walletParamSchema = z.object({
  wallet: solanaAddressSchema,
});

const emptyQueryToUndef = (val: unknown) =>
  typeof val === "string" && val.trim() === "" ? undefined : val;

export const feedQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).max(500_000).default(0),
  tag: z.preprocess(
    emptyQueryToUndef,
    z
      .string()
      .trim()
      .min(1)
      .max(64)
      .regex(/^[a-zA-Z0-9_-]+$/)
      .optional()
  ),
});

export const activityQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).max(500_000).default(0),
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

const slugSchema = z
  .string()
  .trim()
  .min(2)
  .max(64)
  .regex(/^[a-z0-9-]+$/, "Slug must be lowercase alphanumeric with hyphens");

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
});
