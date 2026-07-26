# CareerOS System Architecture

## Overview

CareerOS follows Clean Architecture with layered separation. Dependencies point inward: Presentation → Application → Domain → Infrastructure.

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Presentation Layer                    │
│  ┌──────────┐  ┌──────────┐  ┌──────────────────────┐  │
│  │ Dashboard │  │ Telegram │  │   REST API Clients   │  │
│  │ (Next.js) │  │   Bot    │  │                      │  │
│  └──────────┘  └──────────┘  └──────────────────────┘  │
├─────────────────────────────────────────────────────────┤
│                   Application Layer                     │
│  ┌──────────┐  ┌──────────┐  ┌──────────────────────┐  │
│  │ Services │  │ Use Cases│  │   Event Handlers     │  │
│  └──────────┘  └──────────┘  └──────────────────────┘  │
├─────────────────────────────────────────────────────────┤
│                     Domain Layer                        │
│  ┌──────────┐  ┌──────────┐  ┌──────────────────────┐  │
│  │ Entities │  │ Value    │  │   Domain Events      │  │
│  │          │  │ Objects  │  │                      │  │
│  └──────────┘  └──────────┘  └──────────────────────┘  │
├─────────────────────────────────────────────────────────┤
│                 Infrastructure Layer                    │
│  ┌──────────┐  ┌──────────┐  ┌──────────────────────┐  │
│  │ Database │  │  Queue   │  │   External APIs      │  │
│  │ (Prisma) │  │(BullMQ)  │  │   (Providers)       │  │
│  └──────────┘  └──────────┘  └──────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

## Monorepo Structure

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
├── tasks/                # Task breakdown
├── docker-compose.yml
├── turbo.json
├── tsconfig.base.json
└── package.json
```

## Layer Responsibilities

### Domain Layer (`packages/career`, `packages/resume`, etc.)

Contains business logic and entities. No infrastructure dependencies.

```typescript
// Domain entity
export class Application {
  constructor(
    public readonly id: string,
    public readonly jobId: string,
    public readonly userId: string,
    public status: ApplicationStatus,
    public readonly createdAt: Date,
  ) {}

  transitionTo(newStatus: ApplicationStatus): void {
    if (!this.isValidTransition(newStatus)) {
      throw new InvalidTransitionError(this.status, newStatus);
    }
    this.status = newStatus;
  }
}
```

### Application Layer (`apps/backend`)

Orchestrates use cases. Depends on domain interfaces.

```typescript
// Application service
export class ApplyToJobUseCase {
  constructor(
    private readonly applicationRepo: ApplicationRepository,
    private readonly notificationService: NotificationService,
  ) {}

  async execute(command: ApplyToJobCommand): Promise<Application> {
    const application = new Application(/* ... */);
    await this.applicationRepo.save(application);
    await this.notificationService.notify(application.userId, 'Application created');
    return application;
  }
}
```

### Infrastructure Layer (`packages/database`, `packages/providers`)

Implements interfaces defined in domain/application layers.

```typescript
// Infrastructure implementation
export class PrismaApplicationRepository implements ApplicationRepository {
  async save(application: Application): Promise<void> {
    await this.prisma.application.upsert({
      where: { id: application.id },
      create: /* ... */,
      update: /* ... */,
    });
  }
}
```

### Presentation Layer (`apps/dashboard`, Telegram bot)

Handles user interaction. No business logic.

## Core Services

### Job Pipeline

```
Provider → Normalization → Deduplication → AI Analysis → Ranking → Persistence → Notification
```

### Application Pipeline

```
User Action → Status Change → Follow-up Schedule → Reminder → Notification
```

### AI Processing Pipeline

```
Input → Prompt Construction → Provider Call → Validation → Result Mapping
```

### Career Intelligence Pipeline

```
Application/MatchResult/AnalyticsEvent tables → packages/analytics (pure functions)
  → CareerIntelligenceService (fetch + map + cache) → /api/v1/career-intelligence/*
```

`packages/analytics` computes the conversion funnel, failure-pattern attribution, career health score, response-rate breakdowns, success patterns, match/outcome correlation, trend metrics, and insight generation as pure functions over plain records — see ADR-029. `AnalyticsEvent` (an append-only log recorded by `ApplicationCreationService`, `ApplicationCrmService`, and `IntelligenceWorkflowService`) supplies the status-history and vacancy-discovery data the current-state-only `Application`/`Vacancy` tables can't. `CareerInsight` caches the most expensive computation (`getInsights`) per `(userId, insightType:period)` with a 15-minute TTL.

## Data Flow

### Job Discovery Flow

1. Worker triggers scheduled job aggregation
2. Each provider adapter fetches jobs from external source
3. Jobs normalized to common `Vacancy` entity
4. Deduplication by title + company + location hash
5. AI analyzes each vacancy against user profiles
6. Results ranked and persisted
7. Users notified of new matches

### Application Management Flow

1. User views job listing
2. User creates application (status: saved)
3. User applies (status: applied)
4. Follow-up engine schedules reminder
5. Reminder triggers notification
6. User updates status through pipeline
7. Analytics track progression

## Event-Driven Communication

Internal events for decoupling:

- `JobDiscovered` - New vacancy found
- `JobAnalyzed` - AI analysis complete
- `ApplicationCreated` - New application
- `ApplicationStatusChanged` - Status transition
- `FollowUpDue` - Reminder triggered
- `NotificationRequested` - Send notification

## Security Boundaries

- JWT authentication at API gateway
- Row-level data isolation per user
- Provider credentials in environment variables
- No secrets in code or logs
- Rate limiting on public endpoints

## Scalability Points

- Worker instances scale independently
- Database connection pooling
- Redis for caching and queues
- AI provider fallback on failure
- Provider adapters are stateless
