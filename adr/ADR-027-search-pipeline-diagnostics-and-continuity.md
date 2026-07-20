# ADR-027: Search Pipeline Diagnostics, Continuity, and Ranking Extension Point (EPIC-17)

## Status

Accepted

## Date

2026-07-20

## Context

EPIC-16 (ADR-026) made `/intelligence/search` non-blocking, but left several
gaps this EPIC closes:

- The HH provider registered successfully but returned zero vacancies — its
  parser modeled a response shape (`title`, flat `description`, `skills`)
  that doesn't match the real `api.hh.ru` search response (`name`,
  `snippet.requirement`/`snippet.responsibility`, no `skills` field at all
  outside the detail endpoint).
- No consolidated view of provider or pipeline health existed — dedup/filter
  counts and per-vacancy parse failures were logged but never returned in a
  structured, queryable form.
- Several pipeline constants (Top-N, batch size, provider timeout/limit,
  relevance floor, worker concurrency) were hardcoded across multiple files.
- Processing stopped after one Top-N batch per search; every vacancy ranked
  below the cut was discarded rather than revisited later.

This ADR does **not** cover the HH parser fix itself (self-contained in
`packages/providers/src/providers/hh/`) — it covers the four
architecturally-linked decisions below.

## Decisions

### 1. Provider diagnostics reuse existing infrastructure, don't duplicate it

`ProviderDiagnosticsService` (`apps/backend/src/services/provider-diagnostics-service.ts`)
is a thin aggregator, not a new observability subsystem:

- Registration/config/auth status comes from `registerConfiguredProviders()`
  (`container.ts`) now returning a `ProviderRegistrationOutcome` for **every**
  known provider, including ones skipped for missing config — so nothing is
  silently omitted.
- Live health comes from the existing `ProviderHealthMonitor`
  (`packages/providers/src/health/`) — not a parallel health tracker.
- Per-search fetch counts (fetched/normalized/deduplicated/filtered/persisted/
  parse-failure) are derived by grouping already-computed pipeline arrays on
  `NormalizedVacancy.source`/`Vacancy.source` inside
  `ProviderSearchService.searchAndPersist()` — no restructuring of the
  fetch/dedup/filter pipeline itself. The one real gap fixed here:
  `DefaultProviderJob.search()`'s `normalization.failed` (per-vacancy parse
  failures) was computed and then discarded entirely; it's now threaded into
  `ProviderSearchProviderStats` and the diagnostics snapshot.

### 2. Search diagnostics: an in-memory trace, not a new persistence layer

Per-run pipeline traces (stage input/output/duration/success, and — for every
excluded vacancy — *why*) follow the same pattern as the existing
`InMemoryMetricsCollector`/`InMemoryTracer`: bounded, in-process, not
Postgres-backed. Every exclusion reason is mechanically derived from data
already computed by existing services, not a new scoring pass:

| Reason | Source |
|---|---|
| `duplicate` | `DeduplicationEngine.deduplicate()`'s `duplicates[].all` |
| `provider_parse_failure` | `normalization.failed` (see above) |
| `low_relevance` / `outside_top_n` | `TriageResult.rejectionReason` (new field — see below) |
| `cache_hit` | `AiMatchingService.selectForAnalysis()`'s existing reuse check |
| `ai_failed` | `AiMatchingService.matchAll()`'s existing per-vacancy catch |

Access is gated by a new `DIAGNOSTICS_ENABLED` config flag (default `false`)
on top of existing JWT auth, rather than building a role/admin system that
doesn't otherwise exist in this codebase.

### 3. Continuous processing: Redis-backed backlog, not a new database table

`TriageMatchingService.triage()` already computes `rejectionReason` per
rejected candidate: `'low_relevance'` (below `minScore` — a genuine dead end)
or `'outside_top_n'` (ranked below the cut, but otherwise AI-worthy). Only the
latter feed the continuation backlog.

`AiBatchBacklog` (`packages/shared/src/queues/ai-batch-backlog.ts`) is an
ordered Redis list per search profile — Redis is already a hard dependency
here via BullMQ (ADR-007), so this is reusing existing infrastructure rather
than introducing a new one. `IntelligenceWorkflowService.run()` pushes
`outside_top_n` candidates onto the backlog right after enqueuing the first
batch. `apps/worker`'s `Worker.on('completed', ...)` pops the next
`AI_BATCH_SIZE` batch for that search profile and enqueues it — mirroring the
existing follow-up-reminder queue, which is also both produced and consumed
in the same worker process. The chain terminates naturally once the backlog
is empty. BullMQ's existing `jobId` dedup convention
(`buildVacancyAnalysisJobId`, now shared between the initial-enqueue and
continuation code paths) and the `MatchResult.inputHash` reuse check
(`packages/ai`) together guarantee a candidate is never double-processed.

### 4. Ranking extension point: an interface, not a preemptive refactor

`VacancyRanker` (`apps/backend/src/services/ranking/vacancy-ranker.ts`) is a
documented, exported interface for a future semantic ranking stage between
keyword ranking (`TriageMatchingService`) and the AI/LLM stage. It is
deliberately **not** wired into `TriageMatchingService` today — doing so
would require making `triage()` async (a real ranker implementation calls an
embeddings API), which has zero benefit while no implementation exists. The
exact composition point is marked with a comment in `triage()`, right before
the topN cut is applied. When semantic ranking is built, wiring it in is a
small, contained change to this one file and its direct callers — not a
pipeline-wide refactor.

## Consequences

### Positive

- Every provider (configured or not) has a real, queryable status — no more
  silent `logger.warn` as the only signal that a provider isn't running.
- A stuck/excluded vacancy has a concrete, inspectable reason instead of just
  disappearing from the pipeline's visible output.
- A large candidate pool is eventually processed in full, not just its first
  15, without duplicating AI work on re-runs.
- Semantic ranking (explicitly out of scope for this EPIC) has a known,
  narrow insertion point for whenever it's built.

### Negative

- `ProviderDiagnostics`/`SearchRunTrace` are in-memory and per-process — they
  reset on restart and don't aggregate across multiple backend instances.
  Acceptable for a developer diagnostics tool; would need a shared store
  (Redis or Postgres) if this became a production-facing SLA dashboard.
- The continuation backlog adds a second Redis-resident structure (beyond
  BullMQ's own queue state) that must be reasoned about during Redis
  incidents — a stuck backlog silently stalls continuation rather than
  loudly failing, though the diagnostics dashboard's queue/backlog view
  makes this visible.

## References

- ADR-007: Redis + BullMQ for Queue System
- ADR-022: Provider SDK
- ADR-026: Decoupled Vacancy Search
- EPIC-17: Search Platform Stabilization
