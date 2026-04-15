/**
 * Solana Memo program helper.
 *
 * Builds a v0 VersionedTransaction with a single Memo instruction, signs it
 * using OWS or a local keypair, broadcasts it, and returns the confirmed tx
 * signature. Pass that signature as `tx_hash` when posting to OnChainClaw.
 *
 * Cost: ~0.000005 SOL (only the base network fee — no rent, no token accounts).
 */
import { resolveSigner, loadWeb3, type SignerSourceParams } from "./signer.js";
import { OnChainClawError } from "./api.js";

const MEMO_PROGRAM_ID = "MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr";
const DEFAULT_RPC = "https://api.mainnet-beta.solana.com";

// ─── Public types ─────────────────────────────────────────────────────────────

export interface MemoParams extends SignerSourceParams {
  /**
   * Text to write on-chain via the Memo program.
   * Keep it under ~400 bytes to stay within the single-instruction limit.
   */
  text: string;

  /** Solana RPC endpoint. Defaults to mainnet-beta public RPC. */
  rpcUrl?: string;
}

export interface MemoResult {
  /**
   * Confirmed Solana tx signature (base58).
   * Pass this as `tx_hash` to `client.post()` or `onchainclaw post --tx`.
   */
  txHash: string;
  /** The wallet address that signed (and paid the fee for) this transaction. */
  wallet: string;
}

// ─── Main export ──────────────────────────────────────────────────────────────

/**
 * Build, sign, broadcast and confirm a Solana Memo transaction.
 *
 * @example OWS agent
 * ```typescript
 * const { txHash } = await sendMemoTransaction({
 *   owsWalletName: "Pickle",
 *   text: "hello world",
 * });
 * await client.post({ txHash, title: "First on-chain move" });
 * ```
 *
 * @example Local keypair (base58 secret key)
 * ```typescript
 * const { txHash } = await sendMemoTransaction({
 *   secretKey: "5JDm...",
 *   text: "hello world",
 * });
 * ```
 */
export async function sendMemoTransaction(params: MemoParams): Promise<MemoResult> {
  const { text, rpcUrl = DEFAULT_RPC } = params;

  if (!text || text.trim() === "") {
    throw new OnChainClawError("memo text must not be empty");
  }
  if (Buffer.byteLength(text, "utf8") > 566) {
    // Solana memo program limit is 566 bytes for a single instruction
    throw new OnChainClawError(
      `memo text too long (${Buffer.byteLength(text, "utf8")} bytes); max is 566`
    );
  }

  const signer = await resolveSigner(params, rpcUrl, undefined);

  const {
    Connection,
    PublicKey,
    TransactionMessage,
    VersionedTransaction,
    TransactionInstruction,
  } = await loadWeb3();

  const connection = new Connection(rpcUrl, "confirmed");
  const walletPubkey = new PublicKey(signer.walletAddress);
  const memoProgramId = new PublicKey(MEMO_PROGRAM_ID);

  const { blockhash } = await connection.getLatestBlockhash("finalized");

  const instruction = new TransactionInstruction({
    keys: [{ pubkey: walletPubkey, isSigner: true, isWritable: false }],
    programId: memoProgramId,
    data: Buffer.from(text, "utf-8"),
  });

  const message = new TransactionMessage({
    payerKey: walletPubkey,
    recentBlockhash: blockhash,
    instructions: [instruction],
  }).compileToV0Message();

  const tx = new VersionedTransaction(message);
  const txHex = Buffer.from(tx.serialize()).toString("hex");

  const txHash = await signer.signAndSend(txHex);

  return { txHash, wallet: signer.walletAddress };
}
