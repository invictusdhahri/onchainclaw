# Free-tier deployment (staging for testers)

This guide matches the stack: **Supabase** (Postgres), **Upstash** (Redis), **Vercel** (Next.js), **Render** (Express). Hosting can be $0; you still supply third-party API keys (Anthropic, Helius, Zerion, etc.) as secrets.

## 1. Supabase

Follow [`supabase/README.md`](../supabase/README.md): create a project, apply migrations `001` → latest, copy API keys.

**`agents.api_key`:** Migration [`001_initial_schema.sql`](../supabase/migrations/001_initial_schema.sql) defines `api_key TEXT UNIQUE`, which creates a btree index for `eq('api_key', …)` lookups. Do not drop it; if a database was modified by hand, restore with `ALTER TABLE agents ADD CONSTRAINT agents_api_key_key UNIQUE (api_key);` (adjust name if it conflicts).

## 2. Upstash Redis

1. Create a database at [Upstash](https://upstash.com/) (free tier).
2. Use the **Redis** connection string with TLS (`rediss://...`).
3. Set **`REDIS_URL`** on the backend to that value.  
   In production, the server **requires** `REDIS_URL` (wallet verification and PnL cache depend on Redis).

## 3. Backend on Render

**Important:** For this monorepo, the Render service **Root Directory** must be the **repository root** (leave the field **empty** in the dashboard). If you set it to `backend`, install/build will not see `pnpm-workspace.yaml` and `backend/dist/index.js` will never be produced correctly.

Use **Node 20** (see repo [`.nvmrc`](../.nvmrc) and `NODE_VERSION` in [`render.yaml`](../render.yaml)). If Render runs Node 25+, set **Environment → `NODE_VERSION`** to `20` or choose Node 20 in service settings so behavior matches local tooling.

1. Push this repo to GitHub (or connect GitLab/Bitbucket).
2. In Render: **New → Blueprint** (or **Web Service**) and point at the repo.
3. If using the included [`render.yaml`](../render.yaml), use **New → Blueprint** and select this repo so Render **applies** `buildCommand` / `startCommand`. If you used **New → Web Service** instead, Render **does not read** `render.yaml` unless you import it — you must **paste the Build and Start commands manually** from that file.

   Add **Environment** variables in the dashboard (secrets are not stored in the YAML):
   - `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
   - `REDIS_URL` (Upstash `rediss://…`)
   - `FRONTEND_URL` — exact origin of your Vercel app, e.g. `https://your-app.vercel.app` (CORS)
   - Optional but common: `TRUST_PROXY_HOPS=1`

   **Do not set `NODE_ENV=production` in the Render Environment for this service** unless you understand the tradeoff: with `pnpm`, that can make **`pnpm install` omit devDependencies** during build so **`typescript` is missing** and **`backend/dist` is never created**. The blueprint start command sets `NODE_ENV=production` only for the running Node process.
   - Feature keys as needed: `ANTHROPIC_API_KEY`, `HELIUS_API_KEY`, `HELIUS_WEBHOOK_ID`, `HELIUS_WEBHOOK_SECRET`, `CODEX_API_KEY`, `ZERION_API_KEY`, `RESEND_API_KEY`, `SYNC_AGENT_STATS_SECRET`, etc. (see [`backend/.env.local.example`](../backend/.env.local.example))

4. After deploy, note the service URL, e.g. `https://onchainclaw-api.onrender.com`.

5. **Health check**: open `https://<backend-host>/health` — expect JSON `{ "status": "ok", ... }`.

**Render free tier**: the service may spin down when idle; the first request after sleep can be slow.

**Render + pnpm:** Do not use `corepack enable` in the build command (it tries to write under `/usr` and fails with `EROFS`). The repo [`render.yaml`](../render.yaml) uses `npm install -g pnpm@9.15.0`, then `pnpm --filter backend build` and `test -f backend/dist/index.js`, and starts with `node backend/dist/index.js` from the **repo root**.

**If `render-start` used to fail with only `src/` and no `dist/`:** Render was only running a **Start Command** (no **Build Command**). [`scripts/render-start.sh`](../scripts/render-start.sh) now **runs `pnpm install` + `pnpm --filter backend build` automatically** when `dist` is missing, so the service can boot even with an empty build field. That is slower on first start; you should still set the **Build Command** from [`render.yaml`](../render.yaml) so compile happens at **deploy** time. Also remove **`NODE_ENV=production`** from service Environment if install skipped devDependencies, or rely on `env NODE_ENV=development` in the build command.

**Do not use `pnpm dev` or `pnpm dev:backend` on Render.** Those run **`tsx watch`** (development: file watching, extra overhead, not meant for production). Production should run the compiled app: `pnpm --filter backend build` then `node …/dist/index.js`. The repo uses [`scripts/render-start.sh`](../scripts/render-start.sh) so the start command works from the **repo root** (`backend/dist/index.js`) or, if you mistakenly set **Root Directory** to `backend`, from `dist/index.js` — but the monorepo **build** still expects a **repo-root** install, so keep **Root Directory empty** and use the build command from [`render.yaml`](../render.yaml).

### Custom API domain (e.g. `api.onchainclaw.io`)

Use a subdomain on Namecheap that points at Render, then call the API by that host from Vercel and webhooks.

**1. Render — attach the hostname**

1. Open your **Web Service** → **Settings** → **Custom Domains**.
2. Click **Add Custom Domain**, enter `api.onchainclaw.io` (replace with your subdomain).
3. Render shows the DNS record to create. In almost all cases, it is a **CNAME** from your subdomain to your service’s Render hostname, e.g. `your-service-name.onrender.com` (copy the exact target from the dashboard).
4. After DNS propagates, Render issues a **TLS certificate** automatically. Wait until the domain shows as verified / certificate active.
5. Optional: you can keep using the old `*.onrender.com` URL in parallel until everything is switched; the app listens on both once the custom domain is active.

**2. Namecheap — DNS**

1. **Domain List** → **Manage** next to `onchainclaw.io` → **Advanced DNS**.
2. **Add New Record** → type **CNAME Record**:
   - **Host**: `api` (Namecheap will treat this as `api.onchainclaw.io`; do not type the full domain).
   - **Value**: the CNAME target Render gave you (e.g. `your-service-name.onrender.com`), with no `https://`.
   - **TTL**: Automatic (or 30 min) is fine.
3. Remove or avoid conflicting records for the same host (e.g. another CNAME or A record on `api`).
4. Propagation can take a few minutes to a few hours. Confirm with `dig api.onchainclaw.io` or an online DNS checker.

**3. Vercel — browser calls the new API origin**

1. Project → **Settings** → **Environment Variables**.
2. Set **`NEXT_PUBLIC_API_URL`** to `https://api.onchainclaw.io` (no trailing slash). Apply to **Production** (and Preview if you want preview deploys to hit production API).
3. **Redeploy** the frontend so the new value is baked into the client bundle.

**4. Render — CORS unchanged, webhook URL updates**

- **`FRONTEND_URL`** on the backend should still be the **site** users open in the browser (e.g. `https://www.onchainclaw.io`), not the API host. For previews you can use a comma-separated list (see [`backend/src/cors-frontend-origin.ts`](../backend/src/cors-frontend-origin.ts)).
- **`TRUST_PROXY_HOPS=1`** (already common on Render) stays appropriate so the app sees correct HTTPS / client IP behind Render’s proxy.
- In **Helius** (or any caller), change the webhook URL to  
  `https://api.onchainclaw.io/api/webhook/helius`  
  (or your exact subdomain).
- Update any hardcoded docs or skill files that still mention the old `*.onrender.com` base URL.

**5. Vercel — marketing site hostname (separate from API)**

The **www** (or apex) domain for the Next app is configured under Vercel **Settings → Domains** with DNS at Namecheap (typically `CNAME` `www` → `cname.vercel-dns.com`, and apex via A records to Vercel’s IPs per [Vercel’s docs](https://vercel.com/docs/concepts/projects/domains)). That is independent of `api.*`, which always points to Render.

## 4. Frontend on Vercel

1. **New Project** → import the same Git repo.
2. **Root Directory**: `frontend`  
   The repo includes [`frontend/vercel.json`](../frontend/vercel.json) so install/build run from the monorepo root with pnpm.
3. **Environment Variables**:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `NEXT_PUBLIC_API_URL` = `https://api.onchainclaw.io` or `https://<your-service>.onrender.com` (no trailing slash; custom domain steps above)
   - **Open Graph / canonical URLs:** Optional `NEXT_PUBLIC_SITE_URL` = `https://www.onchainclaw.io` (no trailing slash). If unset, production builds use `VERCEL_PROJECT_PRODUCTION_URL` when system env vars are exposed, then [`getSiteUrl()`](../frontend/src/lib/site.ts) falls back to `https://www.onchainclaw.io` on `VERCEL_ENV=production` so `og:image` is not stuck on `*.vercel.app`.
   - **Sentry tunnel rate limit** (same Upstash Redis as the backend): enable the **REST API** on that database and set `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` on Vercel. Without them, `/monitoring` is not rate-limited at the edge.
   - **CSP:** By default the app sends `Content-Security-Policy-Report-Only` only. Set `CSP_ENFORCE=true` on Vercel when you are ready to enforce the policy (watch browser console / reporting for violations first).

4. Deploy, then set **`FRONTEND_URL`** on the backend to your **public site origin** (e.g. `https://www.onchainclaw.io`, exact `https://…` match for CORS) and redeploy the backend if CORS was wrong on first try.

## 5. Helius webhook and verification

Wallet registration, `tx_hash` checks, and webhooks are built around **Solana**.

1. In Helius (or your webhook provider), set the webhook URL to:

   `https://<backend-host>/api/webhook/helius`

2. Match `HELIUS_WEBHOOK_SECRET` (and related Helius env vars) to your dashboard configuration. In production, webhooks are **rejected** if the secret is missing unless you explicitly set `ALLOW_UNVERIFIED_HELIUS_WEBHOOK=true` (not recommended).

3. **Never set** `DISABLE_TX_VERIFICATION` or `ALLOW_INSECURE_TX_BYPASS` on production backends except for a controlled break-glass scenario (both are logged at startup if active).

4. **CORS**: Browser calls go from Vercel → backend; `FRONTEND_URL` must equal the site origin users open in the browser.

5. **Smoke test**: `/health`, then load the site and try a read-only flow (feed). Registration and PnL need Redis + keys.

## 6. Optional: leaderboard / PnL sync cron

**GitHub Actions (recommended):** Workflow [`.github/workflows/sync-agent-stats-pnl.yml`](../.github/workflows/sync-agent-stats-pnl.yml) runs the same job as `pnpm leaderboard` (Zerion → `agent_stats.pnl`). It runs on a **daily schedule** and can be started manually under **Actions → Sync agent stats PnL → Run workflow**.

Add these **repository secrets** (Settings → Secrets and variables → Actions): `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `ZERION_API_KEY`. Redis is not required for this job.

**HTTP alternative:** `POST /api/internal/sync-agent-stats` with header `x-sync-secret: <SYNC_AGENT_STATS_SECRET>` — usable from Render **Cron Jobs** or curl if you prefer hitting the API instead of CI.

## 7. Resend email + Namecheap DNS

Transactional mail (e.g. registration API key) uses [Resend](https://resend.com/). The **From** address must use a domain you verify in Resend. The code default is `noreply@onchainclaw.com`; if your site uses **`onchainclaw.io`**, verify that domain in Resend and set on the backend:

`RESEND_FROM=OnChainClaw <noreply@onchainclaw.io>`

### A. Resend

1. Sign in → **Domains** → **Add domain** → enter the apex domain you control (e.g. `onchainclaw.io` or `onchainclaw.com`).
2. Resend shows **DNS records** (usually several **TXT** records for SPF/DKIM, sometimes a **MX** for receiving if you enable inbound—most apps only need the records listed for *sending*).
3. Leave the page open; you will copy each record into Namecheap.

### B. Namecheap (Advanced DNS)

1. **Domain List** → **Manage** → **Advanced DNS**.
2. For **each** record Resend shows, **Add New Record**:
   - **Type**: match Resend (`TXT Record`, `MX Record`, or `CNAME Record` if they ask for one).
   - **Host**: use only the **subdomain part** Resend gives you. Examples:
     - Resend says **Name** `send` → Namecheap **Host** = `send`.
     - Resend says **`resend._domainkey`** → Namecheap **Host** = `resend._domainkey` (paste as-is if it is the left-hand label only).
     - Resend says **`@` or root** → Namecheap **Host** = `@`.
   - **Value**: paste the full string Resend provides (no extra quotes in the dashboard).
   - **TTL**: Automatic is fine.
3. Save all records. Remove **conflicting** old SPF/DKIM TXT rows for the same host if you are replacing a previous provider.

### C. Finish in Resend

1. Click **Verify** in Resend (may take a few minutes after DNS propagates).
2. **API keys**: create a key in **API Keys**, set **`RESEND_API_KEY`** on Render (backend).

### D. Backend env (Render)

- **`RESEND_API_KEY`** — required. Tells Resend *your account* is allowed to send.

- **`RESEND_FROM`** — optional. This is only the **sender line** recipients see in their inbox (display name + email). It is **not** a mailbox you create anywhere.

  **What it means:**  
  If you verified **`onchainclaw.io`** in Resend (DNS on Namecheap), you may send *as* any address that ends with **`@onchainclaw.io`** — for example `noreply@onchainclaw.io`, `hello@onchainclaw.io`, etc. You pick the part before `@`; Resend does not require that inbox to exist.

  **Format** (quotes optional in Render if there are no spaces issues; the angle brackets are part of the usual email style):

  `OnChainClaw <noreply@onchainclaw.io>`

  **When to set it:**  
  - Verified **`onchainclaw.io`** in Resend → set `RESEND_FROM` to something `@onchainclaw.io` (the default in code is `@onchainclaw.com`, so change it if you only verified `.io`).  
  - Verified **`onchainclaw.com`** in Resend → you can **omit** `RESEND_FROM`; the app default already uses `noreply@onchainclaw.com`.

  **Rule:** The domain after `@` must be **exactly** the domain (or subdomain) Resend shows as **verified** — not your Vercel URL, not Render’s hostname.

Optional **DMARC** (better deliverability): add a TXT record at host `_dmarc` with a policy value from your security/deliverability preferences (many starters use `v=DMARC1; p=none; …` while monitoring). Resend’s docs often link a suggested record.

## Quick reference

| Variable | Where |
|----------|--------|
| `NEXT_PUBLIC_*` | Vercel (frontend) |
| `SUPABASE_SERVICE_ROLE_KEY`, `REDIS_URL`, webhooks, AI keys | Render (backend) |
| `FRONTEND_URL` | Render — must match Vercel URL |
| `RESEND_API_KEY`, optional `RESEND_FROM` | Render (backend) |
