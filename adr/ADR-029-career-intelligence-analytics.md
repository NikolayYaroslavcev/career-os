# ADR-029: Career Intelligence Analytics Architecture

## Status

Accepted

## Context

CareerOS needed a "Career Intelligence" analytics layer — a career health score, an application conversion funnel, failure-pattern detection, response-rate breakdowns, success patterns, match-score/outcome correlation, and trend reporting — computed from data already captured by the Application, Vacancy, Company, and MatchResult tables.

Two design questions had to be settled up front:

1. Should analytics computation live inside the domain packages (`@careeros/career`, `@careeros/ai`), or as its own package?
2. How do we compute funnel "vacancies found" counts, failure-stage attribution, and match/outcome correlation when the existing schema only stores an application's *current* status, not its full status history?

## Decision

### A standalone, I/O-free `@careeros/analytics` package

`packages/analytics` contains only pure functions operating on plain, locally-defined record interfaces (`ApplicationRecord`, `VacancyRecord`, `MatchResultRecord`, etc.) — it never imports Prisma, a repository, or a domain entity. `apps/backend/src/services/career-intelligence-service.ts` is the sole place that fetches real repositories and maps domain entities into the plain shapes the analytics functions expect. This keeps the analytics package framework-agnostic, trivially unit-testable (no mocking needed), and reusable from `apps/worker` if background recomputation is ever needed.

Modules: `funnel-computer`, `failure-analyzer`, `career-health-scorer`, `response-rate-analyzer`, `time-analytics`, `match-analytics`, `success-pattern-analyzer`, `trend-computer`, `insight-generator`, plus a small `stats-utils` (mean/median/Pearson correlation) shared across them.

### `AnalyticsEvent` as an append-only history log

The `Application` entity only tracks its *current* `status` — there is no status-history table. Three things `CareerIntelligenceService` needs cannot be derived from current-status alone:

- **Accurate "vacancies found" for the funnel top stage** — no table records vacancies a search surfaced before an application existed.
- **Which stage a rejected application was in before rejection** (failure analysis).
- **Whether a match result's application ever reached interview stage**, for match-score/outcome correlation (a `rejected` application may have been rejected *after* an interview, not before one).

Rather than adding stage-entry timestamp columns to `Application` (a wider schema change touching the CRM's domain model), we added `AnalyticsEvent` — a generic, append-only event log (`userId`, `eventType`, `entityType`, `entityId`, `metadata` JSON, `occurredAt`) recorded as a side effect in existing services:

- `ApplicationCreationService.createFromIds()` records `application_created`.
- `ApplicationCrmService.changeStatus()` records `status_changed` with `{ from, to }` metadata — this is what lets `CareerIntelligenceService` reconstruct "the status immediately before rejection" and its duration.
- `IntelligenceWorkflowService.run()` records one `vacancy_found` event per vacancy surfaced by a search — `countDistinctEntities()` gives the funnel an accurate, period-scoped "found" count instead of approximating it from the applied-set size.

All three call sites take `AnalyticsEventRepository` as an **optional** constructor parameter (defaults to not recording) so existing callers/tests that construct these services without it keep working unchanged.

This event log intentionally does not replace `Application.status` as the source of truth — it is additive, best-effort history. Applications that existed before this shipped simply have no history, and every consumer (`failure-analyzer`, `match-analytics`) treats "no history" as "unknown outcome" (excluded from the stat) rather than guessing.

### `CareerInsight` as a per-user, per-type cache with a composite unique key

`getInsights()` is the most expensive computation (it fans out into every performance breakdown plus two response-rate calculations plus match analytics). Rather than recomputing it on every request, `CareerIntelligenceService` caches it in `CareerInsight`, keyed by `(userId, insightType)` with a genuine `@@unique` constraint (`upsert`, not "insert and query the latest"), storing an explicit `validUntil` (15 minutes). Because the same `insightType` string needs to vary by `TrendPeriod` (`7d`, `30d`, ..., `all`), the period is folded into the cache key itself (`insights:30d`, `insights:all`, ...) rather than adding a second cache dimension. `refreshInsights()` bypasses the cache read and forces a recompute, for an explicit "refresh" action in the dashboard.

Dates round-trip through the `Json` column as ISO strings; `CareerIntelligenceService` revives them back into `Date` objects on a cache hit so callers never have to know whether a result came from cache or a fresh computation.

## Consequences

### Positive

- Analytics logic has zero I/O dependencies and is fully unit-tested without mocks (53 tests in `packages/analytics`).
- `AnalyticsEvent` is generic enough to support future analytics needs (e.g. a "vacancy viewed" funnel) without new schema changes.
- The cache is a real, bounded cache (one row per user/type/period, with expiry) rather than an unbounded append-only table.

### Negative

- History-dependent stats (failure-stage attribution, match/outcome correlation) are only accurate for applications whose transitions happened *after* this shipped — historical data has no recorded history and is reported as "unknown," not backfilled.
- `AnalyticsEvent` volume grows with usage (one row per status change, one per vacancy surfaced per search). `recordMany()` batches the high-volume `vacancy_found` writes into a single `createMany()` call to keep this cheap; no retention/archival policy exists yet.
- `avgSalary` in the Career Metrics overview is deliberately left `null` — vacancy salaries span multiple currencies with no FX conversion in scope, and averaging them directly would be misleading.
- `acceptedOffers`/`rejectedOffers` in Career Metrics are `0` — `ApplicationStatus` has no accepted/declined sub-state for an `offer`; this is a domain-model gap, not an analytics gap.

## Alternatives Considered

1. **Add a `statusHistory` table with explicit stage-entry timestamps on `Application`.** Rejected for this iteration — a generic event log serves the same analytics need without widening the CRM's core aggregate, and the event log doubles as a general-purpose audit trail.
2. **Compute insights on every request, no caching.** Rejected — `getInsights()` fans out into 9 performance-breakdown dimensions plus repeated application/match-result fetches; caching with a 15-minute TTL was a straightforward, low-risk win.
3. **Cache `Insights` in Redis instead of Postgres.** Rejected for consistency — the rest of the backend's persistent caches (`AICache`, `AIUsage`) are Postgres-backed via Prisma; adding a second cache backend for one feature wasn't worth the operational surface.

## References

- `packages/analytics/src/`
- `packages/database/prisma/schema.prisma` (`AnalyticsEvent`, `CareerInsight`)
- `packages/database/prisma/migrations/20260722120000_add_career_intelligence/`
- `packages/database/src/infrastructure/prisma-analytics-event-repository.ts`
- `packages/database/src/infrastructure/prisma-career-insight-repository.ts`
- `apps/backend/src/services/career-intelligence-service.ts`
- `apps/backend/src/routes/career-intelligence/career-intelligence-routes.ts`
- `apps/dashboard/src/features/career-intelligence/career-intelligence-dashboard.tsx`
