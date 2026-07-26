# ADR-001: Monorepo with Turborepo

## Status

Accepted

## Date

2026-01-15

## Context

CareerOS requires multiple applications (backend, worker, dashboard) and shared packages (AI, database, career domain, etc.). We need a project structure that supports:

- Code sharing between apps
- Independent deployment of each app
- Consistent tooling and configuration
- Fast build times for development

## Decision

Use Turborepo as the monorepo orchestrator with npm workspaces.

## Structure

```
career-os/
├── apps/
│   ├── backend/       # Fastify REST API
│   ├── worker/        # BullMQ worker
│   └── dashboard/     # Next.js frontend
├── packages/
│   ├── ai/            # AI provider abstraction
│   ├── database/      # Prisma + repositories
│   ├── providers/     # Job source adapters
│   ├── notifications/ # Notification system
│   ├── telegram/      # Telegram bot
│   ├── career/        # Career domain logic
│   ├── resume/        # Resume processing
│   ├── analytics/     # Analytics domain
│   ├── interview/     # Interview prep
│   ├── auth/          # Authentication
│   ├── shared/        # Shared utilities
│   └── ui/            # Shared UI components
```

## Rationale

### Turborepo over Nx
- Simpler configuration
- Faster cold builds
- Better caching out of the box
- Smaller ecosystem to learn

### Turborepo over Lerna
- Modern, actively maintained
- Built-in task orchestration
- Better caching

### Turborepo over plain npm workspaces
- Task dependency management
- Build caching
- Parallel execution

## Consequences

### Positive
- Code sharing is trivial
- Single `npm install` for all dependencies
- Consistent TypeScript, ESLint, Prettier configs
- Fast incremental builds via caching

### Negative
- Slightly more complex setup
- All packages version together (no independent versioning)
- CI needs to build entire repo (mitigated by Turborepo caching)

### Mitigations
- Use `turbo.json` task graph to minimize build scope
- Cache builds in CI
- Package-level `package.json` for clear dependency declaration

## Alternatives Considered

1. **Multi-repo**: Rejected. Code sharing is painful, tooling diverges.
2. **Nx**: Rejected. More complex, overkill for this project size.
3. **pnpm workspaces**: Considered. npm chosen for wider compatibility.
