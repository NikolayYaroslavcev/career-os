# ADR-026: Decouple Vacancy Search from AI Matching (EPIC-16)

## Status

Accepted

## Date

2026-07-20

## Context

A real end-to-end browser test (Docker, real providers, real Groq key) found
`POST /api/v1/intelligence/search` hanging as "Pending" in the browser after
Groq returned `429 rate_limit_exceeded`. Provider search, normalization,
deduplication, and persistence had already succeeded (173 vacancies fetched
and persisted, confirmed in backend logs) — the request hung *after* that.

### Root cause

`IntelligenceWorkflowService.run()` did:

1. `providerSearchService.searchAndPersist(...)` — fetch, normalize, dedup, persist.
2. Best-effort enqueue to the `vacancy-analysis` BullMQ queue (already existed,
   already correct — apps/worker already consumed it).
3. **Unconditionally `await this.aiMatchingService.matchAll(...)`** — a second,
   synchronous, in-request AI pass over up to 15 triage-selected vacancies.

Step 3 is the literal blocking call. It duplicated step 2's work (both the
queue job and the synchronous call would eventually analyze the same
vacancies) and, worse, held the HTTP response hostage to AI provider latency.

We also audited the retry/backoff layer added in EPIC-15
(`packages/ai/src/resilience/retry-policy.ts`, `fallback-ai-provider.ts`):
3 attempts, exponential backoff capped at 30s, honors a provider's
`Retry-After` only when under that cap. It is **not** an infinite loop — but
`apps/backend/src/container.ts` pins Groq's `AiMatchingService` concurrency to
1 (its free-tier TPM budget can't absorb concurrent ~6-7k token prompts), so a
sustained 429 meant up to 15 vacancies analyzed **sequentially**, each eating
up to ~2 backoff sleeps of up to 30s. That's multiple minutes of the browser
sitting on a pending `fetch`, even though the call chain technically
terminates. In other words: not a runaway-retry bug, but a
synchronous-AI-in-the-request-path bug, compounded by low per-provider
concurrency.

The async infrastructure (BullMQ queue, `apps/worker`, the job processor) was
already correct and already running — this ADR is a redesign of the *call
graph*, not a new subsystem.

## Decision

### `POST /intelligence/search` never awaits AI

`IntelligenceWorkflowService.run()` takes an `awaitAiMatching` flag,
**defaulting to `false`**:

- **`awaitAiMatching: false`** (the HTTP route's default): provider search +
  persist runs as before; a new `AiMatchingService.selectForAnalysis()` method
  resolves already-cached `MatchResult`s and runs the existing local triage
  (no AI, no network calls) to rank/cap which vacancies are AI-worthy. Only
  the triage-selected set is enqueued to the background queue. The response
  returns immediately with every persisted vacancy, tagged `matched` (cached
  score available), `pending` (queued for the worker), or `skipped`
  (triage-rejected, or AI disabled — will never be scored for this snapshot).
  No AI call, no queue-processing wait, no `MatchResult`-persistence wait
  happens in this request.
- **`awaitAiMatching: true`**: the historical synchronous behavior —
  `AiMatchingService.matchAll()` computes and waits. Used only by
  `MorningDigestService` (a scheduled Telegram/email digest job, not a live
  browser request — it genuinely needs computed scores to build a digest) and
  the `demo:intelligence` script.

The local triage/candidate-cap logic (`maxAiCandidates`, currently 15) is
preserved rather than dropped: it's a deliberate cost and rate-limit control,
not incidental complexity. Removing it would mean enqueuing AI analysis for
every persisted vacancy unconditionally, making 429s *more* frequent — just
non-blocking instead of blocking. `matchAll()` itself is refactored to call
`selectForAnalysis()` internally, so there is exactly one reuse/triage
implementation shared by both the synchronous and asynchronous paths.

### Polling for results

`POST /intelligence/status` (body: `{ searchProfileId, vacancyIds }`) reports
which of a given set of vacancy IDs now have a cached `MatchResult`. It never
calls AI — same cached-lookup + local triage as the async search path. The
dashboard polls this every 4 seconds for vacancies still `pending`, capped at
~30 attempts (~2 minutes) as a backstop against a dead queue/worker — after
that it simply stops polling rather than spinning forever.

### `AI_ENABLED`

A new `AI_ENABLED` env var (default `true`) short-circuits AI/queue work
entirely when `false`: no AI calls, no enqueue, cached-only results returned
immediately. Intended for local development, UI testing, and provider
debugging without burning AI provider quota. Threaded through
`packages/shared`'s `Config` and into `IntelligenceWorkflowService`'s
constructor via `apps/backend/src/container.ts`.

### Timings and logging

Every stage of the request is now individually timed and logged via the
existing structured loggers (`AILogger`/`ConsoleAILogger` in the workflow
service and route — already JSON-structured; `packages/shared`'s `Logger` in
`apps/worker`, replacing plain `console.log`):

- `ProviderSearchService.searchAndPersist` now reports `fetchDurationMs`
  (fetch + normalize + dedup + filter) and `persistDurationMs` (the
  persistence loop) separately, in addition to the existing total
  `durationMs`.
- `IntelligenceWorkflowService.run()` logs `SEARCH START`, `Provider search
  started/finished`, `Jobs enqueued` (with its own `enqueueDurationMs` — the
  Redis round-trip to add jobs, not job completion), and a final `Workflow
  finished (async — AI not awaited)` line with every stage duration.
- `intelligence-routes.ts` logs `HTTP response returned` with the full
  request duration via Fastify's own logger.
- `apps/worker` logs `Worker picked job`, `AI started`, `Vacancy analysis
  computed`/`reused` (from the shared `analyzeVacancyForSearchProfile`
  orchestrator — doubles as "AI completed" + "MatchResult stored", since the
  save happens immediately before that log line), and `Worker finished`.

### Frontend

The dashboard's search UI (`apps/dashboard/src/features/intelligence/search-button.tsx`)
renders every returned vacancy immediately: a score badge for `matched`, an
"AI analysis in progress" badge for `pending`, and a muted "Not analyzed"
badge for `skipped`. It polls `/intelligence/status` for the `pending` set
and merges results in as they resolve. Applying to a vacancy no longer
requires a `matchResultId` — the existing `CreateApplication` DTO already
treats it as optional.

## Consequences

### Positive

- `POST /intelligence/search` can no longer be held hostage by AI provider
  latency, rate limits, or outages — it returns as soon as persistence and
  enqueue finish.
- No duplicate AI work: previously, the same vacancies could be analyzed once
  by the "best-effort" queue enqueue and again by the synchronous `matchAll()`
  call in the same request.
- Per-stage timing makes future regressions in this path immediately visible
  in logs, instead of only showing up as an aggregate request duration.
- `AI_ENABLED=false` gives a fast, deterministic local dev/test loop with zero
  AI provider dependency.

### Negative

- The `/intelligence/search` response contract changed (recommendations-only
  list → full vacancy list with per-vacancy status). This is a breaking API
  change; both backend and frontend were updated together in this change.
- Polling adds a second endpoint and a client-side interval to reason about,
  versus the previous single-request/single-response model.
- `MorningDigestService`'s synchronous mode is a deliberately different
  contract from the HTTP path — a future reader modifying `run()` needs to
  know both modes exist and why.

## References

- ADR-007: Redis + BullMQ for Queue System
- ADR-025: AI Provider Resilience (Fallback, Retry, Health, Concurrency)
- EPIC-16: Fix Production Search Flow & Decouple AI Matching
