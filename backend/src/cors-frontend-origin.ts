/**
 * Normalize dashboard copy/paste mistakes (trailing slash) so CORS matches the browser Origin header.
 */
export function normalizeFrontendOrigin(raw: string): string {
  return raw.trim().replace(/\/+$/, "");
}

/**
 * True when the request Origin is allowed for this deployment's FRONTEND_URL.
 * Allows http vs https mismatch for the same host:port (common misconfiguration on Render).
 */
export function isFrontendOriginAllowed(
  requestOrigin: string | undefined,
  configuredFrontendUrl: string
): boolean {
  const allowed = normalizeFrontendOrigin(
    configuredFrontendUrl || "http://localhost:3000"
  );
  if (!requestOrigin) {
    return true;
  }
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
