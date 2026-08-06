# ADR-037: AI Job Duplicate-Request Prevention

## Status

Accepted

## Date

2026-08-05

## Context

`AIOrchestrator.execute()` (`packages/ai-orchestrator/src/orchestrator.ts`)
handles every AI feature call (analyze-vacancy, cover-letter, interview-prep,
salary-analysis, company-analysis, resume-improvement, career-advice; resume
tailoring is out-of-scope, see ADR-031's separate async pipeline). Before this
ADR, `execute()` checked the `AICache` table for a prior result, and on a
miss unconditionally created a new `AIJob` row and ran the paid provider
handler in-process. There was no check against other in-flight requests.

Two identical requests — a double-click, two open tabs, or a client retry
after a request timeout — both miss the cache (neither has written a result
yet), so both create their own `AIJob` row and both call the AI provider,
doubling cost and latency for a single user action. `AIJobRepository` already
had an unused `findByInputHash(inputHash)` method with no caller anywhere in
the codebase — a dedup check appears to have been planned but never wired in.

EPIC-20 Phase 3.2 scopes this narrowly: eliminate duplicate execution without
redesigning the AI architecture or introducing a queue (`AIJobQueue` wraps
BullMQ but is constructed and never invoked by `execute()`, which always runs
handlers synchronously in-process; this ADR does not change that).

## Decision

Two layers, matching the two ways a duplicate can occur:

1. **Fast path — pre-insert check.** `execute()` calls
   `AIJobRepository.findActiveByKey(userId, feature, inputHash)` (the
   renamed, now-wired-in `findByInputHash`, scoped to
   `PENDING`/`QUEUED`/`PROCESSING`) before creating a job. A hit returns the
   existing job's id with `status: 'queued'` — the client polls the existing
   `GET /jobs/:jobId` endpoint, unchanged — instead of creating a second job
   or calling the provider again. This covers the common cases (double-click,
   rapid repeat, retry after timeout) without a database round-trip failure.

2. **Correctness guarantee — partial unique index.** The pre-insert check has
   a TOCTOU race: two requests can both pass it before either inserts. A
   Postgres partial unique index,
   `AIJob(userId, feature, inputHash) WHERE status IN ('PENDING', 'QUEUED', 'PROCESSING')`
   (migration `20260805140000_add_aijob_active_dedup_index`, hand-written
   since `schema.prisma` can't express a `WHERE`-scoped index), makes the
   losing insert fail instead of succeed. `PrismaAIJobRepository.create()`
   catches that failure (Prisma error code `P2002`), re-fetches the winning
   row via `findActiveByKey`, and throws a typed `DuplicateAIJobError`
   carrying its id. `execute()` catches that error the same way as the
   fast-path hit and returns the winning job instead of throwing.

Scoped to active statuses only, not a full unique index, so a completed,
failed, or cancelled job never blocks a later legitimate request with the
same inputs (e.g. retry after a failure, or a fresh run once the
`AICache`-scoped result would otherwise apply).

No lock, queue, or new subsystem was introduced — the database's own unique
constraint is the lock, consistent with how `AICache.cacheKey` already uses
a `@unique` column plus `upsert` to make concurrent cache writes race-safe.

## Consequences

### Positive
- Two identical concurrent requests now run the AI provider handler once,
  not twice — halves duplicate spend/latency for double-clicks, multi-tab
  submits, and timeout retries.
- The correctness guarantee lives in the database, not application memory —
  holds across multiple backend processes/instances, not just within one.
- Every existing caller of `orchestrator.execute()` (8 call sites across
  `ai-routes.ts` and `application-routes.ts`) is unaffected: the response
  shape (`{jobId, status, cached}`) is unchanged, and `status: 'queued'` was
  already a declared value on `ExecuteAIResult` that nothing produced before
  this change.

### Negative
- A crashed process that leaves an `AIJob` row stuck in `PROCESSING`
  indefinitely will cause every subsequent identical request to be treated
  as a duplicate and returned that stuck job's id, without executing. This
  is a pre-existing failure mode of synchronous, in-process execution with
  no worker/heartbeat to detect a dead job — it is not introduced by this
  change, but this change is the first thing that makes a stuck job
  user-visible as "nothing happens" rather than "a second job also runs."
  Not addressed here per this EPIC's explicit scope (no architecture
  redesign); a future stale-job sweep or `PROCESSING` TTL would close it.
