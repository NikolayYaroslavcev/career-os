# CareerOS System Architecture

## Overview

CareerOS follows Clean Architecture with four distinct layers. Dependencies point inward. Infrastructure is replaceable. Domain is the core.

```
┌─────────────────────────────────────────────────────────┐
│                   Presentation Layer                      │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │   Dashboard   │  │ Telegram Bot │  │  REST API    │  │
│  │   (Next.js)   │  │  (Bot API)   │  │  (Fastify)   │  │
│  └──────────────┘  └──────────────┘  └──────────────┘  │
├─────────────────────────────────────────────────────────┤
│                   Application Layer                      │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │  Use Cases   │  │  Services    │  │  Orchestrators│  │
│  └──────────────┘  └──────────────┘  └──────────────┘  │
├─────────────────────────────────────────────────────────┤
│                     Domain Layer                         │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐  │
│  │ Entities │ │  Value   │ │ Repository│ │  Domain  │  │
│  │          │ │ Objects  │ │ Interfaces│ │  Events  │  │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘  │
├─────────────────────────────────────────────────────────┤
│                 Infrastructure Layer                      │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐  │
│  │ Database │ │  AI      │ │Providers │ │Notificat.│  │
│  │ (Prisma) │ │(OpenAI)  │ │(HH,LI)   │ │(Telegram)│  │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘  │
└─────────────────────────────────────────────────────────┘
```

## Layer Rules

### Domain Layer
- Contains business entities, value objects, repository interfaces
- **No dependencies** on any other layer
- Pure TypeScript, no framework imports
- Located in feature packages: `packages/career`, `packages/resume`, `packages/analytics`, `packages/interview`

### Application Layer
- Contains use cases, services, orchestrators
- Depends on Domain layer only
- Coordinates between domain entities
- Handles transaction boundaries
- Located in feature packages alongside domain

### Infrastructure Layer
- Implements repository interfaces from Domain
- Contains database access, external API calls, queue integration
- All Prisma usage confined here
- Located in: `packages/database`, `packages/ai`, `packages/providers`, `packages/notifications`, `packages/telegram`

### Presentation Layer
- Contains API routes, UI components, bot handlers
- Depends on Application layer
- No business logic allowed
- Located in: `apps/backend`, `apps/dashboard`, `apps/worker`

## Monorepo Structure

```
career-os/
├── apps/
│   ├── backend/           # Fastify REST API server
│   ├── worker/            # BullMQ background worker
│   └── dashboard/         # Next.js frontend
├── packages/
│   ├── ai/                # AI provider abstraction
│   ├── database/          # Prisma schema + repositories
│   ├── providers/         # Job source adapters (HH, LinkedIn, Habr)
│   ├── notifications/     # Notification provider abstraction
│   ├── telegram/          # Telegram bot integration
│   ├── career/            # Career domain: applications, CRM, follow-ups
│   ├── resume/            # Resume parsing and generation
│   ├── analytics/         # Career analytics domain
│   ├── interview/         # Interview preparation domain
│   ├── auth/              # Authentication domain
│   ├── shared/            # Shared types, utilities, constants
│   └── ui/                # Shared UI components (shadcn/ui)
├── docs/
│   ├── product/
│   ├── architecture/
│   ├── adr/
│   ├── epics/
│   └── coding-standards/
├── docker-compose.yml
├── turbo.json
├── package.json
├── tsconfig.json
└── .env.example
```

## Service Boundaries

### Backend API (Fastify)
```
apps/backend/
├── src/
│   ├── routes/            # Route handlers (thin controllers)
│   ├── middleware/         # Auth, validation, error handling
│   ├── plugins/           # Fastify plugins
│   ├── config/            # Configuration management
│   └── server.ts          # Server bootstrap
```

**Responsibilities:**
- HTTP request/response handling
- Input validation (Zod)
- Authentication/authorization
- Delegates to application services

### Worker (BullMQ)
```
apps/worker/
├── src/
│   ├── jobs/              # Job processors
│   ├── queues/            # Queue definitions
│   ├── scheduler/         # Cron-like scheduling
│   └── worker.ts          # Worker bootstrap
```

**Responsibilities:**
- Background job processing
- Scheduled tasks (job aggregation, follow-up checks)
- Email/notification sending
- AI processing (matching, resume generation)

### Dashboard (Next.js)
```
apps/dashboard/
├── src/
│   ├── app/               # App Router pages
│   ├── components/        # React components
│   ├── hooks/             # Custom hooks
│   ├── lib/               # Utilities, API clients
│   └── stores/            # Zustand stores
```

**Responsibilities:**
- User interface
- API consumption via TanStack Query
- Client-side state management
- No business logic

## Data Flow: Job Discovery

```
┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐
│ Provider │───>│Normalize │───>│ Dedup    │───>│ Persist  │
│ Adapter  │    │ (Domain) │    │ (Domain) │    │ (Infra)  │
└──────────┘    └──────────┘    └──────────┘    └──────────┘
                                                       │
                                                       v
┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐
│ Notify   │<──│ Rank     │<──│ AI Match │<──│ Fetch    │
│ User     │    │ (Domain) │    │ (AI Pkg) │    │ (Infra)  │
└──────────┘    └──────────┘    └──────────┘    └──────────┘
```

**Flow:**
1. Worker triggers job aggregation on schedule
2. Provider adapters fetch from external sources
3. Normalization converts to domain entities
4. Deduplication identifies duplicates
5. AI matching analyzes each vacancy
6. Ranking sorts by relevance
7. Results persisted to database
8. Notifications sent to user

## Data Flow: Application Pipeline

```
┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐
│ User     │───>│ Create   │───>│ Set      │───>│ Schedule │
│ Action   │    │ Applic.  │    │ Status   │    │ Follow-up│
└──────────┘    └──────────┘    └──────────┘    └──────────┘
                                                       │
                                                       v
┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐
│ Archive  │<──│ Generate │<──│ Send     │<──│ Reminder │
│          │    │ Message  │    │ Notif.   │    │ Triggers │
└──────────┘    └──────────┘    └──────────┘    └──────────┘
```

## Technology Stack Summary

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Backend | Fastify | HTTP server |
| Frontend | Next.js 15 | Web dashboard |
| Worker | BullMQ + Redis | Background jobs |
| Database | PostgreSQL + Prisma | Data persistence |
| AI | OpenAI/Anthropic/Gemini | Intelligence |
| Notifications | Telegram, Email | User communication |
| Monorepo | Turborepo | Build orchestration |
| Container | Docker Compose | Local development |

## Deployment Architecture

```
┌─────────────────────────────────────────────┐
│              Docker Compose                  │
│  ┌─────────┐ ┌─────────┐ ┌─────────────┐  │
│  │ Backend │ │ Worker  │ │  Dashboard   │  │
│  │ :3000   │ │ (bg)    │ │  :3001       │  │
│  └─────────┘ └─────────┘ └─────────────┘  │
│       │            │              │         │
│       v            v              v         │
│  ┌─────────┐ ┌─────────┐ ┌─────────────┐  │
│  │PostgreSQL│ │  Redis  │ │  PgAdmin    │  │
│  │ :5432   │ │ :6379   │ │  :5050       │  │
│  └─────────┘ └─────────┘ └─────────────┘  │
│  ┌─────────┐                               │
│  │ Mailpit │ (optional email testing)      │
│  │ :8025   │                               │
│  └─────────┘                               │
└─────────────────────────────────────────────┘
```

## Security Boundaries

1. **API Gateway**: All external requests go through Fastify with JWT validation
2. **Data Isolation**: Row-level security ensures users only see their data
3. **Secrets**: Environment variables, never hardcoded
4. **Input Validation**: Zod schemas on all API boundaries
5. **Rate Limiting**: Per-user rate limits on API endpoints
6. **CORS**: Restricted to dashboard origin
