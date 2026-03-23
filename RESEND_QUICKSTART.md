# Resend Email Setup - Quick Reference

## 🚀 5-Minute Setup

### 1️⃣ Create Account
```bash
open https://resend.com/signup
```

### 2️⃣ Add Domain
- Dashboard → **Domains** → **Add Domain**
- Enter: `onchainclaw.io`

### 3️⃣ Add DNS Records

Copy these **3 records** from Resend dashboard to your DNS provider:

| Type | Host    | Value                                  |
|------|---------|----------------------------------------|
| TXT  | `@`     | `resend-verify=abc123...`             |
| MX   | `@`     | `feedback-smtp.us-east-1.amazonses.com` (Priority: 10) |
| TXT  | `_dmarc`| `v=DMARC1; p=none; rua=mailto:postmaster@resend.com` |

### 4️⃣ Verify DNS (wait 5-10 min)
```bash
dig TXT onchainclaw.io +short
dig MX onchainclaw.io +short
dig TXT _dmarc.onchainclaw.io +short
```

Then click **Verify DNS Records** in Resend dashboard.

### 5️⃣ Get API Key
- Dashboard → **API Keys** → **Create API Key**
- Name: `onchainclaw.io production`
- Permission: **Sending access**
- Copy key (starts with `re_...`)

### 6️⃣ Add to Environment

**Local:**
```bash
# backend/.env
RESEND_API_KEY=re_abc123...
RESEND_FROM_EMAIL="onchainclaw.io <noreply@onchainclaw.io>"
```

**Production (Render):**
1. Dashboard → Service → **Environment**
2. Add `RESEND_API_KEY` and `RESEND_FROM_EMAIL`
3. Save (auto-redeploys)

### 7️⃣ Test
```bash
node scripts/test-email.mjs your-email@example.com
```

---

## 🔍 Quick Checks

### DNS Working?
```bash
dig TXT onchainclaw.io +short
# Should show: "resend-verify=abc123..."
```

### Email Sent?
```bash
# Resend Dashboard → Logs
# Status should be: "delivered" ✅
```

### Email in Inbox?
- Check main inbox
- Check spam folder (first emails)
- Look for: **"onchainclaw.io <noreply@onchainclaw.io>"**

---

## ⚡ Common Issues

| Issue | Solution |
|-------|----------|
| Domain not verified | Wait 10 min, then click "Verify" again |
| Email not sent | Check `RESEND_API_KEY` in `.env` |
| Email in spam | Normal for new domains. Mark as "Not spam" |
| DNS not updating | Flush cache: `sudo dscacheutil -flushcache` (macOS) |

---

## 📚 Full Documentation

See `docs/EMAIL_SETUP.md` for complete guide including:
- SSL/TLS details
- SPF/DKIM/DMARC configuration
- Troubleshooting guide
- Production checklist

---

## 🆘 Need Help?

- **Resend Support**: https://resend.com/support
- **DNS Checker**: https://dnschecker.org
- **Test Email**: `node scripts/test-email.mjs test@example.com`
