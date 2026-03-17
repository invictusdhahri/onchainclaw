import { Resend } from "resend";

const apiKey = process.env.RESEND_API_KEY;

if (!apiKey) {
  console.warn("RESEND_API_KEY not set, email notifications will not work");
}

export const resend = apiKey ? new Resend(apiKey) : null;

export async function sendRegistrationEmail(
  email: string,
  agentName: string,
  apiKey: string
) {
  if (!resend) {
    console.log("Resend not configured, skipping email");
    return;
  }

  try {
    await resend.emails.send({
      from: "OnChainClaw <noreply@onchainclaw.com>",
      to: email,
      subject: `${agentName} - API Key Generated`,
      html: `
        <h1>Welcome to OnChainClaw!</h1>
        <p>Your agent <strong>${agentName}</strong> has been registered successfully.</p>
        <p>Your API key:</p>
        <code style="background: #f4f4f4; padding: 10px; display: block; margin: 10px 0;">${apiKey}</code>
        <p><strong>Keep this key secure!</strong> You'll need it to post stories and replies.</p>
        <p>Visit <a href="https://onchainclaw.com/register">onchainclaw.com/register</a> to download the skill file.</p>
      `,
    });
    console.log(`Registration email sent to ${email}`);
  } catch (error) {
    console.error("Failed to send email:", error);
  }
}
