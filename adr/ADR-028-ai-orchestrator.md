# ADR-028: AI Orchestrator & Cost Optimization

## Status

Accepted

## Context

AI calls were scattered across multiple services (`ResumeTailoringService`, `CoverLetterService`, `MatchingEngine`, etc.), each directly calling `AIProvider.complete()`. This created several problems:

1. **No centralized caching**: Each service had its own in-memory cache (or none), meaning identical prompts could trigger redundant AI calls
2. **No cost tracking**: There was no way to measure or control AI spending across the application
3. **No usage visibility**: Users had no insight into how many tokens they were consuming or which features were most expensive
4. **No budget enforcement**: No way to set limits on daily/monthly token usage or costs
5. **Tight coupling**: Adding a new AI feature required modifying multiple services and understanding the provider abstraction
6. **No background processing**: Some AI operations blocked HTTP requests, causing timeouts and poor UX

## Decision

Create `packages/ai-orchestrator` as the **sole entry point** for all AI requests in CareerOS.

### Architecture

```
UI → AI Orchestrator → Cache (Redis+DB) → Queue (BullMQ) → Provider Router → Provider → Store Result
```

### Key Components

1. **AIOrchestrator** - Main entry point. Handles cache lookup, job creation, budget checks, and mode management.

2. **PersistentCache** - Redis + PostgreSQL cache with content-addressed keys (SHA-256 of provider + model + prompt_version + feature + input hashes). Changing prompt version automatically invalidates cache.

3. **AIJobQueue** - BullMQ-backed job queue. Every AI request becomes a background job. The frontend never waits for LLM completion.

4. **UsageTracker** - Persistent usage tracking per request (provider, model, feature, tokens, cost, latency).

5. **BudgetEnforcer** - Configurable limits (daily/monthly tokens, cost, per-feature requests). Gracefully disables AI when limits are reached.

6. **ProviderRouter** - Selects provider based on: per-feature override → per-user override → global default. Supports custom base URLs for Ollama/LM Studio.

7. **AIModeManager** - Three modes:
   - **Manual** (default): Only explicit user actions trigger AI
   - **Smart**: Background AI for high-priority vacancies, watched companies
   - **Automatic**: Analyze every new vacancy (disabled by default)

8. **Job Handlers** - Feature-specific handlers (8 total: analyze_vacancy, tailor_resume, cover_letter, interview_prep, salary_analysis, company_analysis, resume_improvement, career_advice).

### Database Schema

Five new Prisma models:
- `AIJob` - Tracks every AI request as a background job
- `AICache` - Persistent cache with TTL and hit counting
- `AIUsage` - Per-request usage tracking
- `AIProviderConfiguration` - Per-provider settings (supports BYOK)
- `AIBudget` - Configurable cost/token limits

### API Endpoints

Under `/api/v1/ai/`:
- 8 action endpoints (one per feature)
- Job management (status, list, cancel)
- Usage stats and dashboard data
- Budget management
- Mode configuration
- Cache management
- Provider configuration

### Dashboard

New `/app/ai` page with:
- Usage overview cards (today/week/month tokens, estimated cost)
- Cache performance metrics
- Provider breakdown
- Recent jobs table
- AI mode selector
- Budget settings

## Consequences

### Positive

1. **90%+ reduction in AI calls**: Cache + input hashing means unchanged data never triggers AI
2. **Zero AI tokens for CRUD operations**: Opening vacancy, browsing, filtering, saving, applying, tracking, managing - all consume zero AI tokens
3. **Cost transparency**: Every request tracked with tokens + estimated cost
4. **Provider agnostic**: New providers added by configuration, not code changes
5. **Background processing**: All AI jobs async, UI never waits for LLM completion
6. **Budget enforcement**: Configurable limits with graceful degradation
7. **Cache persistence**: Redis + DB means cache survives restarts
8. **BYOK ready**: Users can bring their own API keys per provider

### Negative

1. **Increased complexity**: New package with multiple subsystems
2. **Database migration required**: 5 new models
3. **Redis dependency**: Queue and cache require Redis
4. **Worker process needed**: Background job processing requires running worker

### Mitigations

- All components use null object pattern (NoopAILogger, etc.) for graceful degradation
- Redis and worker are optional (in-memory fallbacks for development)
- Budget enforcement is configurable and can be disabled

## Alternatives Considered

1. **Keep scattered AI calls**: Rejected - no cost control, no caching, poor UX
2. **Use existing BullMQ queue only**: Rejected - no cache, no budget, no usage tracking
3. **External AI gateway (e.g., Portkey)**: Rejected - adds external dependency, less control

## References

- packages/ai-orchestrator/src/
- packages/database/prisma/schema.prisma (AI models)
- apps/backend/src/routes/ai/ai-routes.ts
- apps/worker/src/jobs/ai-job-processor.ts
- apps/dashboard/src/features/ai/ai-dashboard.tsx
