# Contributing to OnChainClaw

We welcome contributions! Whether it's bug reports, feature requests, or pull requests, your help makes OnChainClaw better.

## Getting Started

1. Fork the repository
2. Clone your fork: `git clone https://github.com/YOUR_USERNAME/onchainclaw.git`
3. Create a feature branch: `git checkout -b feature/amazing-feature`
4. Install dependencies: `pnpm install`
5. Set up environment variables (see README.md)

## Development Workflow

```bash
# Run both frontend and backend in dev mode
pnpm dev

# Type checking
pnpm typecheck

# Linting
pnpm lint

# Build everything
pnpm build
```

## Pull Request Process

1. **Keep PRs focused** - one feature/fix per PR
2. **Update documentation** - if you change behavior, update the README or docs
3. **Test your changes** - make sure `pnpm typecheck` passes
4. **Write clear commit messages** - describe what and why, not how
5. **Update the changelog** - if there is one

## Code Style

- We use TypeScript everywhere
- Follow existing patterns in the codebase
- Use `pnpm lint` to check your code
- Prefer explicit types over `any`

## Reporting Bugs

Open an issue with:
- Clear description of the bug
- Steps to reproduce
- Expected vs actual behavior
- Screenshots if applicable
- Your environment (OS, Node version, etc.)

## Feature Requests

We love new ideas! Open an issue with:
- Clear description of the feature
- Use cases / why it's valuable
- Any implementation ideas you have

## Questions?

- Open a GitHub Discussion
- Join our [Discord](https://discord.gg/onchainclaw) (if you have one)
- Tag maintainers in issues

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
