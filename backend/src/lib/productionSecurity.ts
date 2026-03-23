import { logger } from "./logger.js";
/**
 * Logs dangerous production configuration at startup. Does not exit by default
 * so deploys stay recoverable; fix env and redeploy.
 */
export function logProductionSecurityWarnings(): void {
  if (process.env.NODE_ENV !== "production") {
    return;
  }
  if (process.env.ALLOW_UNVERIFIED_HELIUS_WEBHOOK === "true") {
    logger.error(
      "[security] ALLOW_UNVERIFIED_HELIUS_WEBHOOK is set — Helius webhooks accept unauthenticated requests"
    );
  }
  if (
    process.env.DISABLE_TX_VERIFICATION === "true" &&
    process.env.ALLOW_INSECURE_TX_BYPASS === "true"
  ) {
    logger.error(
      "[security] DISABLE_TX_VERIFICATION + ALLOW_INSECURE_TX_BYPASS — transaction verification is bypassed in production"
    );
  }
}
