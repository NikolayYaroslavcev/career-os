# CareerOS Technology Stack

## Overview

All technologies selected for replaceability, maturity, and ecosystem support. No vendor lock-in.

## Runtime & Language

| Technology | Version | Purpose | Rationale |
|------------|---------|---------|-----------|
| Node.js | 22+ | Runtime | LTS, native TypeScript, excellent ecosystem |
| TypeScript | 5.x | Language | Strict typing, compile-time safety, no `any` |

## Monorepo

| Technology | Version | Purpose | Rationale |
|------------|---------|---------|-----------|
| Turborepo | Latest | Monorepo management | Fast builds, caching, parallel execution |
| pnpm | 9+ | Package manager | Efficient, strict dependency resolution |

## Backend

| Technology | Version | Purpose | Rationale |
|------------|---------|---------|-----------|
| Fastify | 5.x | HTTP framework | Performance, schema validation, plugin system |

### Why Fastify over Express/NestJS

- 2x faster than Express
- Built-in JSON schema validation
- Plugin architecture for modularity
- Native TypeScript support
- Lower overhead than NestJS (no decorators, no DI container)

## Frontend

| Technology | Version | Purpose | Rationale |
|------------|---------|---------|-----------|
| Next.js | 15.x | React framework | App Router, RSC, SSR, API routes |
| React | 19.x | UI library | Server Components, concurrent features |
| Tailwind CSS | 4.x | Styling | Utility-first, no CSS-in-JS overhead |
| shadcn/ui | Latest | Component library | Copy-paste components, fully customizable |
| TanStack Query | 5.x | Server state | Caching, deduplication, optimistic updates |
| Zustand | 5.x | Client state | Lightweight, no boilerplate |
| React Hook Form | 7.x | Forms | Performance, validation integration |
| Zod | 3.x | Schema validation | TypeScript-first, runtime validation |

## Database

| Technology | Version | Purpose | Rationale |
|------------|---------|---------|-----------|
| PostgreSQL | 16 | Primary database | ACID, JSON support, full-text search |
| Prisma | 6.x | ORM | Type-safe queries, migrations, schema management |

### Prisma Constraints

- Prisma client only in infrastructure layer
- Domain layer uses repository interfaces
- Migrations version-controlled

## Queue & Cache

| Technology | Version | Purpose | Rationale |
|------------|---------|---------|-----------|
| Redis | 7.x | Cache + message broker | Speed, pub/sub, TTL support |
| BullMQ | 5.x | Job queue | Redis-based, reliable, retry logic |

## AI Providers

| Provider | Purpose | Integration |
|----------|---------|-------------|
| OpenAI | GPT-4, GPT-4o | REST API |
| Anthropic | Claude 3.5 | REST API |
| Google | Gemini Pro | REST API |
| OpenRouter | Multi-model | REST API |

### AI Abstraction

```typescript
interface AIProvider {
  analyzeVacancy(vacancy: Vacancy, profile: UserProfile): Promise<MatchResult>;
  generateResume(data: ResumeData, vacancy: Vacancy): Promise<string>;
  generateCoverLetter(data: ResumeData, vacancy: Vacancy): Promise<string>;
  generateInterviewQuestions(vacancy: Vacancy): Promise<Question[]>;
}
```

Changing providers requires only configuration, not code changes.

## Notification Providers

| Provider | Purpose | Integration |
|----------|---------|-------------|
| Telegram | Primary notifications | Bot API |
| Email | Digests, important updates | SMTP |
| Discord | Optional notifications | Webhooks |
| Slack | Optional notifications | Webhooks |

### Notification Abstraction

```typescript
interface NotificationProvider {
  send(userId: string, notification: Notification): Promise<void>;
  isAvailable(userId: string): Promise<boolean>;
}
```

## Authentication

| Technology | Purpose | Rationale |
|------------|---------|-----------|
| JWT | Access tokens | Stateless, fast validation |
| Refresh tokens | Session management | Long-lived sessions |
| bcrypt | Password hashing | Industry standard |

## Development Tools

| Technology | Purpose |
|------------|---------|
| ESLint | Code linting |
| Prettier | Code formatting |
| Vitest | Unit testing |
| Supertest | API testing |
| Husky | Git hooks |
| lint-staged | Pre-commit checks |

## Infrastructure

| Technology | Purpose | Rationale |
|------------|---------|-----------|
| Docker | Containerization | Consistent environments |
| Docker Compose | Local orchestration | Single command startup |
| GitHub Actions | CI/CD | Free for public repos |

## Container Architecture

```yaml
services:
  backend:     # Fastify API
  worker:      # BullMQ processors
  dashboard:   # Next.js
  postgres:    # Database
  redis:       # Cache + queues
  pgadmin:     # DB management (dev)
  mailpit:     # Email testing (dev, optional)
```

## Environment Variables

```bash
# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/careeros

# Redis
REDIS_URL=redis://localhost:6379

# AI
AI_PROVIDER=openai
# Optional — see ADR-025 for the full provider resilience layer
# (fallback chain, retry, health monitoring, concurrency limiting).
AI_MODEL=
AI_TIMEOUT_MS=
AI_FALLBACK_PROVIDERS=
AI_MAX_CONCURRENCY=
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
GEMINI_API_KEY=
OPENROUTER_API_KEY=

# Auth
JWT_SECRET=your-secret
JWT_EXPIRES_IN=15m

# Telegram
TELEGRAM_BOT_TOKEN=...
TELEGRAM_WEBHOOK_URL=...

# Email
SMTP_HOST=...
SMTP_PORT=587
SMTP_USER=...
SMTP_PASS=...
```

## Version Pinning

- All dependencies use exact versions in lockfile
- Node.js version pinned in `.nvmrc`
- Docker images use specific tags, not `latest`
