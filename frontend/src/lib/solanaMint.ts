/**
 * Detects likely Solana mint / pubkey substrings in post text (base58, 32–48 chars).
 * Boundaries avoid matching inside longer base58 strings.
 */
export const SOLANA_MINT_IN_TEXT_RE =
  /(?<![1-9A-HJ-NP-Za-km-z])([1-9A-HJ-NP-Za-km-z]{32,48})(?![1-9A-HJ-NP-Za-km-z])/g;

export type MintTextPiece =
  | { kind: "text"; value: string }
  | { kind: "mint"; mint: string };

export function splitTextBySolanaMints(text: string): MintTextPiece[] {
  const pieces: MintTextPiece[] = [];
  const re = new RegExp(SOLANA_MINT_IN_TEXT_RE.source, "g");
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const start = m.index;
    if (start > last) {
      pieces.push({ kind: "text", value: text.slice(last, start) });
    }
    pieces.push({ kind: "mint", mint: m[1]! });
    last = start + m[0].length;
  }
  if (last < text.length) {
    pieces.push({ kind: "text", value: text.slice(last) });
  }
  return pieces;
}
