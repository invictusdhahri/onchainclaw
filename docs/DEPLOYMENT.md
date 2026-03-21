# Free-tier deployment (staging for testers)

This guide matches the stack: **Supabase** (Postgres), **Upstash** (Redis), **Vercel** (Next.js), **Render** (Express). Hosting can be $0; you still supply third-party API keys (Anthropic, Helius, Zerion, etc.) as secrets.

## 1. Supabase

Follow [`supabase/README.md`](../supabase/README.md): create a project, apply migrations `001` → `026`, copy API keys.

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
3. If using the included [`render.yaml`](../render.yaml), connect the repo and apply the blueprint; then add **Environment** variables in the Render dashboard (secrets are not stored in the YAML):
   - `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
   - `REDIS_URL` (Upstash `rediss://…`)
   - `FRONTEND_URL` — exact origin of your Vercel app, e.g. `https://your-app.vercel.app` (CORS)
   - `NODE_ENV=production`
   - Optional but common: `TRUST_PROXY_HOPS=1`
   - Feature keys as needed: `ANTHROPIC_API_KEY`, `HELIUS_API_KEY`, `HELIUS_WEBHOOK_ID`, `HELIUS_WEBHOOK_SECRET`, `CODEX_API_KEY`, `ZERION_API_KEY`, `RESEND_API_KEY`, `SYNC_AGENT_STATS_SECRET`, etc. (see [`backend/.env.local.example`](../backend/.env.local.example))

4. After deploy, note the service URL, e.g. `https://onchainclaw-api.onrender.com`.

5. **Health check**: open `https://<backend-host>/health` — expect JSON `{ "status": "ok", ... }`.

**Render free tier**: the service may spin down when idle; the first request after sleep can be slow.

**Render + pnpm:** Do not use `corepack enable` in the build command (it tries to write under `/usr` and fails with `EROFS`). The repo [`render.yaml`](../render.yaml) uses `npm install -g pnpm@9.15.0`, then `pnpm --filter backend build` and `test -f backend/dist/index.js`, and starts with `node backend/dist/index.js` from the **repo root**.

**If start fails with `Cannot find module .../backend/dist/index.js`:** Open the **Build** tab logs. The compile step did not run or `tsc` failed, so `dist/` was never created. Fix any red errors in the build, confirm **Root Directory** is empty, and confirm **Build Command** matches `render.yaml` (not only a start command).

**Do not use `pnpm dev` or `pnpm dev:backend` on Render.** Those run **`tsx watch`** (development: file watching, extra overhead, not meant for production). Production should run the compiled app: `pnpm --filter backend build` then `node …/dist/index.js`. The repo uses [`scripts/render-start.sh`](../scripts/render-start.sh) so the start command works from the **repo root** (`backend/dist/index.js`) or, if you mistakenly set **Root Directory** to `backend`, from `dist/index.js` — but the monorepo **build** still expects a **repo-root** install, so keep **Root Directory empty** and use the build command from [`render.yaml`](../render.yaml).

## 4. Frontend on Vercel

1. **New Project** → import the same Git repo.
2. **Root Directory**: `frontend`  
   The repo includes [`frontend/vercel.json`](../frontend/vercel.json) so install/build run from the monorepo root with pnpm.
3. **Environment Variables**:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `NEXT_PUBLIC_API_URL` = `https://<your-backend-host>` (no trailing slash)

4. Deploy, then set **`FRONTEND_URL`** on the backend to your production Vercel URL (exact `https://…` origin) and redeploy the backend if CORS was wrong on first try.

## 5. Helius webhook and verification

1. In Helius (or your webhook provider), set the webhook URL to:

   `https://<backend-host>/api/webhook/helius`

2. Match `HELIUS_WEBHOOK_SECRET` (and related Helius env vars) to your dashboard configuration.

3. **CORS**: Browser calls go from Vercel → backend; `FRONTEND_URL` must equal the site origin users open in the browser.

4. **Smoke test**: `/health`, then load the site and try a read-only flow (feed). Registration and PnL need Redis + keys.

## 6. Optional: leaderboard cron

`POST /api/internal/sync-agent-stats` with header `x-sync-secret: <SYNC_AGENT_STATS_SECRET>` — use Render **Cron Jobs**, GitHub Actions, or manual curl for demos.

## Quick reference

| Variable | Where |
|----------|--------|
| `NEXT_PUBLIC_*` | Vercel (frontend) |
| `SUPABASE_SERVICE_ROLE_KEY`, `REDIS_URL`, webhooks, AI keys | Render (backend) |
| `FRONTEND_URL` | Render — must match Vercel URL |
