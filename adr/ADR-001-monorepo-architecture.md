# ADR-001: Monorepo Architecture

## Status

Accepted

## Date

2025-01-15

## Context

CareerOS consists of multiple applications (backend, worker, dashboard) and shared packages (career logic, AI, database, providers). We need a repository structure that supports:

- Shared code between applications
- Independent deployment of each application
- Clear package boundaries
- Efficient development workflow
- Code reuse without duplication

## Decision

We will use a monorepo structure with the following layout:

```
career-os/
├── apps/
│   ├── backend/          # Fastify API server
│   ├── worker/           # BullMQ background workers
│   └── dashboard/        # Next.js frontend
├── packages/
│   ├── ai/               # AI provider abstraction
│   ├── database/         # Prisma schema & repositories
│   ├── providers/        # Job source adapters
│   ├── notifications/    # Notification provider abstraction
│   ├── telegram/         # Telegram bot integration
│   ├── career/           # Career domain logic
│   ├── resume/           # Resume parsing & generation
│   ├── analytics/        # Career analytics
│   ├── interview/        # Interview preparation
│   ├── auth/             # Authentication
│   └── shared/           # Common types & utilities
├── docs/                 # Documentation
├── adr/                  # Architecture Decision Records
├── epics/                # Epic breakdown
└── tasks/                # Task breakdown
```

## Consequences

### Positive

- Code sharing without publishing private packages
- Atomic commits across related changes
- Single CI/CD pipeline
- Consistent tooling and configuration
- Easier refactoring across package boundaries
- Single `pnpm install` for all dependencies

### Negative

- Larger repository size
- Requires monorepo tooling (Turborepo)
- Tighter coupling between packages
- All packages version together

### Mitigations

- Use Turborepo for efficient builds and caching
- Enforce package boundaries via imports
- Use workspace protocol for internal dependencies
- Clear dependency graph between packages

## Alternatives Considered

### Multi-repo

Separate repositories for each package.

**Rejected because:**
- Complex dependency management
- Requires publishing private packages
- Harder to make cross-cutting changes
- More CI/CD configuration

### Polyrepo with shared libraries

Separate repos with shared libraries published to private registry.

**Rejected because:**
- Version management overhead
- Slower development cycle
- More complex setup

## References

- [Turborepo Documentation](https://turbo.build/repo)
- [pnpm Workspaces](https://pnpm.io/workspaces)
