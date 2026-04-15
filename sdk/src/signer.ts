/**
 * Shared Solana transaction signing utilities.
 * Used by bags.ts (Bags.fm launch) and memo.ts (Memo program posts).
 */
import bs58 from "bs58";
import { OnChainClawError, apiFetch, DEFAULT_BASE_URL } from "./api.js";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ResolvedSigner {
  walletAddress: string;
  signAndSend: (txHex: string) => Promise<string>;
}

/** When set, signed txs are sent via `POST /api/bags/broadcast` instead of raw RPC. */
export type OccBroadcast = { apiKey: string; baseUrl: string };

export type SignerSourceParams = {
  /**
   * OWS wallet name (highest priority).
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
   * Receives a hex-encoded unsigned VersionedTransaction, must return the
   * confirmed Solana tx signature (base58).
   * Requires `wallet` to be set.
   */
  signAndSendFn?: (txHex: string) => Promise<string>;
  /** Solana wallet address (base58) for the custom signAndSendFn. */
  wallet?: string;
};

// ─── Signer resolution ────────────────────────────────────────────────────────

export async function resolveSigner(
  params: SignerSourceParams,
  rpcUrl: string,
  occBroadcast: OccBroadcast | undefined
): Promise<ResolvedSigner> {
  if (params.owsWalletName) {
    return resolveOwsSigner(
      params.owsWalletName,
      params.owsPassphrase ?? null,
      rpcUrl,
      occBroadcast
    );
  }

  if (params.secretKey) {
    return resolveKeypairSigner(params.secretKey, rpcUrl, occBroadcast);
  }

  if (params.signAndSendFn && params.wallet) {
    return {
      walletAddress: params.wallet,
      signAndSend: params.signAndSendFn,
    };
  }

  throw new OnChainClawError(
    "No signing method provided.\n" +
      "Supply one of:\n" +
      "  • owsWalletName (+ optional owsPassphrase)\n" +
      "  • secretKey (base58-encoded 64-byte Solana key)\n" +
      "  • wallet + signAndSendFn"
  );
}

export async function broadcastAfterSign(
  signedTxBytes: Uint8Array,
  rpcUrl: string,
  occBroadcast: OccBroadcast | undefined
): Promise<string> {
  const hex = Buffer.from(signedTxBytes).toString("hex");
  if (occBroadcast) {
    const { signature } = await apiFetch<{ signature: string }>(
      occBroadcast.baseUrl,
      "/api/bags/broadcast",
      {
        method: "POST",
        apiKey: occBroadcast.apiKey,
        body: { signed_transaction_hex: hex },
      }
    );
    return signature;
  }

  const { Connection } = await loadWeb3();
  const connection = new Connection(rpcUrl, "processed");
  const txHash = await connection.sendRawTransaction(signedTxBytes, {
    skipPreflight: false,
  });
  const { blockhash, lastValidBlockHeight } =
    await connection.getLatestBlockhash("processed");
  await connection.confirmTransaction(
    { signature: txHash, blockhash, lastValidBlockHeight },
    "processed"
  );
  return txHash;
}

async function resolveOwsSigner(
  walletName: string,
  passphrase: string | null,
  rpcUrl: string,
  occBroadcast: OccBroadcast | undefined
): Promise<ResolvedSigner> {
  const ows = await loadOws();

  const walletData = ows.getWallet(walletName);
  const solanaAccount = walletData.accounts.find(
    (a: { chainId: string; address: string }) => a.chainId.startsWith("solana:")
  );
  if (!solanaAccount) {
    throw new OnChainClawError(
      `OWS wallet "${walletName}" has no Solana account. ` +
        "Make sure it was created with Solana support."
    );
  }

  return {
    walletAddress: solanaAccount.address,
    signAndSend: async (txHex: string): Promise<string> => {
      const { VersionedTransaction, PublicKey: PK } = await loadWeb3();

      const txBytes = Buffer.from(txHex, "hex");
      const tx = VersionedTransaction.deserialize(txBytes);
      const messageHex = Buffer.from(tx.message.serialize()).toString("hex");

      const { signature: sigHex } = ows.signMessage(
        walletName,
        "solana",
        messageHex,
        passphrase,
        "hex"
      );
      const sigBytes = Buffer.from(sigHex, "hex");

      const walletPubkey = new PK(solanaAccount.address);
      const signerIndex = tx.message.staticAccountKeys.findIndex((k) =>
        k.equals(walletPubkey)
      );
      if (signerIndex < 0 || signerIndex >= tx.signatures.length) {
        throw new OnChainClawError(
          `Wallet ${solanaAccount.address} is not a signer in this transaction.`
        );
      }
      tx.signatures[signerIndex] = sigBytes;

      return broadcastAfterSign(tx.serialize(), rpcUrl, occBroadcast);
    },
  };
}

async function resolveKeypairSigner(
  secretKeyBase58: string,
  rpcUrl: string,
  occBroadcast: OccBroadcast | undefined
): Promise<ResolvedSigner> {
  const { Keypair, VersionedTransaction } = await loadWeb3();

  const keypair = Keypair.fromSecretKey(bs58.decode(secretKeyBase58));
  const walletAddress = keypair.publicKey.toBase58();

  return {
    walletAddress,
    signAndSend: async (txHex: string): Promise<string> => {
      const txBytes = Buffer.from(txHex, "hex");
      const tx = VersionedTransaction.deserialize(txBytes);
      tx.sign([keypair]);
      return broadcastAfterSign(tx.serialize(), rpcUrl, occBroadcast);
    },
  };
}

// ─── Dynamic loaders — keeps peer deps truly optional at runtime ──────────────

export async function loadOws(): Promise<typeof import("@open-wallet-standard/core")> {
  try {
    return await import("@open-wallet-standard/core");
  } catch {
    throw new OnChainClawError(
      "@open-wallet-standard/core not found.\n" +
        "Install it: npm install @open-wallet-standard/core"
    );
  }
}

export async function loadWeb3(): Promise<typeof import("@solana/web3.js")> {
  try {
    return await import("@solana/web3.js");
  } catch {
    throw new OnChainClawError(
      "@solana/web3.js not found.\n" +
        "Install it: npm install @solana/web3.js"
    );
  }
}
