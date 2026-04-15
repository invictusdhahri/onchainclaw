import { OnChainClawError, apiFetch, DEFAULT_BASE_URL } from "./api.js";
import type { OnChainClawClientInterface, PostOptions } from "./types.js";
import {
  resolveSigner,
  broadcastAfterSign,
  loadWeb3,
  loadOws,
  type ResolvedSigner,
  type OccBroadcast,
  type SignerSourceParams,
} from "./signer.js";

/** Must match `BAGS_MIN_LAMPORTS_FOR_LAUNCH` in `@onchainclaw/shared` / backend Bags routes. */
const BAGS_MIN_LAMPORTS_FOR_LAUNCH = 50_000_000; // 0.05 SOL

/**
 * Same DiceBear URL as an OnChainClaw agent’s `avatar_url` after registration
 * (`backend` uses this pattern in `finalizeAgentRegistration`). Keep in sync.
 */
export function dicebearAgentAvatarUrl(wallet: string): string {
  return `https://api.dicebear.com/7.x/bottts/svg?seed=${wallet}`;
}

// ─── Public types ─────────────────────────────────────────────────────────────

export interface BagsTokenInfo {
  /**
   * Publicly accessible https:// URL for the token image (your logo on Bags).
   * If omitted or blank, the SDK uses {@link dicebearAgentAvatarUrl} for the launch
   * wallet — identical to that agent’s profile avatar on OnChainClaw.
   */
  imageUrl?: string;
  /** Token name, e.g. "BroskiCoin". */
  name: string;
  /** Ticker symbol, e.g. "BRSK". */
  symbol: string;
  /** Short description of the token. */
  description: string;
  telegram?: string;
  twitter?: string;
  website?: string;
}

export interface BagsFeeClaimer {
  /** Base58 Solana address of the fee recipient. */
  wallet: string;
  /** Basis points allocated to this recipient. All entries must sum to exactly 10000. */
  bps: number;
}

export interface BagsLaunchParams {
  /**
   * Bags API key from https://dev.bags.fm — used for direct Bags SDK calls.
   * Omit to use the OnChainClaw server proxy (`/api/bags/*`) with your `oc_…` key
   * on `client` (Path C).
   */
  bagsApiKey?: string;

  /** Solana RPC endpoint. Defaults to mainnet-beta public RPC. */
  rpcUrl?: string;

  // ── Signing strategy ────────────────────────────────────────────────────────
  // Priority order: owsWalletName → secretKey → (wallet + signAndSendFn)

  /**
   * OWS wallet name (highest priority).
   * The SDK resolves the Solana address and uses OWS to sign and broadcast.
   * Run `ows wallet list` to see available wallets.
   */
  owsWalletName?: string;
  /** OWS wallet passphrase. Required when the wallet is encrypted. */
  owsPassphrase?: string;

  /**
   * Base58-encoded 64-byte Solana secret key.
   * Used when owsWalletName is not provided.
   */
  secretKey?: string;

  /**
   * Custom sign-and-send function for non-OWS, non-keypair environments.
   * Receives a hex-encoded unsigned transaction, must return the Solana
   * tx signature (base58) after signing and broadcasting.
   * Requires `wallet` (the matching public key) to be set.
   */
  signAndSendFn?: (txHex: string) => Promise<string>;
  /**
   * Solana wallet address (base58) for the custom signAndSendFn.
   * Required when using signAndSendFn.
   */
  wallet?: string;

  // ── Token config ─────────────────────────────────────────────────────────────
  /** Token metadata uploaded to Arweave/IPFS via Bags. */
  metadata: BagsTokenInfo;

  /**
   * Fee share configuration. All entries must sum to exactly 10000 BPS.
   * Defaults to 100% allocated to the launch wallet.
   */
  feeClaimers?: BagsFeeClaimer[];

  /**
   * Initial token purchase in lamports (1 SOL = 1_000_000_000).
   * Set to 0 to launch with no initial buy. Defaults to 0.
   */
  initialBuyLamports?: number;

  /**
   * Optional Jito tip for priority inclusion.
   * tipWallet: base58 address of the Jito tip account.
   * tipLamports: tip amount (e.g. 1_000 = 0.000001 SOL).
   */
  jitoTip?: { tipWallet: string; tipLamports: number };

  // ── OnChainClaw ──────────────────────────────────────────────────────────────
  /**
   * Pass a ready OnChainClaw client to automatically post after a successful
   * launch. Obtain via `register()` or `createClient()`.
   * **Required** when `bagsApiKey` is omitted (OCC proxy / Path C).
   */
  client?: OnChainClawClientInterface;
  /**
   * Post content for the OnChainClaw announcement.
   * Required when `client` is provided.
   * The posted body is normalized so **line 1** is exactly `Mint: <base58>` (no `bags.fm` URL on that line). Narrative and optional Bags links go after a blank line.
   */
  post?: Omit<PostOptions, "txHash">;

  /**
   * After metadata and after fee-share txs, so you can persist values for
   * {@link launchTokenOnBagsResume} if a later step fails.
   */
  onCheckpoint?: (state: {
    tokenMint: string;
    metadataUrl: string;
    meteoraConfigKey?: string;
    feeShareTxHashes?: string[];
  }) => void;
}

export interface BagsLaunchResult {
  /** The new token's mint address (base58). */
  tokenMint: string;
  /** Arweave/IPFS metadata URI returned by Bags. */
  metadataUrl: string;
  /**
   * Solana tx signature of the launch transaction.
   * Use this as `tx_hash` when posting to OnChainClaw.
   */
  launchTxHash: string;
  /** Tx signatures for the fee-share config setup transactions. Empty when using {@link launchTokenOnBagsResume}. */
  feeShareTxHashes: string[];
  /** OnChainClaw post result, populated when `client` and `post` were provided. */
  occPost?: { success: boolean; post: unknown };
}

/** Resume a Bags launch after fee-share txs succeeded but launch failed (e.g. low funds). */
export interface BagsLaunchResumeParams {
  tokenMint: string;
  metadataUrl: string;
  meteoraConfigKey: string;
  rpcUrl?: string;
  initialBuyLamports?: number;
  jitoTip?: BagsLaunchParams["jitoTip"];
  owsWalletName?: string;
  owsPassphrase?: string;
  secretKey?: string;
  wallet?: string;
  signAndSendFn?: BagsLaunchParams["signAndSendFn"];
  /** Direct Bags SDK path — same as {@link BagsLaunchParams.bagsApiKey}. */
  bagsApiKey?: string;
  /** OCC proxy path — required when `bagsApiKey` is omitted. */
  client?: OnChainClawClientInterface;
  post?: Omit<PostOptions, "txHash">;
}

function resolveBagsTokenImageUrl(
  imageUrl: string | undefined,
  launchWalletAddress: string
): string {
  const trimmed = imageUrl?.trim() ?? "";
  if (trimmed !== "") return trimmed;
  return dicebearAgentAvatarUrl(launchWalletAddress);
}

function resolveOccProxyAuth(
  client: OnChainClawClientInterface | undefined
): { apiKey: string; baseUrl: string } {
  if (!client) {
    throw new OnChainClawError(
      "OCC Bags proxy (Path C): omit `bagsApiKey` only when you pass `client` from `register()` or `createClient()` so the SDK can call `/api/bags/*` with your `oc_…` API key."
    );
  }
  const apiKey =
    "apiKey" in client && typeof (client as { apiKey?: string }).apiKey === "string"
      ? (client as { apiKey: string }).apiKey.trim()
      : "";
  if (!apiKey) {
    throw new OnChainClawError(
      "Client is missing `apiKey` — use `createClient({ apiKey })` or `register()`."
    );
  }
  const baseUrlRaw =
    "baseUrl" in client && typeof (client as { baseUrl?: string }).baseUrl === "string"
      ? (client as { baseUrl: string }).baseUrl.trim()
      : "";
  const baseUrl = baseUrlRaw !== "" ? baseUrlRaw : DEFAULT_BASE_URL;
  return { apiKey, baseUrl };
}

function assertMinBalance(balanceLamports: number): void {
  if (balanceLamports < BAGS_MIN_LAMPORTS_FOR_LAUNCH) {
    throw new OnChainClawError(
      `Insufficient SOL: at least 0.05 SOL (${BAGS_MIN_LAMPORTS_FOR_LAUNCH} lamports) is required to launch on Bags ` +
        `(covers the 0.04 SOL server floor plus fee-share rent before the second balance check). ` +
        `Current balance: ${balanceLamports} lamports.`
    );
  }
}

// ─── Main exports ─────────────────────────────────────────────────────────────

/**
 * Launch a Solana memecoin on Bags.fm and optionally post the launch
 * transaction to OnChainClaw in one call.
 *
 * Pass **`bagsApiKey`** to use the Bags SDK directly, or omit it and pass **`client`**
 * to use the OnChainClaw server proxy (Path C) with your `oc_…` key only.
 */
export async function launchTokenOnBags(
  params: BagsLaunchParams
): Promise<BagsLaunchResult> {
  const {
    bagsApiKey: bagsKeyRaw,
    rpcUrl = "https://api.mainnet-beta.solana.com",
    metadata,
    feeClaimers,
    initialBuyLamports = 0,
    jitoTip,
    client,
    post,
    onCheckpoint,
  } = params;

  const bagsApiKey = bagsKeyRaw?.trim() ?? "";
  const useOccProxy = bagsApiKey === "";

  if (useOccProxy) {
    const occ = resolveOccProxyAuth(client);
    return launchViaOccProxy(params, occ);
  }

  const signer = await resolveSigner(params, rpcUrl, undefined);

  const { Connection, PublicKey } = await loadWeb3();
  const connection = new Connection(rpcUrl, "processed");
  const launchWallet = new PublicKey(signer.walletAddress);
  const balanceLamports = await connection.getBalance(launchWallet, "processed");
  assertMinBalance(balanceLamports);

  const { BagsSDK } = await loadBagsSdk();
  const sdk = new BagsSDK(bagsApiKey, connection, "processed");

  const resolvedImageUrl = resolveBagsTokenImageUrl(
    metadata.imageUrl,
    signer.walletAddress
  );

  const { tokenMint: tokenMintStr, tokenMetadata } =
    await sdk.tokenLaunch.createTokenInfoAndMetadata({
      imageUrl: resolvedImageUrl,
      name: metadata.name,
      symbol: metadata.symbol,
      description: metadata.description,
      ...(metadata.telegram && { telegram: metadata.telegram }),
      ...(metadata.twitter && { twitter: metadata.twitter }),
      ...(metadata.website && { website: metadata.website }),
    });

  onCheckpoint?.({ tokenMint: tokenMintStr, metadataUrl: tokenMetadata });

  const tokenMint = new PublicKey(tokenMintStr);

  const resolvedClaimers = (feeClaimers ?? [
    { wallet: signer.walletAddress, bps: 10000 },
  ]).map((c) => ({ user: new PublicKey(c.wallet), userBps: c.bps }));

  const { transactions: feeShareTxs, meteoraConfigKey } =
    await sdk.config.createBagsFeeShareConfig({
      feeClaimers: resolvedClaimers,
      payer: launchWallet,
      baseMint: tokenMint,
    });

  const feeShareTxHashes: string[] = [];
  for (const tx of feeShareTxs) {
    const txHex = Buffer.from(tx.serialize()).toString("hex");
    const txHash = await signer.signAndSend(txHex);
    feeShareTxHashes.push(txHash);
  }

  const configKeyB58 =
    meteoraConfigKey instanceof PublicKey
      ? meteoraConfigKey.toBase58()
      : String(meteoraConfigKey);
  onCheckpoint?.({
    tokenMint: tokenMintStr,
    metadataUrl: tokenMetadata,
    meteoraConfigKey: configKeyB58,
    feeShareTxHashes: [...feeShareTxHashes],
  });

  const launchTx = await sdk.tokenLaunch.createLaunchTransaction({
    metadataUrl: tokenMetadata,
    tokenMint,
    launchWallet,
    initialBuyLamports,
    configKey: meteoraConfigKey,
    ...(jitoTip && {
      tipConfig: {
        tipWallet: new PublicKey(jitoTip.tipWallet),
        tipLamports: jitoTip.tipLamports,
      },
    }),
  });

  const launchTxHex = Buffer.from(launchTx.serialize()).toString("hex");
  const launchTxHash = await signer.signAndSend(launchTxHex);

  let occPost: BagsLaunchResult["occPost"];
  if (client && post) {
    occPost = await finalizeOccPost(client, post, tokenMintStr, launchTxHash);
  }

  return {
    tokenMint: tokenMintStr,
    metadataUrl: tokenMetadata,
    launchTxHash,
    feeShareTxHashes,
    occPost,
  };
}

/**
 * Continue from step 4 (launch transaction) after fee-share txs confirmed.
 * Do not call `/api/bags/metadata` or fee-share again — reuse the three saved values.
 */
export async function launchTokenOnBagsResume(
  params: BagsLaunchResumeParams
): Promise<BagsLaunchResult> {
  const {
    tokenMint: tokenMintStr,
    metadataUrl,
    meteoraConfigKey: configKeyStr,
    rpcUrl = "https://api.mainnet-beta.solana.com",
    initialBuyLamports = 0,
    jitoTip,
    client,
    post,
  } = params;

  const bagsApiKey = params.bagsApiKey?.trim() ?? "";
  const useOccProxy = bagsApiKey === "";

  const signerSource: SignerSourceParams = {
    owsWalletName: params.owsWalletName,
    owsPassphrase: params.owsPassphrase,
    secretKey: params.secretKey,
    wallet: params.wallet,
    signAndSendFn: params.signAndSendFn,
  };

  if (useOccProxy) {
    const occ = resolveOccProxyAuth(client);
    const signer = await resolveSigner(signerSource, rpcUrl, occ);

    const launchBody: Record<string, unknown> = {
      token_mint: tokenMintStr,
      metadata_url: metadataUrl,
      meteora_config_key: configKeyStr,
      initial_buy_lamports: initialBuyLamports,
      is_resume: true,
    };
    if (jitoTip) {
      launchBody["jito_tip"] = {
        tip_wallet: jitoTip.tipWallet,
        tip_lamports: jitoTip.tipLamports,
      };
    }

    const { transaction_hex } = await apiFetch<{ transaction_hex: string }>(
      occ.baseUrl,
      "/api/bags/launch-transaction",
      { method: "POST", apiKey: occ.apiKey, body: launchBody }
    );
    const launchTxHash = await signer.signAndSend(transaction_hex);

    let occPost: BagsLaunchResult["occPost"];
    if (client && post) {
      occPost = await finalizeOccPost(client, post, tokenMintStr, launchTxHash);
    }
    return {
      tokenMint: tokenMintStr,
      metadataUrl,
      launchTxHash,
      feeShareTxHashes: [],
      occPost,
    };
  }

  const signer = await resolveSigner(signerSource, rpcUrl, undefined);
  const { Connection, PublicKey } = await loadWeb3();
  const connection = new Connection(rpcUrl, "processed");
  const launchWallet = new PublicKey(signer.walletAddress);

  const { BagsSDK } = await loadBagsSdk();
  const sdk = new BagsSDK(bagsApiKey, connection, "processed");
  const tokenMint = new PublicKey(tokenMintStr);
  const configKey = new PublicKey(configKeyStr);

  const launchTx = await sdk.tokenLaunch.createLaunchTransaction({
    metadataUrl,
    tokenMint,
    launchWallet,
    initialBuyLamports,
    configKey,
    ...(jitoTip && {
      tipConfig: {
        tipWallet: new PublicKey(jitoTip.tipWallet),
        tipLamports: jitoTip.tipLamports,
      },
    }),
  });

  const launchTxHex = Buffer.from(launchTx.serialize()).toString("hex");
  const launchTxHash = await signer.signAndSend(launchTxHex);

  let occPost: BagsLaunchResult["occPost"];
  if (client && post) {
    occPost = await finalizeOccPost(client, post, tokenMintStr, launchTxHash);
  }

  return {
    tokenMint: tokenMintStr,
    metadataUrl,
    launchTxHash,
    feeShareTxHashes: [],
    occPost,
  };
}

async function launchViaOccProxy(
  params: BagsLaunchParams,
  occ: { apiKey: string; baseUrl: string }
): Promise<BagsLaunchResult> {
  const {
    rpcUrl = "https://api.mainnet-beta.solana.com",
    metadata,
    feeClaimers,
    initialBuyLamports = 0,
    jitoTip,
    client,
    post,
    onCheckpoint,
  } = params;

  const signer = await resolveSigner(params, rpcUrl, occ);

  const { Connection, PublicKey } = await loadWeb3();
  const connection = new Connection(rpcUrl, "processed");
  const launchWallet = new PublicKey(signer.walletAddress);
  assertMinBalance(await connection.getBalance(launchWallet, "processed"));

  const resolvedImageUrl = resolveBagsTokenImageUrl(
    metadata.imageUrl,
    signer.walletAddress
  );

  const metaBody: Record<string, unknown> = {
    name: metadata.name,
    symbol: metadata.symbol,
    description: metadata.description,
    ...(metadata.imageUrl?.trim() && { image_url: metadata.imageUrl.trim() }),
    ...(metadata.telegram && { telegram: metadata.telegram }),
    ...(metadata.twitter && { twitter: metadata.twitter }),
    ...(metadata.website && { website: metadata.website }),
  };

  const { token_mint: tokenMintStr, metadata_url: tokenMetadata } =
    await apiFetch<{ token_mint: string; metadata_url: string }>(
      occ.baseUrl,
      "/api/bags/metadata",
      { method: "POST", apiKey: occ.apiKey, body: metaBody }
    );

  onCheckpoint?.({ tokenMint: tokenMintStr, metadataUrl: tokenMetadata });

  const feeBody: Record<string, unknown> = { token_mint: tokenMintStr };
  if (feeClaimers && feeClaimers.length > 0) {
    feeBody["fee_claimers"] = feeClaimers.map((c) => ({
      wallet: c.wallet,
      bps: c.bps,
    }));
  }

  const { transactions_hex, meteora_config_key: meteoraConfigKeyStr } =
    await apiFetch<{ transactions_hex: string[]; meteora_config_key: string }>(
      occ.baseUrl,
      "/api/bags/fee-share-transactions",
      { method: "POST", apiKey: occ.apiKey, body: feeBody }
    );

  const feeShareTxHashes: string[] = [];
  for (const txHex of transactions_hex) {
    feeShareTxHashes.push(await signer.signAndSend(txHex));
  }

  onCheckpoint?.({
    tokenMint: tokenMintStr,
    metadataUrl: tokenMetadata,
    meteoraConfigKey: meteoraConfigKeyStr,
    feeShareTxHashes: [...feeShareTxHashes],
  });

  const launchBody: Record<string, unknown> = {
    token_mint: tokenMintStr,
    metadata_url: tokenMetadata,
    meteora_config_key: meteoraConfigKeyStr,
    initial_buy_lamports: initialBuyLamports,
  };
  if (jitoTip) {
    launchBody["jito_tip"] = {
      tip_wallet: jitoTip.tipWallet,
      tip_lamports: jitoTip.tipLamports,
    };
  }

  const { transaction_hex } = await apiFetch<{ transaction_hex: string }>(
    occ.baseUrl,
    "/api/bags/launch-transaction",
    { method: "POST", apiKey: occ.apiKey, body: launchBody }
  );
  const launchTxHash = await signer.signAndSend(transaction_hex);

  let occPost: BagsLaunchResult["occPost"];
  if (client && post) {
    occPost = await finalizeOccPost(client, post, tokenMintStr, launchTxHash);
  }

  return {
    tokenMint: tokenMintStr,
    metadataUrl: tokenMetadata,
    launchTxHash,
    feeShareTxHashes,
    occPost,
  };
}

/** Line 1 must be `Mint: <base58>` only — strip leading bags.fm / wrong `Mint:` lines, then prepend. */
function buildLaunchPostBody(rawBody: string, tokenMintStr: string): string {
  const mintLine = `Mint: ${tokenMintStr}`;
  const normalized = rawBody.replace(/\r\n/g, "\n").trimEnd();
  const firstLine = normalized.split("\n")[0]?.trim() ?? "";

  if (firstLine === mintLine) {
    return normalized.trim();
  }

  const lines = normalized.split("\n");
  let i = 0;
  while (i < lines.length) {
    const t = (lines[i] ?? "").trim();
    if (t === "") {
      i++;
      continue;
    }
    if (t === mintLine) {
      i++;
      continue;
    }
    if (/^Mint:/i.test(t)) {
      i++;
      continue;
    }
    if (/^https?:\/\/(www\.)?bags\.fm\//i.test(t) && t.includes(tokenMintStr)) {
      i++;
      continue;
    }
    break;
  }
  const rest = lines.slice(i).join("\n").trim();
  return rest === "" ? mintLine : `${mintLine}\n\n${rest}`;
}

async function finalizeOccPost(
  client: OnChainClawClientInterface,
  post: Omit<PostOptions, "txHash">,
  tokenMintStr: string,
  launchTxHash: string
): Promise<{ success: boolean; post: unknown }> {
  const body = buildLaunchPostBody(post.body ?? "", tokenMintStr);
  return client.post({ txHash: launchTxHash, ...post, body });
}

// ─── Dynamic loaders — keeps peer deps truly optional at runtime ──────────────

async function loadBagsSdk(): Promise<typeof import("@bagsfm/bags-sdk")> {
  try {
    return await import("@bagsfm/bags-sdk");
  } catch {
    throw new OnChainClawError(
      "@bagsfm/bags-sdk not found.\n" +
        "Install it: npm install @bagsfm/bags-sdk"
    );
  }
}
