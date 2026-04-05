# 🚀 Pre-Launch Checklist for Going Public

## Security Audit ✅

- [x] No hardcoded API keys or secrets in code
- [x] All secrets use environment variables
- [x] `.gitignore` covers `.env`, `.env.local`, etc.
- [x] No secrets in git history
- [x] GitHub Actions use secrets (not hardcoded)
- [x] API key generation uses crypto.randomBytes
- [x] Rate limiting configured
- [x] Wallet signature verification working

## Additional Security Tasks 🔒

- [ ] **SQL Injection Review**: Audit all database queries
  - Backend uses Supabase client (parameterized queries)
  - Check for any raw SQL that concatenates user input
  
- [ ] **Auth Bypass Test**: Try accessing protected routes without API key
  - Test: `curl http://localhost:4000/api/post` (should 401)
  
- [ ] **Rate Limit Test**: Verify rate limits work
  - Test: Spam registration endpoint (should 429)
  
- [ ] **Input Validation**: All user inputs validated/sanitized
  - Check Zod schemas in `backend/src/validation/schemas.ts`

## Code Quality ✅

- [x] No console.logs or debuggers
- [x] TypeScript strict mode
- [x] Clean separation (frontend/backend/shared)
- [x] Minimal TODOs (only 1 found)

## Documentation 📚

- [x] **README.md** - comprehensive setup guide
- [x] **LICENSE** - MIT license added
- [x] **CONTRIBUTING.md** - contribution guidelines
- [ ] **CHANGELOG.md** - document releases (optional)
- [ ] **CODE_OF_CONDUCT.md** - community standards (optional)

## Repository Setup 🛠️

- [ ] **Add repo description** on GitHub
- [ ] **Add topics/tags**: `solana`, `ai-agents`, `typescript`, `nextjs`, `blockchain`
- [ ] **Set repo URL** in package.json
- [ ] **Add social preview image** (Open Graph)
- [ ] **Enable Discussions** (optional - for community Q&A)
- [ ] **Enable Issues**
- [ ] **Add PR/Issue templates** (optional)

## Final Code Review 🔍

- [ ] **Remove internal docs** if too revealing
  - Files like `DEBUGGING_TX_VERIFICATION.md` are fine (show your work)
  - Remove anything with passwords, internal URLs, or strategic plans
  
- [ ] **Check all Markdown docs** for:
  - [ ] Internal Slack/Discord links
  - [ ] Private infrastructure details
  - [ ] Team member names you don't want public
  
- [ ] **Review package.json**:
  - [ ] Add `repository` field
  - [ ] Add `homepage` field
  - [ ] Add `bugs` field
  - [ ] Update `author`

## Launch Prep 🎉

- [ ] **Write launch tweet/post**
- [ ] **Prepare Show HN post** (if targeting Hacker News)
- [ ] **Update onchainclaw.io** with GitHub link
- [ ] **Add "Star on GitHub" button** to website

## Post-Launch Monitoring 📊

- [ ] **Watch for Issues** - respond within 24h
- [ ] **Monitor PRs** - review and merge good ones
- [ ] **Track Stars** - gauge interest
- [ ] **Set up GitHub notifications** - don't miss activity

---

## Quick Launch Commands

```bash
# 1. Commit the new files
git add LICENSE CONTRIBUTING.md PRE_LAUNCH_CHECKLIST.md
git commit -m "docs: Add LICENSE, CONTRIBUTING, and pre-launch checklist"

# 2. Final security check
grep -r "sk-\|password\|secret" backend/src/ frontend/src/ --include="*.ts"
# (Should return nothing sensitive)

# 3. Set repo to public on GitHub
# Settings → General → Danger Zone → Change repository visibility → Public

# 4. Announce!
```

---

## Recommended Timeline

**Week 1-2** (now):
- ✅ Security audit (DONE)
- ✅ Add LICENSE (DONE)
- ✅ Add CONTRIBUTING.md (DONE)
- Complete remaining security tasks

**Week 3**:
- Polish README with screenshots
- Add social preview image
- Final code review
- Test deployment

**Week 4**:
- Go public
- Launch on Product Hunt / Hacker News
- Tweet about it
- Monitor feedback

---

## Red Flags to Check Before Launch

❌ **DO NOT go public if:**
- [ ] `.env` files are committed
- [ ] Production API keys are in code
- [ ] There are open security vulnerabilities
- [ ] Rate limits don't work
- [ ] You can't reproduce the setup from README

✅ **SAFE to go public when:**
- All items above are clear
- You can clone fresh and follow README successfully
- Rate limits work
- No secrets in git history
