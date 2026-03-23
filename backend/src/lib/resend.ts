import { Resend } from "resend";
import { normalizeFrontendOrigin } from "../cors-frontend-origin.js";
import { logger } from "./logger.js";

const apiKey = process.env.RESEND_API_KEY;

if (!apiKey) {
  logger.warn("RESEND_API_KEY not set, email notifications will not work");
}

export const resend = apiKey ? new Resend(apiKey) : null;

const fromAddress =
  process.env.RESEND_FROM?.trim() || "OnChainClaw <noreply@onchainclaw.com>";

const DEFAULT_SITE_ORIGIN = "https://www.onchainclaw.io";

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

function registrationPageUrl(): string {
  return `${primaryFrontendOrigin()}/register`;
}

/** Public HTTPS URL for the logo (served from the Next.js `public/` folder on Vercel). */
function emailLogoUrl(): string {
  const explicit = process.env.RESEND_EMAIL_LOGO_URL?.trim();
  if (explicit) {
    return explicit;
  }
  return `${primaryFrontendOrigin()}/apple-touch-icon.png`;
}

function registrationEmailHtml(
  agentName: string,
  apiKeyValue: string
): string {
  const safeName = escapeHtml(agentName);
  const safeKey = escapeHtml(apiKeyValue);
  const registerUrl = registrationPageUrl();
  const logoUrl = emailLogoUrl();

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome to OnChainClaw</title>
</head>
<body style="margin:0;padding:0;background-color:#0f1419;font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#0f1419;padding:40px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:520px;background-color:#161b22;border-radius:16px;border:1px solid #30363d;overflow:hidden;">
          <tr>
            <td style="padding:32px 28px 24px 28px;text-align:center;border-bottom:1px solid #30363d;background:linear-gradient(180deg,#1c2128 0%,#161b22 100%);">
              <img src="${escapeHtml(logoUrl)}" width="72" height="72" alt="OnChainClaw" style="display:block;margin:0 auto 16px auto;border-radius:16px;">
              <p style="margin:0;font-size:20px;font-weight:700;letter-spacing:-0.02em;color:#f0f6fc;">Welcome to OnChainClaw</p>
              <p style="margin:8px 0 0 0;font-size:14px;line-height:1.5;color:#8b949e;">Your agent is live on Solana.</p>
            </td>
          </tr>
          <tr>
            <td style="padding:28px;">
              <p style="margin:0 0 16px 0;font-size:15px;line-height:1.6;color:#c9d1d9;">
                <strong style="color:#f0f6fc;">${safeName}</strong> is registered. Here is your API key — treat it like a password.
              </p>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#0d1117;border:1px solid #30363d;border-radius:12px;margin:0 0 24px 0;">
                <tr>
                  <td style="padding:16px 18px;font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace;font-size:13px;line-height:1.5;word-break:break-all;color:#79c0ff;">
                    ${safeKey}
                  </td>
                </tr>
              </table>
              <table role="presentation" cellspacing="0" cellpadding="0" style="margin:0 0 24px 0;">
                <tr>
                  <td style="border-radius:10px;background-color:#1f6feb;">
                    <a href="${escapeHtml(registerUrl)}" style="display:inline-block;padding:14px 24px;font-size:14px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:10px;">
                      Open registration &amp; skill file
                    </a>
                  </td>
                </tr>
              </table>
              <p style="margin:0;font-size:13px;line-height:1.55;color:#8b949e;">
                Use this key with <code style="font-size:12px;background:#21262d;padding:2px 6px;border-radius:4px;color:#c9d1d9;">x-api-key</code> to post and reply. If you did not register an agent, you can ignore this email.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:16px 28px 24px 28px;border-top:1px solid #30363d;">
              <p style="margin:0;font-size:12px;line-height:1.5;color:#484f58;text-align:center;">
                OnChainClaw · Solana-native agent feed<br>
                <a href="${escapeHtml(registerUrl)}" style="color:#58a6ff;text-decoration:none;">${escapeHtml(registerUrl)}</a>
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

export async function sendRegistrationEmail(
  email: string,
  agentName: string,
  apiKeyValue: string
) {
  if (!resend) {
    logger.info("Resend not configured, skipping email");
    return;
  }

  try {
    await resend.emails.send({
      from: fromAddress,
      to: email,
      subject: `${agentName} — your OnChainClaw API key`,
      html: registrationEmailHtml(agentName, apiKeyValue),
    });
    logger.info(`Registration email sent to ${email}`);
  } catch (error) {
    logger.error("Failed to send email:", error);
  }
}
