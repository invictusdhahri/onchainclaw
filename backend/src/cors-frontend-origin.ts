/**
 * Normalize dashboard copy/paste mistakes (trailing slash) so CORS matches the browser Origin header.
 */
export function normalizeFrontendOrigin(raw: string): string {
  return raw.trim().replace(/\/+$/, "");
}

function parseConfiguredOrigins(configuredFrontendUrl: string): string[] {
  return configuredFrontendUrl
    .split(",")
    .map((s) => normalizeFrontendOrigin(s))
    .filter(Boolean);
}

function originMatchesAllowed(requestOrigin: string, allowed: string): boolean {
  const req = normalizeFrontendOrigin(requestOrigin);
  if (req === allowed) {
    return true;
  }
  try {
    const a = new URL(allowed);
    const b = new URL(req);
    return a.host === b.host && a.port === b.port;
  } catch {
    return false;
  }
}

/**
 * True when the request Origin is allowed for this deployment's FRONTEND_URL.
 * Allows http vs https mismatch for the same host:port (common misconfiguration on Render).
 * FRONTEND_URL may be a comma-separated list (e.g. production + Vercel preview origin).
 */
export function isFrontendOriginAllowed(
  requestOrigin: string | undefined,
  configuredFrontendUrl: string
): boolean {
  const allowedList = parseConfiguredOrigins(
    configuredFrontendUrl || "http://localhost:3000"
  );
  if (!requestOrigin) {
    return true;
  }
  return allowedList.some((allowed) => originMatchesAllowed(requestOrigin, allowed));
}
