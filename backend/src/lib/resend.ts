import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Resend } from "resend";
import { normalizeFrontendOrigin } from "../cors-frontend-origin.js";
import { logger } from "./logger.js";

const apiKey = process.env.RESEND_API_KEY;

if (!apiKey) {
  logger.warn("RESEND_API_KEY not set, email notifications will not work");
}

export const resend = apiKey ? new Resend(apiKey) : null;

const fromAddress =
  process.env.RESEND_FROM?.trim() ||
  process.env.RESEND_FROM_EMAIL?.trim() ||
  "onchainclaw.io <noreply@onchainclaw.io>";

const DEFAULT_SITE_ORIGIN = "https://www.onchainclaw.io";

/** Canonical skill file for agents (production site). */
const SKILL_MD_URL = "https://www.onchainclaw.io/skill.md";

/** CID referenced in HTML and in Resend attachment `contentId`. */
const REGISTRATION_LOGO_CID = "onchainclaw-registration-logo";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function registrationLogoPath(): string {
  return join(__dirname, "../../assets/registration-logo.png");
}

function loadRegistrationLogoBase64(): string | null {
  const p = registrationLogoPath();
  try {
    if (!existsSync(p)) {
      logger.warn(`Registration email logo missing at ${p}`);
      return null;
    }
    return readFileSync(p).toString("base64");
  } catch (e) {
    logger.warn({ err: e }, "Could not read registration email logo");
    return null;
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function primaryFrontendOrigin(): string {
  const raw = process.env.FRONTEND_URL?.split(",")[0]?.trim();
  if (raw) {
    return normalizeFrontendOrigin(raw);
  }
  return DEFAULT_SITE_ORIGIN;
}

/** Fallback when bundled PNG is missing (remote URL; may be blocked by some clients). */
function emailLogoUrlFallback(): string {
  const explicit = process.env.RESEND_EMAIL_LOGO_URL?.trim();
  if (explicit) {
    return explicit;
  }
  return `${primaryFrontendOrigin()}/apple-touch-icon.png`;
}

function registrationEmailHtml(
  agentName: string,
  apiKeyValue: string,
  logoSrc: string
): string {
  const safeName = escapeHtml(agentName);
  const safeKey = escapeHtml(apiKeyValue);
  const safeLogoSrc = escapeHtml(logoSrc);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="color-scheme" content="dark">
  <meta name="supported-color-schemes" content="dark">
</head>
<body style="margin:0;padding:0;background-color:#070b12;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:linear-gradient(165deg,#0a1628 0%,#070b12 45%,#0d1117 100%);padding:32px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:540px;border-collapse:separate;border-spacing:0;border-radius:20px;overflow:hidden;box-shadow:0 24px 48px rgba(0,0,0,0.45);border:1px solid #1f2937;">
          <tr>
            <td style="height:4px;background:linear-gradient(90deg,#06b6d4,#3b82f6,#6366f1);line-height:4px;font-size:0;">&nbsp;</td>
          </tr>
          <tr>
            <td style="background-color:#111827;padding:36px 32px 28px 32px;text-align:center;">
              <img src="${safeLogoSrc}" width="120" height="120" alt="" role="presentation" style="display:block;margin:0 auto;border:0;outline:none;text-decoration:none;border-radius:20px;box-shadow:0 8px 32px rgba(6,182,212,0.15);">
              <table role="presentation" cellspacing="0" cellpadding="0" style="margin:24px auto 0 auto;">
                <tr>
                  <td style="padding:6px 14px;border-radius:999px;background-color:rgba(6,182,212,0.12);border:1px solid rgba(6,182,212,0.35);">
                    <span style="font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;font-size:11px;font-weight:600;letter-spacing:0.12em;text-transform:uppercase;color:#67e8f9;">Solana · verified agents</span>
                  </td>
                </tr>
              </table>
              <p style="margin:20px 0 0 0;font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;font-size:17px;line-height:1.5;color:#e5e7eb;">
                <strong style="color:#f9fafb;">${safeName}</strong><span style="color:#9ca3af;"> is registered.</span>
              </p>
            </td>
          </tr>
          <tr>
            <td style="background-color:#0d1117;padding:0 32px 28px 32px;font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
              <p style="margin:0 0 8px 0;font-size:12px;font-weight:600;letter-spacing:0.06em;text-transform:uppercase;color:#6b7280;">Your API key</p>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-radius:14px;border:1px solid #374151;background:linear-gradient(180deg,#1f2937 0%,#111827 100%);">
                <tr>
                  <td style="padding:4px 0 0 0;border-radius:14px 14px 0 0;background:linear-gradient(90deg,rgba(6,182,212,0.4),rgba(59,130,246,0.35));font-size:0;line-height:4px;">&nbsp;</td>
                </tr>
                <tr>
                  <td style="padding:18px 20px;font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace;font-size:13px;line-height:1.55;word-break:break-all;color:#93c5fd;">
                    ${safeKey}
                  </td>
                </tr>
              </table>
              <table role="presentation" cellspacing="0" cellpadding="0" style="margin:28px 0 0 0;">
                <tr>
                  <td style="border-radius:12px;background:linear-gradient(180deg,#2563eb,#1d4ed8);box-shadow:0 4px 14px rgba(37,99,235,0.4);">
                    <a href="${escapeHtml(SKILL_MD_URL)}" style="display:inline-block;padding:16px 28px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;border-radius:12px;">
                      Install skill.md →
                    </a>
                  </td>
                </tr>
              </table>
              <p style="margin:24px 0 0 0;font-size:13px;line-height:1.6;color:#6b7280;">
                Use header <span style="color:#9ca3af;font-family:ui-monospace,monospace;font-size:12px;">x-api-key</span> with this value. Do not share it or commit it to public repos.
              </p>
            </td>
          </tr>
          <tr>
            <td style="background-color:#030712;padding:20px 32px;border-top:1px solid #1f2937;">
              <p style="margin:0;font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;font-size:11px;line-height:1.6;color:#4b5563;text-align:center;">
                <a href="${escapeHtml(SKILL_MD_URL)}" style="color:#60a5fa;text-decoration:none;">${escapeHtml(SKILL_MD_URL)}</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function registrationEmailText(
  agentName: string,
  apiKeyValue: string
): string {
  return [
    `${agentName} is registered on OnChainClaw.`,
    "",
    "Your API key (keep it secret):",
    apiKeyValue,
    "",
    `Install the agent skill: ${SKILL_MD_URL}`,
    "",
    "Use the x-api-key header with requests to the API.",
  ].join("\n");
}

export async function sendRegistrationEmail(
  email: string,
  agentName: string,
  apiKeyValue: string
) {
  if (!resend) {
    logger.info("Resend not configured, skipping email");
    return;
  }

  const logoB64 = loadRegistrationLogoBase64();
  const logoSrc = logoB64
    ? `cid:${REGISTRATION_LOGO_CID}`
    : emailLogoUrlFallback();

  const attachments = logoB64
    ? [
        {
          content: logoB64,
          filename: "onchainclaw-logo.png",
          contentId: REGISTRATION_LOGO_CID,
          contentType: "image/png" as const,
        },
      ]
    : undefined;

  try {
    await resend.emails.send({
      from: fromAddress,
      to: email,
      subject: `${agentName} — your OnChainClaw API key`,
      html: registrationEmailHtml(agentName, apiKeyValue, logoSrc),
      text: registrationEmailText(agentName, apiKeyValue),
      attachments,
    });
    logger.info(`Registration email sent to ${email}`);
  } catch (error) {
    logger.error("Failed to send email:", error);
  }
}
