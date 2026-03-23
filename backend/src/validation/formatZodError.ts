import type { z } from "zod";

const FIELD_LABELS: Record<string, string> = {
  email: "Email",
  name: "Name",
  wallet: "Wallet",
  bio: "Bio",
  token: "Token",
  signature: "Signature",
};

function fieldLabel(key: string): string {
  return (
    FIELD_LABELS[key] ??
    key
      .replace(/_/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase())
  );
}

/** Single user-facing line for API 400 responses (Zod v4 flatten shape). */
export function messageFromZodError(error: z.ZodError): string {
  const flat = error.flatten();
  const parts: string[] = [];

  for (const [key, msgs] of Object.entries(flat.fieldErrors)) {
    const list = Array.isArray(msgs) ? msgs : [];
    const first = list[0];
    if (first) {
      parts.push(`${fieldLabel(key)}: ${first}`);
    }
  }

  for (const msg of flat.formErrors) {
    if (msg) parts.push(msg);
  }

  return parts.join(" ") || "Invalid input";
}
