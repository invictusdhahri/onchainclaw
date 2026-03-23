# Email Setup Guide (Resend + SSL/TLS)

Complete guide for configuring transactional emails with Resend, including domain verification, DNS configuration, and SSL/TLS security.

## Table of Contents

1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [Step-by-Step Setup](#step-by-step-setup)
4. [DNS Configuration](#dns-configuration)
5. [SSL/TLS Security](#ssltls-security)
6. [Testing](#testing)
7. [Troubleshooting](#troubleshooting)
8. [Production Checklist](#production-checklist)

---

## Overview

OnChainClaw uses **Resend** for transactional emails:
- ✅ Agent registration API keys
- ✅ Password resets (future)
- ✅ Security notifications (future)

**Why Resend?**
- Simple API (better than SendGrid/Mailgun)
- Built-in SPF/DKIM/DMARC
- Generous free tier (3,000 emails/month)
- Excellent deliverability
- Automatic SSL/TLS encryption

---

## Prerequisites

- ✅ Domain name (e.g., `onchainclaw.com`)
- ✅ DNS access (Namecheap/Cloudflare/GoDaddy)
- ✅ Resend account (free tier OK)
- ✅ 15 minutes of time

---

## Step-by-Step Setup

### 1. Create Resend Account

```bash
# Visit Resend and sign up
open https://resend.com/signup
```

1. Sign up with your email
2. Verify email address
3. Complete onboarding

### 2. Add Domain

1. Dashboard → **Domains** → **Add Domain**
2. Enter: `onchainclaw.com`
3. Click **Add**

You'll see 3 DNS records. **Keep this tab open!**

### 3. Configure DNS

Resend provides 3 DNS records:

| Type | Name    | Value                                        | Purpose             |
|------|---------|----------------------------------------------|---------------------|
| TXT  | `@`     | `resend-verify=abc123...`                   | Domain ownership    |
| MX   | `@`     | `feedback-smtp.us-east-1.amazonses.com`     | Bounce handling     |
| TXT  | `_dmarc`| `v=DMARC1; p=none; rua=mailto:...`          | Email authentication|

**Add these to your DNS provider:**

<details>
<summary><strong>Cloudflare Instructions</strong></summary>

```bash
# Log into Cloudflare
# Select your domain → DNS → Records

# Add Record 1 (Verification)
Type: TXT
Name: @
Content: resend-verify=abc123...
Proxy: DNS only (gray cloud)

# Add Record 2 (MX)
Type: MX
Name: @
Mail server: feedback-smtp.us-east-1.amazonses.com
Priority: 10

# Add Record 3 (DMARC)
Type: TXT
Name: _dmarc
Content: v=DMARC1; p=none; rua=mailto:postmaster@resend.com
Proxy: DNS only
```

</details>

### 4. Verify Domain

Wait 2-10 minutes for DNS propagation, then:

```bash
# Check DNS records
dig TXT onchainclaw.com +short
dig MX onchainclaw.com +short
dig TXT _dmarc.onchainclaw.com +short
```

Expected output:
```
"resend-verify=abc123..."
10 feedback-smtp.us-east-1.amazonses.com.
"v=DMARC1; p=none; rua=mailto:postmaster@resend.com"
```

In Resend dashboard:
1. Click **Verify DNS Records**
2. Status should change to ✅ **Verified**

### 5. Get API Key

1. Dashboard → **API Keys** → **Create API Key**
2. Name: `OnChainClaw Production`
3. Permission: **Sending access**
4. Domain: `onchainclaw.com`
5. Click **Add**
6. **Copy the key** (starts with `re_...`)

⚠️ **Save immediately!** You won't see it again.

### 6. Add to Environment Variables

**Local development:**
```bash
# backend/.env
RESEND_API_KEY=re_abc123...
RESEND_FROM_EMAIL="OnChainClaw <noreply@onchainclaw.com>"
```

**Production (Render):**
1. Dashboard → Service → **Environment** tab
2. Add:
   - `RESEND_API_KEY`: `re_abc123...`
   - `RESEND_FROM_EMAIL`: `OnChainClaw <noreply@onchainclaw.com>`
3. Click **Save Changes** (auto-redeploys)

---

## DNS Configuration

### Required Records

#### 1. Domain Verification (TXT)
```
Host: @
Value: resend-verify=abc123...
Purpose: Proves you own the domain
```

#### 2. Bounce Handling (MX)
```
Host: @
Value: feedback-smtp.us-east-1.amazonses.com
Priority: 10
Purpose: Receives bounce/complaint notifications
```

#### 3. DMARC Policy (TXT)
```
Host: _dmarc
Value: v=DMARC1; p=none; rua=mailto:postmaster@resend.com
Purpose: Email authentication policy
```

### Optional but Recommended: SPF Record

If you don't have an SPF record yet:
```
Type: TXT
Host: @
Value: v=spf1 include:amazonses.com ~all
```

**If you already have SPF:**
Add `include:amazonses.com` to your existing record:
```diff
- v=spf1 include:_spf.google.com ~all
+ v=spf1 include:_spf.google.com include:amazonses.com ~all
```

### DNS Propagation Time

| Provider     | Typical Time | Max Time |
|--------------|--------------|----------|
| Cloudflare   | 2-5 minutes  | 10 min   |
| Namecheap    | 5-10 minutes | 30 min   |
| GoDaddy      | 10-30 minutes| 1 hour   |

---

## SSL/TLS Security

### ✅ Automatic Encryption

Resend uses **Amazon SES** infrastructure with:
- ✅ **TLS 1.2+** encryption (all emails in transit)
- ✅ **SPF/DKIM/DMARC** authentication
- ✅ **Automatic certificate management**

**You don't need to configure SSL manually!**

### How It Works

```
[Your Backend] --TLS--> [Resend API] --TLS--> [Amazon SES] --TLS--> [Recipient]
       ↑                     ↑                      ↑
    HTTPS            API Key Auth          DKIM Signature
```

1. **Transport Security (TLS)**:
   - All connections encrypted
   - Certificates auto-renewed
   - No configuration required

2. **Authentication (DKIM)**:
   - Resend signs emails with private key
   - Recipients verify with public key (DNS)
   - Proves email wasn't tampered with

3. **Policy (DMARC)**:
   - Tells recipients what to do if SPF/DKIM fails
   - `p=none`: Monitor only (recommended for new domains)
   - `p=quarantine`: Send to spam
   - `p=reject`: Block entirely

### Verify Email Security

Send a test email and check headers:

**Gmail:**
1. Open email → ⋮ → **Show original**
2. Look for:
   ```
   SPF: PASS
   DKIM: PASS
   DMARC: PASS
   ```

**Outlook:**
1. Open email → **View** → **Message Source**
2. Search for `Authentication-Results`

**Command line:**
```bash
# Check DKIM public key
dig TXT resend._domainkey.onchainclaw.com +short
```

---

## Testing

### Automated Test Script

Run the test script:

```bash
cd onchainclaw
node scripts/test-email.mjs your-email@example.com
```

Expected output:
```
🧪 Testing Resend Email Configuration

📧 From: OnChainClaw <noreply@onchainclaw.com>
📬 To: your-email@example.com
🔑 API Key: re_abc123...xyz

📤 Sending test email...

✅ Email sent successfully!

📊 Response data:
{
  "id": "d91c5a3f-1234-5678-abcd-123456789abc"
}

📬 Check your inbox at: your-email@example.com

🔍 View delivery status:
   → Resend Dashboard: https://resend.com/emails
   → Email ID: d91c5a3f-1234-5678-abcd-123456789abc
```

### Manual Test via API

```bash
# Test registration flow
curl -X POST https://onchainclaw.onrender.com/api/register/challenge \
  -H "Content-Type: application/json" \
  -d '{"wallet": "YOUR_SOLANA_WALLET"}'

# Complete registration (sign challenge, provide email)
# Email will be sent automatically
```

### Check Delivery

1. **Inbox**: Check your email
2. **Spam**: Check spam/junk folder (first emails might land here)
3. **Resend Dashboard**: **Logs** tab shows all sent emails
4. **Status codes**:
   - `delivered`: Success ✅
   - `bounced`: Invalid email ❌
   - `complained`: Marked as spam ⚠️

---

## Troubleshooting

### Issue 1: Email Not Sent

**Symptoms:**
- Backend logs: `Resend not configured, skipping email`

**Solution:**
```bash
# Check .env file
cat backend/.env | grep RESEND_API_KEY

# If missing, add it:
echo 'RESEND_API_KEY=re_your_key_here' >> backend/.env

# Restart backend
pnpm dev:backend
```

---

### Issue 2: Domain Not Verified

**Symptoms:**
- Resend dashboard shows ❌ "Not Verified"

**Solution:**
```bash
# 1. Check DNS propagation
dig TXT onchainclaw.com +short
dig MX onchainclaw.com +short
dig TXT _dmarc.onchainclaw.com +short

# 2. If empty, DNS not propagated yet (wait 10-30 min)
# 3. If showing old values, flush DNS cache:
#    - macOS: sudo dscacheutil -flushcache
#    - Windows: ipconfig /flushdns
#    - Linux: sudo systemd-resolve --flush-caches

# 4. Verify again in Resend dashboard
```

---

### Issue 3: Emails Go to Spam

**Symptoms:**
- Email delivered but in spam folder

**Solution:**
1. **Check SPF/DKIM/DMARC:**
   ```bash
   dig TXT onchainclaw.com +short  # Should show SPF
   dig TXT resend._domainkey.onchainclaw.com +short  # DKIM
   dig TXT _dmarc.onchainclaw.com +short  # DMARC
   ```

2. **Warm up your domain:**
   - First week: Send to 10-20 emails/day
   - Second week: 50-100 emails/day
   - Third week: Full volume
   - **Why?** New domains are untrusted

3. **Improve email content:**
   - ❌ Don't use: "Click here", "Act now", excessive CAPS
   - ✅ Use: Clear subject, personalized content, unsubscribe link

4. **Request whitelisting:**
   - Gmail: Have recipients mark as "Not spam"
   - Outlook: Add to safe senders list

---

### Issue 4: API Key Invalid

**Symptoms:**
- `401 Unauthorized` error from Resend

**Solution:**
```bash
# 1. Verify key format (should start with re_)
echo $RESEND_API_KEY

# 2. Regenerate key in Resend dashboard:
#    - API Keys → Delete old key
#    - Create new key
#    - Update .env

# 3. Restart backend
```

---

### Issue 5: Rate Limiting

**Symptoms:**
- `429 Too Many Requests` error

**Solution:**
```bash
# Free tier limits:
# - 3,000 emails/month
# - 100 emails/day (initially, increases with reputation)

# Check usage:
# Resend Dashboard → Usage tab

# Upgrade to paid plan if needed ($20/month for 50k emails)
```

---

## Production Checklist

Before launching:

- [ ] ✅ Domain verified in Resend
- [ ] ✅ All 3 DNS records added (TXT verification, MX, DMARC)
- [ ] ✅ SPF record includes `amazonses.com`
- [ ] ✅ API key added to production environment
- [ ] ✅ Test email sent successfully
- [ ] ✅ Email appears in inbox (not spam)
- [ ] ✅ SPF/DKIM/DMARC all show PASS in headers
- [ ] ✅ From address configured (`RESEND_FROM_EMAIL`)
- [ ] ✅ Bounce notifications monitored (Resend dashboard)
- [ ] ✅ Email templates reviewed for spam triggers
- [ ] ✅ Unsubscribe link added (future compliance)
- [ ] ✅ Rate limits understood (3k/month free tier)

---

## Resources

- **Resend Docs**: https://resend.com/docs
- **DNS Checker**: https://dnschecker.org
- **Email Header Analyzer**: https://mxtoolbox.com/EmailHeaders.aspx
- **Spam Test**: https://www.mail-tester.com
- **DMARC Guide**: https://dmarc.org/overview/

---

## Support

**Issues?**
- 📧 Email: support@onchainclaw.com
- 💬 Discord: https://discord.gg/onchainclaw
- 📖 Resend Support: https://resend.com/support

---

**Last Updated:** March 23, 2026
