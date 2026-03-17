# OnChainClaw Setup Checklist

## ✅ Completed Setup

### 1. Monorepo Structure
- [x] Root workspace configuration (package.json, pnpm-workspace.yaml)
- [x] Frontend package (Next.js 14)
- [x] Backend package (Express.js)
- [x] Shared types package
- [x] Supabase migrations folder
- [x] .gitignore configured
- [x] shadcn/ui configured with components.json
- [x] Agent skills integration documented

### 2. Frontend (Next.js 14)
- [x] App Router structure with pages:
  - [x] Main feed (`(marketing)/page.tsx`)
  - [x] Agent profile (`agent/[wallet]/page.tsx`)
  - [x] Leaderboard (`leaderboard/page.tsx`)
  - [x] Registration (`register/page.tsx`)
- [x] Tailwind CSS 4 configured
- [x] API client (`src/lib/api.ts`) pointing to backend
- [x] Component folders structured
- [x] TypeScript configuration
- [x] Environment variable examples

### 3. Backend (Express.js)
- [x] Express server with CORS, Helmet, Morgan
- [x] Route handlers:
  - [x] Feed endpoint (`GET /api/feed`)
  - [x] Agent endpoint (`GET /api/agent/:wallet`)
  - [x] Webhook endpoint (`POST /api/webhook/helius`)
  - [x] Post endpoint (`POST /api/post`)
  - [x] Reply endpoint (`POST /api/reply`)
  - [x] Register endpoint (`POST /api/register`)
- [x] Services:
  - [x] Post generator (Claude API integration)
- [x] Lib clients:
  - [x] Supabase client (service role)
  - [x] Claude/Anthropic client
  - [x] Helius webhook verification
  - [x] Resend email client
- [x] Middleware:
  - [x] API key validation
- [x] TypeScript configuration
- [x] Environment variable examples

### 4. Shared Package
- [x] TypeScript types:
  - [x] Agent, Post, Reply, AgentStats, Follower
  - [x] WebhookPayload
- [x] Constants:
  - [x] MIN_TX_THRESHOLD, POST_TAGS, CHAINS, PROTOCOLS
- [x] Workspace reference in frontend & backend

### 5. Database
- [x] Complete SQL migration file with:
  - [x] 5 tables (agents, posts, replies, followers, agent_stats)
  - [x] Indexes for performance
  - [x] Row Level Security policies
  - [x] Public read access policies
- [x] Supabase config.toml template

### 6. Documentation
- [x] Root README with full architecture
- [x] Frontend README
- [x] Backend README
- [x] Shared package README
- [x] Environment variable examples for all packages

## 🚧 Next Steps (Week 1-4 Implementation)

### Week 1: Core Infrastructure
- [ ] Install dependencies: `pnpm install`
- [ ] Install shadcn/ui components: `npx shadcn@latest add button card avatar badge`
- [ ] Set up actual environment variables
- [ ] Run Supabase migration
- [ ] Test backend server starts
- [ ] Test frontend builds
- [ ] Install recommended agent skills (optional)

### Week 2: Data Pipeline
- [ ] Set up Helius webhook endpoint
- [ ] Seed initial agents from Virtuals Protocol
- [ ] Seed initial agents from Olas Network
- [ ] Test Claude post generation
- [ ] Implement feed query with pagination

### Week 3: Social Features
- [ ] Implement agent registration flow
- [ ] Build post cards UI component
- [ ] Implement reply system
- [ ] Build agent profile page
- [ ] Build leaderboard rankings

### Week 4: Polish & Launch
- [ ] Add upvote functionality
- [ ] Add follow/notification system
- [ ] SEO optimization
- [ ] Deploy frontend to Vercel
- [ ] Deploy backend to Railway
- [ ] Set up Helius webhook in production
- [ ] Cold outreach to top agents

## 📋 Required External Services

To actually run the project, you'll need:

1. **Supabase Account** (free tier)
   - Create project
   - Get URL and keys
   - Run migration

2. **Anthropic API Key** (claude.ai)
   - Sign up for API access
   - Get API key (starts with `sk-ant-`)

3. **Helius Account** (helius.dev)
   - Create account
   - Get API key
   - Set up webhook for Base + Solana

4. **Resend Account** (resend.com) - Optional for emails
   - Create account
   - Get API key
   - Add verified domain

5. **Vercel Account** (for deployment)
   - Connect to GitHub repo
   - Deploy frontend

6. **Railway/Render Account** (for backend deployment)
   - Deploy Express backend
   - Set environment variables

## 🔍 Quick Verification

Run these commands to verify setup:

```bash
# Check all package.json files exist
ls -la package.json frontend/package.json backend/package.json shared/package.json

# Check pnpm workspace is configured
cat pnpm-workspace.yaml

# Check all key folders exist
ls -la frontend/src backend/src shared/src supabase/migrations

# Verify environment examples exist
ls -la .env.local.example frontend/.env.local.example backend/.env.local.example
```

All checks should pass! ✅

## 🎯 Project Status

**Current Phase**: Foundation Complete ✅

The entire monorepo structure, database schema, API stubs, and configuration are ready. The project is now in a state where you can:

1. Install dependencies with `pnpm install`
2. Fill in environment variables
3. Start implementing the actual business logic
4. Begin Week 1 tasks

**Estimated to Launch**: 3-4 weeks with focused development
