#!/usr/bin/env node
/**
 * Test script for Resend email configuration
 * Usage: node scripts/test-email.mjs your-email@example.com
 */

import { config as loadEnv } from "dotenv";
import { Resend } from "resend";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
loadEnv({ path: path.resolve(__dirname, "../backend/.env") });

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || "OnChainClaw <noreply@onchainclaw.com>";

// Get test email from command line
const testEmail = process.argv[2];

if (!testEmail) {
  console.error("❌ Error: Please provide a test email address");
  console.log("\nUsage:");
  console.log("  node scripts/test-email.mjs your-email@example.com\n");
  process.exit(1);
}

if (!RESEND_API_KEY) {
  console.error("❌ Error: RESEND_API_KEY not found in backend/.env");
  console.log("\nPlease add your Resend API key to backend/.env:");
  console.log('  RESEND_API_KEY=re_your_key_here\n');
  process.exit(1);
}

console.log("🧪 Testing Resend Email Configuration\n");
console.log(`📧 From: ${FROM_EMAIL}`);
console.log(`📬 To: ${testEmail}`);
console.log(`🔑 API Key: ${RESEND_API_KEY.slice(0, 10)}...${RESEND_API_KEY.slice(-4)}\n`);

const resend = new Resend(RESEND_API_KEY);

async function testEmail() {
  try {
    console.log("📤 Sending test email...\n");

    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: testEmail,
      subject: "🧪 OnChainClaw Email Test",
      html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
    <h1 style="color: white; margin: 0; font-size: 28px;">✅ Email Test Successful!</h1>
  </div>
  
  <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
    <p style="font-size: 16px;">
      If you're reading this, your Resend email configuration is working correctly! 🎉
    </p>
    
    <div style="background: white; padding: 20px; margin: 20px 0; border-radius: 8px; border-left: 4px solid #10b981;">
      <h3 style="margin-top: 0; color: #10b981;">✅ Configuration Status:</h3>
      <ul style="list-style: none; padding: 0;">
        <li style="margin-bottom: 10px;">✓ Domain verified</li>
        <li style="margin-bottom: 10px;">✓ DNS records configured</li>
        <li style="margin-bottom: 10px;">✓ SSL/TLS enabled</li>
        <li style="margin-bottom: 10px;">✓ API key working</li>
        <li>✓ Email delivery confirmed</li>
      </ul>
    </div>
    
    <div style="background: #e8f5e9; border-left: 4px solid #4caf50; padding: 15px; margin: 20px 0; border-radius: 4px;">
      <p style="margin: 0; color: #2e7d32;">
        <strong>🚀 You're ready to go!</strong> New agents will now receive their API keys via email.
      </p>
    </div>
    
    <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; text-align: center; color: #666; font-size: 14px;">
      <p style="margin: 5px 0;">This was a test email sent from your OnChainClaw backend</p>
      <p style="margin: 5px 0;">Timestamp: ${new Date().toISOString()}</p>
    </div>
  </div>
</body>
</html>
      `,
    });

    if (error) {
      console.error("❌ Error sending email:", error);
      process.exit(1);
    }

    console.log("✅ Email sent successfully!\n");
    console.log("📊 Response data:");
    console.log(JSON.stringify(data, null, 2));
    console.log("\n📬 Check your inbox (and spam folder) at:", testEmail);
    console.log("\n🔍 View delivery status:");
    console.log("   → Resend Dashboard: https://resend.com/emails");
    console.log(`   → Email ID: ${data?.id || "N/A"}\n`);

  } catch (error) {
    console.error("❌ Fatal error:", error.message);
    console.error("\nTroubleshooting:");
    console.error("  1. Verify RESEND_API_KEY is correct");
    console.error("  2. Check that your domain is verified in Resend");
    console.error("  3. Ensure DNS records are properly configured");
    console.error("  4. Wait 5-10 minutes after adding DNS records\n");
    process.exit(1);
  }
}

testEmail();
