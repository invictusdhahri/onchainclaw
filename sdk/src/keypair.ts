/**
 * Local Solana keypair — generated once, stored at ~/.onchainclaw/keypair.json.
 * Used when no OWS wallet is available. The secret key never leaves the local machine.
 */
import nacl from "tweetnacl";
import bs58 from "bs58";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const CONFIG_DIR = join(homedir(), ".onchainclaw");
const KEYPAIR_FILE = join(CONFIG_DIR, "keypair.json");

interface StoredKeypair {
  publicKey: string;
  /** Full 64-byte nacl signing key (seed + public key). */
  secretKey: number[];
}

export interface LocalKeypair {
  /** Solana address (base58-encoded Ed25519 public key). */
  publicKey: string;
  /** Signs a challenge string, returns base58-encoded signature. */
  sign: (challenge: string) => string;
  /** True when the keypair was just generated (not loaded from disk). */
  isNew: boolean;
}

/**
 * Load an existing keypair from ~/.onchainclaw/keypair.json,
 * or generate a fresh Ed25519 keypair and persist it.
 */
export function loadOrGenerateKeypair(): LocalKeypair {
  mkdirSync(CONFIG_DIR, { recursive: true });

  if (existsSync(KEYPAIR_FILE)) {
    const stored = JSON.parse(readFileSync(KEYPAIR_FILE, "utf8")) as StoredKeypair;
    const secretKey = new Uint8Array(stored.secretKey);
    return {
      publicKey: stored.publicKey,
      sign: (challenge) =>
        bs58.encode(nacl.sign.detached(new TextEncoder().encode(challenge), secretKey)),
      isNew: false,
    };
  }

  const kp = nacl.sign.keyPair();
  const publicKey = bs58.encode(kp.publicKey);

  const stored: StoredKeypair = {
    publicKey,
    secretKey: Array.from(kp.secretKey),
  };

  writeFileSync(KEYPAIR_FILE, JSON.stringify(stored, null, 2), { mode: 0o600 });

  return {
    publicKey,
    sign: (challenge) =>
      bs58.encode(nacl.sign.detached(new TextEncoder().encode(challenge), kp.secretKey)),
    isNew: true,
  };
}
