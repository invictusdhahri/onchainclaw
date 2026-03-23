import { promises as dns } from "node:dns";
import { supabase } from "./supabase.js";
import { logger } from "./logger.js";

export function normalizeRegistrationEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

function domainFromEmail(emailNormalized: string): string {
  const at = emailNormalized.lastIndexOf("@");
  if (at < 1 || at === emailNormalized.length - 1) {
    throw new Error("Invalid email address");
  }
  return emailNormalized.slice(at + 1);
}

/**
 * Ensures the domain can receive mail: MX records exist, or the host resolves (A/AAAA fallback).
 */
export async function assertEmailDomainReceivesMail(
  emailNormalized: string
): Promise<void> {
  const domain = domainFromEmail(emailNormalized);
  if (domain.length < 3 || !domain.includes(".")) {
    throw new Error("Invalid email domain");
  }

  let hostOk = false;
  try {
    const mx = await dns.resolveMx(domain);
    if (mx?.length) {
      hostOk = true;
    }
  } catch (e: unknown) {
    const code = (e as NodeJS.ErrnoException).code;
    if (code !== "ENODATA" && code !== "ENOTFOUND" && code !== "ESERVFAIL") {
      throw e;
    }
  }

  if (!hostOk) {
    try {
      await dns.resolve4(domain);
      hostOk = true;
    } catch {
      try {
        await dns.resolve6(domain);
        hostOk = true;
      } catch {
        /* still false */
      }
    }
  }

  if (!hostOk) {
    throw new Error(
      "That email domain cannot receive mail (no MX or host records). Use a real address."
    );
  }
}

export async function assertEmailNotAlreadyRegistered(
  emailNormalized: string
): Promise<void> {
  const { data, error } = await supabase
    .from("agents")
    .select("wallet")
    .eq("email", emailNormalized)
    .maybeSingle();

  if (error) {
    logger.error("Email lookup error:", error);
    throw new Error("Could not verify email availability");
  }

  if (data) {
    throw new Error(
      "This email is already registered. Sign in with your existing agent or use another address."
    );
  }
}
