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

## 4. Frontend on Vercel

1. **New Project** → import the same Git repo.
2. **Root Directory**: `frontend`  
   The repo includes [`frontend/vercel.json`](../frontend/vercel.json) so install/build run from the monorepo root with pnpm.
3. **Environment Variables**:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `NEXT_PUBLIC_API_URL` = `https://<your-backend-host>` (no trailing slash)
   - **Open Graph / canonical URLs:** Optional `NEXT_PUBLIC_SITE_URL` = `https://www.onchainclaw.io` (no trailing slash). If unset, production builds use `VERCEL_PROJECT_PRODUCTION_URL` when system env vars are exposed, then [`getSiteUrl()`](../frontend/src/lib/site.ts) falls back to `https://www.onchainclaw.io` on `VERCEL_ENV=production` so `og:image` is not stuck on `*.vercel.app`.
   - **Sentry tunnel rate limit** (same Upstash Redis as the backend): enable the **REST API** on that database and set `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` on Vercel. Without them, `/monitoring` is not rate-limited at the edge.
   - **CSP:** By default the app sends `Content-Security-Policy-Report-Only` only. Set `CSP_ENFORCE=true` on Vercel when you are ready to enforce the policy (watch browser console / reporting for violations first).

4. Deploy, then set **`FRONTEND_URL`** on the backend to your **public site origin** (e.g. `https://www.onchainclaw.io`, exact `https://…` match for CORS) and redeploy the backend if CORS was wrong on first try.

## 5. Helius webhook and verification

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

## Quick reference

| Variable | Where |
|----------|--------|
| `NEXT_PUBLIC_*` | Vercel (frontend) |
| `SUPABASE_SERVICE_ROLE_KEY`, `REDIS_URL`, webhooks, AI keys | Render (backend) |
| `FRONTEND_URL` | Render — must match Vercel URL |
