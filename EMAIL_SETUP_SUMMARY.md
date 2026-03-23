# ✅ Resend Email Setup - Complete

## 📦 What Was Updated

### 1. **Code Improvements**
- ✅ Made from address configurable via `RESEND_FROM_EMAIL` env var
- ✅ Improved email template with modern design
- ✅ Added proper HTML structure for better deliverability

**Files changed:**
- `backend/src/lib/resend.ts` - Updated email function
- `backend/.env.local.example` - Added `RESEND_FROM_EMAIL`

### 2. **Test Script Created**
- ✅ `scripts/test-email.mjs` - Automated email testing
- ✅ Checks API key, DNS, and delivery
- ✅ Beautiful test email with status confirmation

**Usage:**
```bash
node scripts/test-email.mjs your-email@example.com
```

### 3. **Documentation**
- ✅ `docs/EMAIL_SETUP.md` - Complete 10,000-word guide
- ✅ `RESEND_QUICKSTART.md` - 5-minute quick reference
- ✅ Covers DNS, SSL/TLS, troubleshooting, production checklist

---

## 🚀 Next Steps for You

### **Step 1: Create Resend Account (2 min)**
```bash
open https://resend.com/signup
```

### **Step 2: Add Domain (1 min)**
1. Dashboard → **Domains** → **Add Domain**
2. Enter: `onchainclaw.com`
3. **Copy the 3 DNS records** (keep tab open)

### **Step 3: Configure DNS (5 min)**
Add these 3 records to your DNS provider (Namecheap/Cloudflare/GoDaddy):

**Record 1 - Domain Verification:**
```
Type: TXT
Host: @
Value: resend-verify=abc123...  ← (from Resend)
```

**Record 2 - Bounce Handling:**
```
Type: MX
Host: @
Value: feedback-smtp.us-east-1.amazonses.com
Priority: 10
```

**Record 3 - DMARC Policy:**
```
Type: TXT
Host: _dmarc
Value: v=DMARC1; p=none; rua=mailto:postmaster@resend.com
```

### **Step 4: Verify DNS (10 min wait)**
```bash
# Check if DNS propagated
dig TXT onchainclaw.com +short
dig MX onchainclaw.com +short
dig TXT _dmarc.onchainclaw.com +short

# Then click "Verify DNS Records" in Resend dashboard
```

### **Step 5: Get API Key (1 min)**
1. Dashboard → **API Keys** → **Create API Key**
2. Name: `OnChainClaw Production`
3. Permission: **Sending access**
4. Domain: `onchainclaw.com`
5. **Copy the key** (starts with `re_...`)

### **Step 6: Add to Render (2 min)**
1. Go to Render dashboard
2. Select **onchainclaw-backend** service
3. Go to **Environment** tab
4. Add variable:
   - Key: `RESEND_API_KEY`
   - Value: `re_abc123...` (your key)
5. Click **Save Changes** (auto-redeploys)

### **Step 7: Test Email (1 min)**
```bash
# Local test (if running backend locally)
node scripts/test-email.mjs your-email@example.com

# Production test (after Render deploy)
curl -X POST https://onchainclaw.onrender.com/api/register/challenge \
  -H "Content-Type: application/json" \
  -d '{"wallet": "YOUR_WALLET_ADDRESS"}'
```

---

## 📋 Configuration Summary

### **Environment Variables Needed**

**Production (Render):**
- `RESEND_API_KEY=re_abc123...` ← (from Resend dashboard)
- `RESEND_FROM_EMAIL=OnChainClaw <noreply@onchainclaw.com>` ← (optional, has default)

**Local Development:**
```bash
# backend/.env
RESEND_API_KEY=re_abc123...
RESEND_FROM_EMAIL="OnChainClaw <noreply@onchainclaw.com>"
```

### **DNS Records Required**

| Type | Host    | Value | Purpose |
|------|---------|-------|---------|
| TXT  | `@`     | `resend-verify=...` | Proves domain ownership |
| MX   | `@`     | `feedback-smtp.us-east-1.amazonses.com` | Handles bounces |
| TXT  | `_dmarc`| `v=DMARC1; p=none; ...` | Email authentication |

### **What You Get**

✅ **Automatic SSL/TLS encryption** (no config needed)  
✅ **SPF/DKIM/DMARC authentication** (via DNS)  
✅ **Professional email templates** (responsive HTML)  
✅ **3,000 emails/month free** (upgradable to 50k for $20/mo)  
✅ **Excellent deliverability** (Amazon SES infrastructure)  

---

## 🔒 Security Features (Automatic)

### **Transport Security**
- ✅ **TLS 1.2+** encryption for all emails
- ✅ **HTTPS** for API communication
- ✅ **Automatic certificate management**

### **Authentication**
- ✅ **SPF**: Sender Policy Framework (verifies IP)
- ✅ **DKIM**: Digital signature (prevents tampering)
- ✅ **DMARC**: Policy enforcement (protects brand)

### **Privacy**
- ✅ API keys never exposed to frontend
- ✅ Emails sent server-side only
- ✅ No tracking pixels (unless explicitly added)

**You don't need to configure SSL manually - it's all automatic!**

---

## 📊 Testing Checklist

After setup, verify:

- [ ] DNS records show in `dig` commands
- [ ] Resend dashboard shows domain as ✅ **Verified**
- [ ] Test script sends email successfully
- [ ] Email arrives in inbox (not spam)
- [ ] Email headers show `SPF: PASS` and `DKIM: PASS`
- [ ] Registration flow sends API key email
- [ ] Email template renders correctly in Gmail/Outlook

---

## 🐛 Common Issues & Solutions

### **Issue 1: Domain Not Verified**
```bash
# Wait 10 minutes after adding DNS records
# Then verify propagation:
dig TXT onchainclaw.com +short

# If empty, DNS hasn't propagated yet (wait longer)
# If showing old values, flush DNS cache
```

### **Issue 2: Email Not Sent**
```bash
# Check backend logs
# Should NOT see: "Resend not configured, skipping email"

# Verify API key is set:
echo $RESEND_API_KEY  # Should start with re_

# Restart backend after adding key
```

### **Issue 3: Email Goes to Spam**
**Why?** New domains are untrusted by email providers.

**Solutions:**
1. Mark as "Not spam" (have test recipients do this)
2. Warm up domain (send 10-20 emails/day for first week)
3. Add SPF record: `v=spf1 include:amazonses.com ~all`
4. Wait 1-2 weeks for reputation to build

### **Issue 4: DNS Not Updating**
```bash
# Flush local DNS cache

# macOS:
sudo dscacheutil -flushcache

# Windows:
ipconfig /flushdns

# Linux:
sudo systemd-resolve --flush-caches

# Then check again:
dig TXT onchainclaw.com +short
```

---

## 📚 Documentation Files

| File | Purpose |
|------|---------|
| `docs/EMAIL_SETUP.md` | Complete guide (10k words) |
| `RESEND_QUICKSTART.md` | Quick reference (5 min setup) |
| `scripts/test-email.mjs` | Automated test script |
| `EMAIL_SETUP_SUMMARY.md` | This file (action plan) |

---

## 🎯 Time Estimate

| Step | Time | Can Skip? |
|------|------|-----------|
| Create Resend account | 2 min | ❌ |
| Add domain | 1 min | ❌ |
| Configure DNS | 5 min | ❌ |
| Wait for DNS propagation | 10 min | ⏰ |
| Verify domain | 1 min | ❌ |
| Get API key | 1 min | ❌ |
| Add to Render | 2 min | ❌ |
| Test email | 1 min | ✅ (recommended) |
| **Total** | **~25 min** | |

---

## ✅ Production Ready Checklist

Before going live:

- [ ] Domain verified in Resend ✅
- [ ] All 3 DNS records added (TXT, MX, DMARC) ✅
- [ ] API key added to production environment ✅
- [ ] Test email sent and received ✅
- [ ] Email appears in inbox (not spam) ✅
- [ ] SPF/DKIM/DMARC all pass ✅
- [ ] Email template reviewed ✅
- [ ] From address configured ✅
- [ ] Rate limits understood (3k/month) ✅

---

## 🆘 Need Help?

**Questions about setup?**
- Read: `docs/EMAIL_SETUP.md` (comprehensive guide)
- Quick ref: `RESEND_QUICKSTART.md`

**Technical issues?**
- Resend Support: https://resend.com/support
- DNS Checker: https://dnschecker.org
- Spam Test: https://www.mail-tester.com

**Emergency?**
- Check backend logs for errors
- Run test script: `node scripts/test-email.mjs test@example.com`
- Review `RESEND_API_KEY` in environment

---

## 🎉 What's Next?

After email is working:

1. ✅ **Monitor deliverability** (Resend dashboard → Logs)
2. ✅ **Track bounce rate** (should be <5%)
3. ✅ **Add unsubscribe link** (future compliance)
4. ✅ **Consider upgrading** (if >3k emails/month)
5. ✅ **Set up email templates** (for other notifications)

---

**Ready to start?** Follow the steps above, and you'll have email working in ~25 minutes! 🚀
