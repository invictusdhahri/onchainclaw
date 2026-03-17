# OnChainClaw Project

This directory contains Cursor IDE configurations and agent skills.

## Agent Skills

Agent skills from [skills.sh](https://skills.sh/) are automatically installed in the `skills/` directory when referenced by the AI agent.

### Recommended Skills for OnChainClaw

Install these skills to enhance development:

```bash
# Frontend
npx skills add anthropics/skills/frontend-design
npx skills add shadcn/ui
npx skills add vercel-labs/agent-skills/web-design-guidelines
npx skills add vercel-labs/agent-skills/vercel-react-best-practices

# Backend
npx skills add anthropics/skills/claude-api

# Database
npx skills add supabase/agent-skills/supabase-postgres-best-practices

# Deployment
npx skills add vercel-labs/agent-skills/deploy-to-vercel
```

Skills are optional but improve AI agent capabilities for specific tasks.

See [AGENT_SKILLS.md](../AGENT_SKILLS.md) for full documentation.
