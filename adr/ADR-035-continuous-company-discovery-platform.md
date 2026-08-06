# ADR-035: Continuous Company Discovery Platform

## Status

Accepted — Phases 0-2 implemented (self-scheduling sync, health/priority lifecycle, `CompanyCandidate` discovery/confidence/conversion pipeline). Phases 3-5 (review-queue dashboard UI, bulk `DiscoverySource` ingestion, metrics/TTL) remain specification only.

## Date

2026-07-30

## Context

`research/free-provider-expansion/EPIC.md` (approved) proposed, as its Phase 3,
a one-time "CompanyWatch discovery infrastructure" batch job: crawl a few bulk
sources (Common Crawl, YC, CNCF, Getro), produce a ranked candidate list, and
let a human run each candidate through the existing `CustomHtmlAdapter`/
`JsonLdAdapter` onboarding flow by hand.

That framing undersells what the codebase actually needs. Company Watch today
has no autonomous operation at all:

- `CompanyWatchService.syncAll()` is never called by anything scheduled.
  `packages/shared/src/queues/company-watch.ts` exports
  `COMPANY_WATCH_QUEUE`/`COMPANY_WATCH_SYNC_JOB`, but grepping the repo shows
  **no producer and no worker processor** for that queue — it is dead
  plumbing. Every `CompanyWatch` row is synced only when a user hits `POST
  /company-watch/:id/sync` by hand. Contrast this with the Provider pipeline's
  `SyncSchedulerService`, which self-schedules every provider on an interval
  and re-arms itself after every run.
- `CompanyDiscoveryService.discover(url)` (`packages/company-watch/src/
  services/company-discovery-service.ts`) is a single-shot, stateless HTML
  prober: fetch one URL, regex-sniff the ATS type, return a `DiscoveryResult`.
  It persists nothing, scores nothing, retries nothing, and has no caller
  except the dashboard's "Discover" button (`apps/dashboard/.../company-watch/
  page.tsx`) triggering one lookup at a time for a company a human already
  typed in.
- `CompanyWatch.active` is a bare boolean plus a free-text `lastSyncStatus`
  string — there is no failure-count-driven state machine like the one
  `VacancySource` already has (`ACTIVE → BROKEN` after 3 consecutive
  failures, per ADR-030). A company whose career page starts 404ing keeps
  getting polled forever at the same interval, with no auto-retirement and no
  priority signal.
- There is no staging/review layer between "a domain was found somewhere" and
  "a `CompanyWatch` row exists." Enrollment today is 100% manual, one row at a
  time, via `CompanyWatchService.addCompany()`.

So "multi-company ATS fan-out" (rescan N known companies) is already solved —
`AtsAdapterRegistry` + `CompanyWatchService` do that correctly per ADR-033.
What's missing is the layer *above* it: continuously finding new companies,
deciding whether they're trustworthy enough to enroll automatically, keeping
the resulting fleet healthy without human babysitting, and feeding what the
fleet learns back into how it prioritizes itself. That is the actual gap this
ADR closes — the "Continuous Company Discovery Platform."

### Graphify / reuse-before-creating findings

A Graphify-assisted read of the relevant modules (`CompanyDiscoveryService`,
`packages/ats-adapters`, `packages/providers`, `DeduplicationEngine`, the
Social Message Platform, `packages/shared/src/queues`,
`ProviderDiagnosticsService`, `VacancySource` lifecycle,
`ProviderConfig`/`ProviderManagementService`, `SyncSchedulerService`) found
four precedents strong enough that this ADR treats them as **the** patterns
to extend, not references to draw inspiration from:

| Need | Don't build new — extend this |
|---|---|
| ATS HTTP + parsing | `packages/ats-adapters` (`AtsAdapter`/`AtsRawJob`, 8 ATS types, already shared by both Provider and Company Watch per ADR-033) |
| Deterministic confidence scoring with a versioned threshold | `packages/ai/src/extraction/message-extraction-confidence.ts` — weighted-category rubric + evidence-integrity check, `MESSAGE_EXTRACTION_LOW_CONFIDENCE_THRESHOLD` as a named, versioned constant (ADR-032 Phase 3) |
| Fuzzy company/title matching | `DeduplicationEngine.computeLevenshteinSimilarity` (`packages/providers/src/deduplication/deduplication-engine.ts`) — already does company-name (weight 0.5) + title (weight 0.5) similarity for cross-provider dedup |
| Failure-count-driven lifecycle state machine | `VacancySource`'s `ACTIVE → BROKEN` after `failureCount >= 3` (ADR-030) and `SyncSchedulerService.deriveHealth()`'s identical `UNHEALTHY_AFTER_CONSECUTIVE_FAILURES = 3` constant |
| Per-source config/enable/priority | `ProviderConfig` (`enabled`, `syncEnabled`, `status`, `qualityScore`) and the tier-banding scheme proposed (not yet built) in `research/provider-quality-audit/REPORT.md` Phase 6 |
| Read-model aggregation for a dashboard | `ProviderDiagnosticsService` — thin aggregator over existing state, not a new system of record |
| Capability-based dispatch across heterogeneous sources | `SocialMessageTransportRegistry`'s `(providerId, capability)` dispatch and `TransportCapability` enum (ADR-032 addendum) |
| BullMQ queue shape | `packages/shared/src/queues/*.ts` constant-file convention + `apps/worker/src/jobs/*-processor.ts` one-processor-per-queue convention |

No new package is proposed for the steady-state pipeline. One new package is
proposed only for genuinely new responsibility (bulk-source ingestion — see
Architecture §1). Everything else is new tables + new orchestration wired
through packages that already exist.

## Decision

Build a **Discovery → Confidence → Enrollment → Health → Priority** pipeline
that sits in front of the existing `CompanyWatch` fleet, reusing
`ats-adapters`, `DeduplicationEngine`'s fuzzy matcher, the confidence-rubric
pattern from `MessageExtraction`, and the `ProviderConfig`/`VacancySource`
lifecycle conventions. It does not touch the Provider/Vacancy Sync pipeline's
tenancy model (per ADR-033 Question 1, still respected) — discovered
companies land in Company Watch, the per-workspace notification pipeline;
promotion of a discovered ATS to a global, multi-tenant `Provider` remains a
separate, human-approved action, exactly as it is today for any new provider.

## Architecture

### High-level flow

```
┌─────────────────────────────────────────────────────────────────────┐
│  1. BULK DISCOVERY SOURCES (new)                                      │
│     Common Crawl JobPosting extract · YC companies API ·              │
│     CNCF landscape.yml · GitHub awesome-lists · Getro/Consider boards │
│     — each a DiscoverySource config row, each its own scheduled job   │
└──────────────────────────────┬────────────────────────────────────────┘
                                 ▼
┌─────────────────────────────────────────────────────────────────────┐
│  2. CANDIDATE INTAKE (new)  →  CompanyCandidate row per domain        │
│     dedup against Company/CompanyWatch (reuses DeduplicationEngine's   │
│     Levenshtein matcher) — duplicates never proceed past this stage    │
└──────────────────────────────┬────────────────────────────────────────┘
                                 ▼
┌─────────────────────────────────────────────────────────────────────┐
│  3. FINGERPRINTING (existing, reused as-is)                           │
│     CompanyDiscoveryService.discover(url) — ATS type, career URL,      │
│     API endpoint, JSON-LD, RSS, sitemap                                │
└──────────────────────────────┬────────────────────────────────────────┘
                                 ▼
┌─────────────────────────────────────────────────────────────────────┐
│  4. CONFIDENCE SCORING (new — mirrors MessageExtraction's rubric)     │
│     deterministic weighted score → PENDING_REVIEW / AUTO_ENROLL /      │
│     REJECTED                                                            │
└──────────────────────────────┬────────────────────────────────────────┘
                    ┌───────────┴────────────┐
                    ▼                        ▼
┌───────────────────────────┐   ┌─────────────────────────────────────┐
│ 5a. REVIEW QUEUE (new)      │   │ 5b. AUTO-ENROLLMENT (new)            │
│ dashboard page, human       │   │ calls existing                       │
│ approve/reject              │   │ CompanyWatchService.addCompany()     │
└──────────────┬─────────────┘   └───────────────────┬───────────────────┘
                └───────────────┬────────────────────┘
                                 ▼
┌─────────────────────────────────────────────────────────────────────┐
│  6. CompanyWatch FLEET (existing entity, lifecycle EXTENDED)          │
│     AtsAdapterRegistry.fetchJobs() via existing per-ATS adapters       │
│     — now actually scheduled (new: BullMQ producer + worker on the     │
│     already-declared but dead COMPANY_WATCH_QUEUE)                     │
└──────────────────────────────┬────────────────────────────────────────┘
                                 ▼
┌─────────────────────────────────────────────────────────────────────┐
│  7. HEALTH + PRIORITY (new — mirrors VacancySource ACTIVE→BROKEN and   │
│     ProviderConfig.qualityScore tiering)                               │
│     consecutiveFailureCount → DEGRADED → BROKEN → auto-retire           │
│     CompanyWatchEvent NEW_JOB velocity → priorityScore → pollingInterval│
└─────────────────────────────────────────────────────────────────────┘
```

### 1. Discovery lifecycle

Two intake shapes, both feeding the same `CompanyCandidate` staging table —
do not build two pipelines:

- **Bulk/batch discovery** (new `DiscoverySource` config rows): Common Crawl
  JobPosting extract (quarterly), YC companies API (weekly), CNCF
  `landscape.yml` + GitHub "awesome career-pages" curation (monthly),
  Getro/Consider VC-board scraping (monthly, non-JS-rendered boards only —
  per `free-provider-expansion/EPIC.md` Phase 3's own caveat). Each source is
  a scheduled BullMQ job (own cadence, own queue) that emits raw
  `{name, domain, sourceUrl}` tuples, not `CompanyCandidate` rows directly —
  intake and fingerprinting are separate steps (see below) so a slow bulk
  parse never blocks per-candidate HTTP probing.
- **Single-shot discovery** (existing, unchanged): the dashboard's "Discover"
  button and any future "add via URL" flow call `CompanyDiscoveryService.
  discover()` directly and go straight to step 3 (fingerprinting) — they skip
  the bulk-intake queue because there's exactly one candidate and a human is
  already looking at it.

Lifecycle states for a `CompanyCandidate` (new entity, `packages/
company-watch/src/domain/entities/company-candidate.ts`, same
constructor/`reconstitute` shape as `CompanyWatch`):

```
DISCOVERED → FINGERPRINTED → SCORED → { PENDING_REVIEW | AUTO_ENROLLED | REJECTED | DUPLICATE }
AUTO_ENROLLED / (PENDING_REVIEW → approved) → ENROLLED (CompanyWatch row created)
PENDING_REVIEW → rejected → REJECTED
```

`DUPLICATE` short-circuits at intake (step 2) before fingerprinting ever
runs — cheapest possible rejection, avoids wasting an HTTP probe on a company
already known.

### 2. Confidence model

Reuses the exact shape `message-extraction-confidence.ts` already
established: a **deterministic**, weighted-category rubric computed in code
(no LLM call — discovery must stay cheap at bulk-crawl scale), versioned as a
named constant the same way `MESSAGE_EXTRACTION_LOW_CONFIDENCE_THRESHOLD` and
`CURRENT_MATCHING_ALGORITHM_VERSION` already are.

| Category | Weight | Signal |
|---|---|---|
| ATS type certainty | 30% | Structured match (URL contains `boards-api.greenhouse.io`, etc.) scores full; heuristic HTML string match scores partial; `CUSTOM_HTML` fallback scores minimum |
| Reachability | 20% | Career URL and, if present, `apiEndpoint` both returned 2xx during fingerprinting |
| Job signal | 25% | `AtsAdapterRegistry.get(atsType).fetchJobs()` dry-run against the discovered endpoint returns ≥1 parseable job |
| Source authority | 15% | Which `DiscoverySource` found it — YC/CNCF (named, curated lists) score higher than a bare Common Crawl domain hit, matching `free-provider-expansion/REPORT.md`'s own per-source confidence framing |
| Dedup distance | 10% | Levenshtein similarity (via `DeduplicationEngine`'s existing function) against nearest known `Company`/`CompanyWatch` name — closer to an *existing but not identical* name lowers confidence (likely a subsidiary/rename edge case that deserves a human look, not silent auto-enroll) |

Score bands (reuses the exact banding proposed but never implemented for
`ProviderConfig.tier` in the quality audit, applied here to candidates
instead of providers): **≥ 85 → auto-enroll**, **50–84 → review queue**,
**< 50 → reject**. One named constant,
`DISCOVERY_CONFIDENCE_VERSION`, so historical scores don't silently become
incomparable when the rubric changes — same rationale ADR-032/Phase 6 already
gave for their own versioned scores.

### 3. Discovery scoring vs. confidence — the distinction

Confidence (above) answers *"can we trust this candidate enough to enroll
it?"* — computed once, at discovery time. **Priority** (§9 below) answers
*"how often should we poll this company once it's enrolled?"* — computed
continuously, from `CompanyWatchEvent` history. Conflating the two was a
mistake the quality audit already flagged once for providers (four
disagreeing quality calculators, Finding #3) — this ADR keeps them as two
named, separately-versioned scores from day one.

### 4. Auto-enrollment rules

- Confidence ≥ 85 **and** `atsType` is one of the 8 already-migrated
  `AtsAdapterRegistry` types (Greenhouse/Lever/Ashby/Workday/Teamtailor/
  SmartRecruiters/Recruitee) → call the existing `CompanyWatchService.
  addCompany()` directly, no new persistence path.
- `CUSTOM_HTML`/`JSON_LD` fingerprints **never** auto-enroll regardless of
  score — these fallback adapters have no per-site parsing guarantee (per
  ADR-033's own scoping, they were "moved from company-watch, no Provider
  equivalent," i.e. always the least reliable path). They always land in the
  review queue.
- **Workspace assignment**: `CompanyWatch` is per-workspace by schema
  (`workspaceId` FK, `@@unique([workspaceId, name])`). Auto-enrollment writes
  into a single, dedicated system workspace (`DISCOVERY_WORKSPACE_ID`, a
  config value, not a new multi-tenancy concept) rather than every user's
  workspace — discovered companies become visible to a workspace the whole
  team/ops function owns, and are only proposed (not silently duplicated)
  into an individual user's own watch list via a "add to my workspace" action
  in the review queue UI. This avoids inventing a "global CompanyWatch" schema
  change.

### 5. Review queue

New dashboard page, `apps/dashboard/src/app/app/company-discovery/page.tsx`,
same component conventions as the existing `company-watch/page.tsx`
(Card/Badge/Dialog from `@/components/ui`). Lists `CompanyCandidate` rows
with `status = PENDING_REVIEW`, shows the confidence breakdown (all five
category scores, not just the total — mirrors how `MessageExtraction`
persists per-category scores for auditability), and two actions: Approve
(→ `CompanyWatchService.addCompany()`, same call auto-enrollment makes) and
Reject (→ `REJECTED`, with a required reason field feeding §10's feedback
loop). No bulk-approve in v1 — per-candidate review is the point of a *review*
queue; if review-queue depth becomes the bottleneck, that shows up in the
metrics (§12) as a prioritization signal for raising the auto-enroll
threshold, not as a reason to add a bypass.

### 6. Retry policy

Reuses `packages/ats-adapters`' existing `resilience/fetch-with-timeout.ts`
and `packages/providers`' `RetryPolicy`/`TokenBucket` rather than a new retry
implementation:

- **Bulk source fetch** (Common Crawl file, YC API page): 3 attempts,
  exponential backoff, same `RetryPolicy` config shape already used by
  Social Message transports (ADR-032 addendum).
- **Per-candidate fingerprinting probe**: 1 attempt, no retry —
  `CompanyDiscoveryService.discover()` already catches all failures and
  returns a null-shaped `DiscoveryResult` (see its existing `catch` block);
  a candidate that fails fingerprinting once simply scores low on
  Reachability (§2) and lands in review or gets rejected, rather than being
  retried immediately against a possibly-rate-limiting target site. It *is*
  re-attempted on the source's next scheduled run (bulk sources are
  idempotent re-scans, see §13), which is a natural, spaced-out retry.
- **Enrolled `CompanyWatch` sync**: unchanged — `AtsAdapter` calls already go
  through each adapter's own transport-layer retry (established per-ATS
  during the ADR-033 migrations).

### 7. Health monitoring

`CompanyWatch` gains the fields `VacancySource` already has and
`SyncSchedulerService` already computes from, instead of a new health
concept:

```
CompanyWatch (extended)
├── ...(existing fields, unchanged)
├── consecutiveFailureCount: number   (new, mirrors VacancySource.failureCount)
├── healthStatus: 'ACTIVE' | 'DEGRADED' | 'BROKEN' | 'RETIRED'  (new)
└── priorityScore: number             (new, see §9)
```

`healthStatus` transitions use the **same threshold already hardcoded twice**
in this codebase (`SyncSchedulerService.UNHEALTHY_AFTER_CONSECUTIVE_FAILURES
= 3`, and `VacancySource`'s "3 failures → BROKEN" per ADR-030) — a third,
different threshold here would be an unforced inconsistency:

```
ACTIVE ──sync success──────────────> ACTIVE (consecutiveFailureCount reset to 0)
ACTIVE ──sync failure───────────────> ACTIVE (count += 1), if count == 1-2 → DEGRADED
DEGRADED ──sync failure, count >= 3──> BROKEN
BROKEN ──sync success────────────────> ACTIVE (count reset)  [companies do come back]
```

### 8. Automatic source retirement

`BROKEN` is not immediately deleted or set `active = false` — that would
silently stop tracking a company that might recover. Instead:

- `BROKEN` for < 14 days: still polled, but at a backed-off interval (see
  §9's priority-driven `pollingInterval`, floored much lower for `BROKEN`
  rows) — cheap enough to keep checking, expensive enough not to waste the
  same budget as a healthy company.
- `BROKEN` for ≥ 14 days continuous: transition to `RETIRED`,
  `active = false` (reuses the existing field — `RETIRED` is a `healthStatus`
  value, `active` stays the single on/off switch every other code path
  already reads), and the row is excluded from `CompanyWatchService.
  syncAll()`'s candidate set going forward. Surfaced in the dashboard with the
  same retirement reason a human sees today via `lastSyncError` — no new
  notification channel needed, since `CompanyWatchEvent` already exists as
  the notification primitive for this domain.
- Distinguish transient (site down, timeout) from structural (ATS type
  changed, adapter throws a parse error) failures using the typed error
  classes each `ats-adapters` adapter already throws (`AtsHttpError` vs. a
  parse/shape error) — structural failures fast-track to `DEGRADED` on the
  *first* occurrence rather than waiting for 3, since a parsing break won't
  self-heal the way a transient network blip might.

### 9. Priority adjustment

`priorityScore` (0–100, recomputed after every sync, same "computed on a
schedule, not per-request" discipline the quality audit specified for
`ProviderConfig.qualityScore`) drives `pollingInterval` directly:

- Rising `CompanyWatchEvent` `NEW_JOB` velocity (jobs/week, trailing 4-week
  window) → higher priority → shorter `pollingInterval`, floored at the same
  1-hour minimum `SyncSchedulerService.DEFAULT_SYNC_INTERVALS` already uses
  for its most active providers.
- Zero new jobs for 4+ consecutive syncs → lower priority → longer interval
  (up to a ceiling, e.g. 24h, matching `hn_hiring`'s existing "low update
  frequency" interval in `DEFAULT_SYNC_INTERVALS`) — a real, still-healthy
  company that just isn't hiring right now shouldn't be polled hourly forever.
  `DEGRADED`/`BROKEN` rows are additionally floored per §8, independent of
  job velocity.

### 10. Feedback loop from successful vacancy imports

Two lanes, kept separate deliberately (this is the same tenancy boundary
ADR-033 Question 1 already drew, applied to signal flow, not just code):

- **Within Company Watch** (the primary lane): `CompanyWatchEvent` NEW_JOB
  rows are the feedback signal — they drive §9's priority score directly. No
  new signal source needed; this data already exists and is already
  persisted per sync, just never read back.
- **Cross-pipeline** (rare, human-gated): if a discovered company turns out
  to be high-enough-volume and high-enough-quality to warrant becoming a
  global, multi-tenant `Provider` entry (the way Greenhouse/Lever/etc.
  already exist on both sides), that promotion is a **manual, one-time
  engineering action** — same as onboarding any new ATS provider today — not
  an automatic pipeline. Auto-promoting into the global Vacancy Sync pipeline
  would violate ADR-033's explicit rejection of merging the two tenancy
  models. This ADR's dashboard (§11) surfaces "this Company Watch entry has
  sustained N jobs/week for M weeks" as a *suggestion* for a human to
  consider that promotion, nothing more.

### 11. Dashboard additions

- New page: **Company Discovery** (`/app/company-discovery`) — review queue
  (§5), discovery source list (`DiscoverySource` config: enabled, last run,
  candidates found/enrolled/rejected per source — same shape as the existing
  Settings → Providers enable/disable/status page), and per-candidate
  confidence breakdown.
- Existing **Company Watch** page gains `healthStatus` and `priorityScore`
  badges next to each row (same `Badge` component already used for
  `active`/`lastSyncStatus`) — additive, no redesign.
- New lightweight `CompanyDiscoveryDiagnosticsService`
  (`apps/backend/src/services/`), same "thin aggregator over existing state"
  role `ProviderDiagnosticsService` already plays — do **not** extend
  `ProviderDiagnosticsService` itself, since Company Watch is a distinct
  bounded context from Provider (ADR-033), and conflating their diagnostics
  services would be the same mistake as conflating their sync pipelines.

### 12. Metrics

New `DISCOVERY_METRICS` constant set
(`packages/company-watch/src/observability/metrics.ts`, mirroring
`packages/providers/src/observability/metrics.ts`'s `PROVIDER_METRICS`
rather than overloading it with unrelated dimensions):

- `careeros.discovery.candidates_found` (per `DiscoverySource`)
- `careeros.discovery.candidates_deduplicated`
- `careeros.discovery.auto_enrolled`
- `careeros.discovery.review_queue_depth` (gauge)
- `careeros.discovery.rejected`
- `careeros.discovery.enrollment_to_first_job_latency_ms` (time from
  `ENROLLED` to first `CompanyWatchEvent NEW_JOB` — the platform's real
  "did this actually work" signal)
- `careeros.company_watch.health_transitions` (tagged by from/to state)
- `careeros.company_watch.retired_total`

All emitted through the existing `MetricsCollector` interface — no new
metrics backend.

### 13. Failure recovery

- Bulk source jobs are **incremental**, keyed by a stored watermark/cursor
  per `DiscoverySource` — same shape as `SyncCursor`
  (`packages/providers/src/interfaces/sync-cursor.ts`) already defined for
  provider fetchers. A failed or partial bulk run (e.g., a truncated Common
  Crawl file) simply doesn't advance the watermark; existing
  `CompanyCandidate` rows are untouched, and the next scheduled run re-covers
  the same window. No destructive re-processing.
- A single candidate's fingerprinting failure never blocks the batch — each
  candidate is its own BullMQ job (see §14), so one bad domain can't stall
  the other 9,999 in the same bulk-source run.
- All failures logged via the existing `Logger`/`Tracer` interfaces
  (`packages/providers/src/observability/`), consistent with every other
  pipeline in this codebase — no new logging surface.

### 14. Scalability analysis

- **Bulk parsing** (Common Crawl N-Quads): heaviest single job in the whole
  design. Runs as its own low-priority BullMQ queue/worker lane (separate
  concurrency group from the interactive sync queues, same isolation
  principle `apps/worker`'s existing per-domain queue split already applies),
  quarterly cadence per `free-provider-expansion/EPIC.md`'s own estimate.
- **Per-candidate fingerprinting**: must be concurrency-capped, not fired as
  N simultaneous requests — reuse the existing `TokenBucket` rate limiter
  (`packages/providers/src/rate-limit/rate-limiter.ts`) per target-domain
  and, more importantly, a global outbound-concurrency cap so a 50,000-domain
  Common Crawl batch doesn't open 50,000 sockets. Each candidate becomes one
  BullMQ job on a `company-discovery-fingerprint` queue with worker
  concurrency capped (e.g. 20) — standard BullMQ backpressure, no new
  mechanism.
- **`CompanyWatch` fan-out at scale — a pre-existing limit this ADR must not
  make worse.** `CompanyWatchService.syncAll()` today is a single in-process
  `for...await` loop over every active row — no concurrency, no queue. That
  is fine at today's near-zero enrolled-company volume but becomes the
  bottleneck the moment discovery starts growing the fleet 10–100x. **This
  ADR's one required change to existing code**: give `COMPANY_WATCH_QUEUE`
  (already declared, never wired) a real producer — a scheduler that enqueues
  one `COMPANY_WATCH_SYNC_JOB` per due `CompanyWatch` row (using
  `shouldSync()`, which already exists on the entity) — and a real consumer,
  `apps/worker/src/jobs/company-watch-sync-processor.ts`, following the exact
  convention `follow-up-reminder-processor.ts`/`vacancy-analysis-processor.ts`
  already establish. This turns `syncAll()`'s serial loop into
  worker-concurrency-bounded parallel jobs without inventing a new job
  system.
- **Postgres growth**: `CompanyCandidate` volume will be 10–100x
  `CompanyWatch` volume (most candidates get rejected or deduplicated).
  Needs the same TTL/archival treatment ADR-030 already flagged for
  `VacancyMergeAudit` — `REJECTED`/`DUPLICATE` rows older than N days purged
  by a scheduled job, not implemented in this pass but named here so it isn't
  rediscovered later as a surprise.

### 15. Cost estimation

- **No LLM cost.** Confidence scoring (§2) is deterministic, mirroring
  `MessageExtraction`'s own split between a cheap deterministic score and an
  optional AI self-report — this design skips the AI part entirely for
  discovery. This is a deliberate choice to keep bulk-scale discovery
  (potentially tens of thousands of candidates per Common Crawl run) cheap;
  if a future pass wants an LLM-assisted review-queue triage, budget it
  explicitly and separately, don't fold it into the required path.
- **Infra cost, in order of magnitude**: (1) Common Crawl file
  download/parse — bandwidth + compute for large N-Quads files, quarterly,
  the single largest one-off cost, already estimated as "~1–1.5 weeks" of
  engineering effort in `free-provider-expansion/EPIC.md`; (2) outbound HTTP
  volume for per-candidate fingerprinting probes, bounded by the concurrency
  cap in §14; (3) additional Postgres storage for `CompanyCandidate` rows,
  mitigated by the TTL policy in §14; (4) marginal — YC/CNCF/GitHub feeds are
  small, infrequent, cheap by comparison.
- **Engineering effort**: see Phase table below.

### 16. Operational considerations

- **Legal/ToS gating carries over unchanged** from `free-provider-expansion/
  REPORT.md`: respect `robots.txt` per source, no LinkedIn-style
  authenticated scraping, sitemap-only routes where a source's ToS
  disallows its `/api/`. This ADR adds no new legal surface — it only adds
  *automation* on top of sources whose legality was already vetted per-source
  in that report; a source not yet vetted there must not be added as a
  `DiscoverySource` without the same review.
- **Review queue needs a human owner and cadence**, same gap the quality
  audit already flagged for Telegram channel curation (Finding #5) — don't
  let this become an unowned queue that silently grows. Recommend the same
  weekly-review cadence proposed there.
- **Canary discipline, reused from ADR-033**: roll out one `DiscoverySource`
  at a time, observe yield/false-positive rate via §12's metrics before
  enabling the next, exactly the "one ATS at a time" discipline that shipped
  8 ATS migrations safely.
- **Auto-enrollment is reversible** — an auto-enrolled `CompanyWatch` row is
  deleted/deactivated through the exact same `removeCompany()`/update path a
  manually-added one uses; there is no separate "undo discovery" mechanism to
  build or maintain.

## Consequences

### Positive

- Company Watch goes from "zero autonomous operation" to a fully self-
  operating fleet — the most significant capability gap this ADR closes is
  the missing scheduler (§14), independent of discovery itself.
- No parallel confidence, dedup, retry, or health system is introduced — all
  five reuse existing, already-proven patterns from `MessageExtraction`,
  `DeduplicationEngine`, `ats-adapters`, and `VacancySource`.
- Review queue plus confidence-banded auto-enrollment gives a tunable
  precision/recall knob (raise or lower the 85/50 thresholds) without any
  code change, using a mechanism (score bands → tier-like routing) already
  proposed once before in this codebase's own quality audit.
- Company Watch's tenancy/pipeline separation from global Provider sync
  (ADR-033) is preserved, not eroded — discovery only ever produces
  `CompanyWatch` rows automatically; promotion to a global `Provider` stays
  human-gated.

### Negative

- `CompanyCandidate` is genuinely new persisted state (schema migration
  required) — the one piece of this design that isn't purely "wire up
  existing code."
- `CompanyWatch` lifecycle fields (`consecutiveFailureCount`, `healthStatus`,
  `priorityScore`) are additive schema changes touching a table every
  existing Company Watch route/service already reads — must be backward
  compatible (default `healthStatus: ACTIVE`, `consecutiveFailureCount: 0`,
  `priorityScore` computed lazily) so no existing code path breaks.
- Standing up even the "minimal" Common Crawl ingestion is real,
  non-trivial engineering (already estimated ~1–1.5 weeks in the prior
  EPIC) — the most expensive single piece of this whole platform.

## Proposed Phasing (specification only — not committed for implementation)

| Phase | Scope | Depends on |
|---|---|---|
| 0 | **Implemented.** Wire the dead `COMPANY_WATCH_QUEUE` to a real producer/consumer (§14) — makes today's Company Watch fleet actually self-schedule, with zero discovery involved. Ships value even if nothing else in this ADR is built. | Nothing new |
| 1 | **Implemented.** `CompanyWatch` lifecycle extension (§7/§8/§9): health states, priority score, retirement. | Phase 0 (needs the scheduler to observe sync outcomes continuously) |
| 2 | **Implemented.** `CompanyCandidate` schema + confidence model (§2) + single-shot discovery wired through it (reuses existing `CompanyDiscoveryService`, existing dashboard "Discover" button) — plus review-queue routing/approval (§4/§5 logic, no dashboard UI yet) and auto-enrollment into `CompanyWatch`, pulled forward from Phase 3 since they share the same `CompanyCandidate` lifecycle. No bulk sources yet. | Phase 1 |
| 3 | Review queue **dashboard UI** (§5) — the backend (routing/approval/rejection) shipped in Phase 2; this phase is just `apps/dashboard/src/app/app/company-discovery/page.tsx`. | Phase 2 |
| 4 | Bulk `DiscoverySource` ingestion — Common Crawl, YC, CNCF, Getro (§1, §14) — the heaviest phase, matches `free-provider-expansion/EPIC.md` Phase 3's original scope, now feeding the full pipeline instead of a human-run CSV. | Phase 3 |
| 5 | Metrics (§12), feedback-loop dashboard surfacing (§10), TTL/archival for rejected candidates (§14/§15). | Phase 4 |

This ADR intentionally stops at specification. Each phase above should get
its own implementation EPIC (following this repo's `epics/EPIC-NN-*.md`
convention) when work actually starts, per the standing "no implementation
yet" instruction for this pass.

## Related

- ADR-030 (Multi-Source Vacancy Support) — `VacancySource` lifecycle and
  priority model this ADR mirrors for `CompanyWatch`.
- ADR-032 (Social Message Platform) — confidence-rubric and capability-
  registry patterns this ADR reuses for discovery scoring.
- ADR-033 (Shared ATS Adapter Layer) — the ATS HTTP/parsing layer this
  entire platform is built on top of, and the tenancy boundary (Provider vs.
  Company Watch) this ADR deliberately does not cross.
- `research/free-provider-expansion/EPIC.md` Phase 3 — the original,
  narrower "CompanyWatch discovery infrastructure" proposal this ADR
  supersedes and expands.
- `research/provider-quality-audit/REPORT.md` Phase 6 — the tier/score-band
  pattern this ADR reuses for discovery confidence bands.
