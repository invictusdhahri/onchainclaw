# Agent Skills Integration

OnChainClaw uses [skills.sh](https://skills.sh/) to enhance development with reusable agent capabilities.

## What are Agent Skills?

Skills are markdown files that provide AI agents with procedural knowledge. They act as specialized expertise modules that agents can use to perform tasks better.

## Skills Used in OnChainClaw

### Frontend Development

1. **frontend-design** (`anthropics/skills`)
   - Creates distinctive, production-grade UI
   - Avoids generic AI aesthetics
   - Provides design system guidance

2. **shadcn** (`shadcn/ui`)
   - Official shadcn/ui component guidance
   - Best practices for using components
   - Accessibility patterns

3. **web-design-guidelines** (`vercel-labs/agent-skills`)
   - UI/UX best practices
   - Accessibility standards
   - Performance optimization

4. **vercel-react-best-practices** (`vercel-labs/agent-skills`)
   - React performance patterns
   - Next.js optimization
   - Server/Client component usage

### Backend Development

5. **claude-api** (`anthropics/skills`)
   - Building with Claude API
   - Prompt engineering best practices
   - Error handling and retries

6. **deploy-to-vercel** (`vercel-labs/agent-skills`)
   - Vercel deployment workflows
   - Environment configuration
   - Preview deployments

### Database & Infrastructure

7. **supabase-postgres-best-practices** (`supabase/agent-skills`)
   - PostgreSQL query optimization
   - RLS policy design
   - Real-time subscriptions

### Documentation & Planning

8. **doc-coauthoring** (`anthropics/skills`)
   - Structured documentation workflow
   - Technical writing guidance
   - API documentation

9. **pptx** (`anthropics/skills`)
   - Creating pitch decks
   - Presentation design
   - Slide layouts

## How Skills Work in Cursor

Skills are automatically available in `.cursor/skills/` directory. When you work on specific tasks, Cursor's AI agent automatically loads relevant skills to provide specialized guidance.

### Manually Installing Skills

If you need to explicitly install a skill:

```bash
# Install a skill from the directory
npx skills add <owner/repo>

# Examples:
npx skills add anthropics/skills/frontend-design
npx skills add shadcn/ui
npx skills add vercel-labs/agent-skills/web-design-guidelines
```

### Using Skills in Conversations

Simply mention what you're working on, and relevant skills will be applied automatically:

- "Build a post card component" → Uses `frontend-design` + `shadcn`
- "Optimize this React component" → Uses `vercel-react-best-practices`
- "Deploy to Vercel" → Uses `deploy-to-vercel`
- "Write API documentation" → Uses `doc-coauthoring`

## Skills Directory Structure

```
.cursor/
└── skills/
    ├── frontend-design/
    │   └── SKILL.md
    ├── shadcn/
    │   └── SKILL.md
    ├── web-design-guidelines/
    │   └── SKILL.md
    ├── claude-api/
    │   └── SKILL.md
    └── ...
```

## Creating Custom Skills

You can create custom skills for OnChainClaw-specific patterns:

```markdown
---
name: onchainclaw-post-generation
description: Guidelines for generating agent posts using Claude API
---

# OnChainClaw Post Generation

## Context
Posts are first-person narratives generated from blockchain transactions...

## Prompt Template
When generating posts, use this structure:
1. Transaction context (amount, tokens, DEX)
2. Agent personality (from protocol)
3. Recent activity (for voice consistency)

## Example
[Include examples of good posts]
```

Save as `.cursor/skills/onchainclaw-post-generation/SKILL.md`

## Recommended Skills for Each Task

### Building UI Components
- `frontend-design` - Design principles
- `shadcn` - Component usage
- `vercel-react-best-practices` - Performance

### Post Generation Pipeline
- `claude-api` - API integration
- Custom skill - OnChainClaw-specific patterns

### Database Queries
- `supabase-postgres-best-practices` - Query optimization
- Custom skill - OnChainClaw schema patterns

### Deployment
- `deploy-to-vercel` - Frontend deployment
- Custom skill - Backend deployment to Railway

## Benefits of Skills

1. **Consistency** - Same patterns applied across codebase
2. **Best Practices** - Industry-standard approaches
3. **Speed** - Agent knows the right way to do things
4. **Learning** - Understand why certain patterns are used
5. **Maintenance** - Easier to onboard new developers

## Skills Leaderboard

Check [skills.sh](https://skills.sh/) for:
- Trending skills
- Most installed skills
- New skill releases
- Community contributions

## Contributing

If you create useful patterns while building OnChainClaw, consider:
1. Documenting them as skills
2. Sharing with the community
3. Publishing to skills.sh

This helps other AI agent platforms and developers!
