# EPIC-18: Continuous Company Discovery

## Goal

Turn Company Watch from a manually-curated, manually-synced list into a
self-operating fleet that (a) keeps itself healthy without human babysitting
and (b) grows itself by continuously discovering new companies from
externally verifiable sources — without ever bypassing the existing
`CompanyWatch` enrollment/health/sync machinery or duplicating the ATS
adapter layer ADR-033 already built.

This is the implementation EPIC for [ADR-035](../adr/ADR-035-continuous-company-discovery-platform.md).
The ADR is the architecture reference; this document tracks what has actually
shipped, what's left, and the implementation decisions made along the way.

## Scope

In scope: `CompanyCandidate` staging pipeline, deterministic confidence
scoring, `CompanyWatch` health/priority lifecycle, self-scheduling sync, and
bulk `DiscoverySource` ingestion feeding the same pipeline.

Out of scope (unchanged from ADR-035): promoting a discovered company into
the global, multi-tenant `Provider`/Vacancy-Sync pipeline (stays a manual,
human-gated action); the Review Queue dashboard UI (Phase 3, backlog);
LLM-assisted discovery of any kind (confidence scoring is deterministic by
design, per ADR §2/§15).

## Architecture reference

[ADR-035: Continuous Company Discovery Platform](../adr/ADR-035-continuous-company-discovery-platform.md)
— read that document for the full Discovery → Confidence → Enrollment →
Health → Priority flow, the confidence rubric, and the reuse-before-creating
table. This EPIC only tracks phase status and implementation-level decisions.

## Phase status

### ✅ Phase 0 — Autonomous Company Watch — DONE

`COMPANY_WATCH_QUEUE`/`COMPANY_WATCH_SYNC_JOB` (declared in
`packages/shared/src/queues/company-watch.ts` since before this EPIC, but
previously dead — no producer, no consumer) now has both halves wired:

- Producer: `apps/worker/src/jobs/company-watch-scheduler-processor.ts` —
  `sweepDueCompanies()` scans all active `CompanyWatch` rows every
  `COMPANY_WATCH_SCHEDULER_SWEEP_INTERVAL_MS` (5 min) and enqueues one sync
  job per row whose `CompanyWatch.shouldSync()` is true, using `jobId:
  company.id` so BullMQ dedupes an already-queued company.
- Consumer: `apps/worker/src/jobs/company-watch-sync-processor.ts` — runs
  `CompanyWatchService.syncCompany()` per job.

### ✅ Phase 1 — Health Lifecycle — DONE

`CompanyWatch` gained `consecutiveFailureCount`, `healthStatus` (`ACTIVE` |
`DEGRADED` | `BROKEN` | `RETIRED`), `priorityScore`, and
`lastSuccessfulSyncAt` (`packages/database/prisma/schema.prisma`,
`CompanyWatch` model). Transition logic lives on the `CompanyWatch` entity
(`packages/company-watch/src/domain/entities/company-watch.ts`) and
`packages/company-watch/src/domain/health.ts`:

- Same 3-consecutive-failures threshold as `VacancySource`/`SyncSchedulerService`
  (`UNHEALTHY_AFTER_CONSECUTIVE_FAILURES`), not a new, disagreeing threshold.
- `AtsHttpError` (transient) vs. any other thrown error (structural) —
  structural failures fast-track to `DEGRADED` on the first occurrence.
- `BROKEN` ≥ 14 days continuous → `RETIRED`, `active = false`, excluded from
  `syncAll()`'s candidate set.
- `priorityScore` recomputed from trailing 4-week `NEW_JOB` event velocity,
  drives `pollingInterval` directly (floored/ceilinged per ADR §9).

### ✅ Phase 2 — CompanyCandidate Pipeline — DONE

New entity `CompanyCandidate` (`packages/company-watch/src/domain/entities/company-candidate.ts`),
lifecycle `DISCOVERED → AUTO_APPROVED | REVIEW_REQUIRED | REJECTED →
CONVERTED`. Deterministic confidence rubric in
`packages/company-watch/src/domain/discovery-confidence.ts`
(`DISCOVERY_CONFIDENCE_VERSION = 1`, weighted categories per ADR §2, bands
`>=85` auto-enroll / `50-84` review / `<50` reject). Orchestrated by
`CompanyDiscoveryIntakeService` (`packages/company-watch/src/services/company-discovery-intake-service.ts`):
dedup (`CandidateDeduplicationService`, reuses `@careeros/shared`'s
Levenshtein similarity) → fingerprint (existing `CompanyDiscoveryService`,
unmodified) → probe (`AtsAdapterRegistry.ping`/`fetchJobs` dry-run) → score →
route → auto-convert into `CompanyWatch` via the *existing*
`CompanyWatchService.addCompany()` (no parallel persistence path). Backend
routes: `apps/backend/src/routes/company-discovery/company-discovery-routes.ts`
(list/get/discover/approve/reject — no dashboard UI yet, intentionally).

### ⬜ Phase 3 — Review Queue UI — BACKLOG

Backend (routing/approval/rejection) shipped in Phase 2. This phase is only
`apps/dashboard/src/app/app/company-discovery/page.tsx`. **Explicitly not
started in this pass** — the backend API already exists and is usable via
direct API calls; the UI is not on the critical path while Phase 4 (growing
the candidate pool) is the priority.

### 🔄 Phase 4 — Discovery Sources — IN PROGRESS (this EPIC's current focus)

Bulk `DiscoverySource` ingestion feeding the same `CompanyCandidate`
pipeline Phase 2 already built — no second enrollment path, no bypass of
`CompanyWatch`. See "Phase 4 implementation notes" below for per-source
status, what was live-verified vs. structurally-complete-but-gated, and why
Getro/Consider were deferred rather than built speculatively.

### ⬜ Phase 5 — Metrics / Feedback / TTL — BACKLOG

`DISCOVERY_METRICS` constants exist (`packages/discovery-sources/src/observability/metrics.ts`,
per ADR §12) and are emitted by the Phase 4 orchestrator, but the *dashboard
surfacing* of those metrics, the `enrollment_to_first_job_latency_ms`
feedback loop (ADR §10), and TTL/archival for stale `REJECTED`/`DUPLICATE`
`CompanyCandidate` rows (ADR §14) are not built in this pass.

## Phase 4 implementation notes

### Major decisions

- **New package, not folded into `packages/company-watch`.** ADR-035's own
  reuse table calls out bulk-source ingestion as the one genuinely new
  responsibility warranting a new package. `packages/discovery-sources` owns
  fetching/parsing external bulk sources into raw `{name, domain,
  sourceUrl}` tuples; it depends on `@careeros/company-watch` (to call the
  existing `CompanyDiscoveryIntakeService.discover()` per tuple — same
  intake path single-shot discovery already uses, per ADR §1's "both intake
  shapes feed the same `CompanyCandidate` staging table, don't build two
  pipelines") and `@careeros/providers` (reused `RetryPolicy`,
  `TokenBucketRateLimiter`, `Logger`, `MetricsCollector` — confirmed via
  Graphify to be dependency-free, generic utilities already exported from
  `providers/src/index.ts`, not coupled to Provider-pipeline tenancy).
- **`CompanyDiscoveryIntakeService.discover()` extended, not duplicated.**
  Added an optional `sourceAuthorityScore` to `DiscoverCandidateInput`
  (defaults to `SINGLE_SHOT_SOURCE_AUTHORITY_SCORE` when omitted, so Phase
  2's single-shot dashboard "Discover" flow is byte-for-byte unchanged).
  Bulk sources now pass their own authority score (ADR §2: YC/CNCF/GitHub
  curated sources score higher than a bare Common Crawl URL-pattern hit).
- **Common Crawl implemented via the CC-Index CDX API, not raw WARC/N-Quads
  parsing.** Live-verified against `index.commoncrawl.org` during this pass:
  querying `url=boards.greenhouse.io/*&output=json` (NDJSON) returns real,
  current URL matches with extractable company slugs
  (`boards.greenhouse.io/{slug}/jobs/...`). This is the same underlying
  data ADR §1's original "Common Crawl JobPosting extract" scoped, reachable
  without downloading and streaming multi-GB WARC/N-Quads files — a
  materially cheaper implementation of the same discovery goal (find
  companies on known ATS vendors from crawl data).
- **Web Data Commons JobPosting dataset: structurally complete, disabled by
  default.** The WDC schema.org JobPosting extract is a legitimate,
  quarterly-cadence, multi-GB corpus (per ADR §14/§15's own cost framing) —
  not something this pass can download and live-verify end-to-end. The
  ingestion code (streaming NDJSON parser, `hiringOrganization`/`url`
  extraction, incremental cursor) is real and unit-tested against
  synthetic fixtures shaped like WDC's documented schema, but the
  `DiscoverySource` config row ships `enabled: false` pending a human
  supplying the actual subset file URL from WDC's download portal — same
  "shipped, structurally correct, gated on an external prerequisite" pattern
  this repo already used for the France Travail provider
  (`research/free-provider-expansion/EPIC.md` Phase 2, item 5).
- **Getro and Consider: deferred, not built.** ADR §1 itself flags these as
  "non-JS-rendered boards only" with a caveat that several are JS-rendered
  SPAs that "may need to defer to a later pass." Live-checked during this
  pass: `jobs.getro.com/api/v2/collections` → `403`; a known Getro-powered
  VC board returned no usable server-rendered response. Building against
  either would mean either reverse-engineering an undocumented, bot-gated
  API (no ToS clarity) or standing up headless-browser scraping (a new,
  heavier capability this repo doesn't have and ADR-035 doesn't ask for) —
  both fail the standing "reuse only verified sources" / "no speculative
  providers" instruction. Left for a future pass once a specific,
  ToS-cleared Getro/Consider board is identified and manually verified,
  exactly the gate ADR §16 already requires for any new source.
- **Sitemap / robots.txt / JSON-LD / RSS sources are CC-Index-seeded, not
  standalone crawlers.** None of these can discover a *new* company from
  nothing — each needs a candidate domain first. All four reuse the same
  `CommonCrawlIndexClient` (querying CC-Index for `*/sitemap.xml`,
  `*/robots.txt`, or generic page matches with status 200) and differ only
  in their per-match content parser (sitemap → look for `/careers`/`/jobs`
  URLs; robots.txt → look for `Sitemap:` directives and job-related
  `Disallow` entries; RSS → validate a matched feed URL has job-shaped
  items; JSON-LD → fetch the matched page and extract `@type: JobPosting`).
  This is one reusable HTTP+pagination client with five thin, independently
  testable extractors — not five separate crawler implementations.
- **GitHub Organizations resolves a seed org list, doesn't search GitHub at
  large.** `GET /orgs/{login}` (live-verified against `cncf` and `stripe`)
  returns `name` + `blog` (company site URL) for a known org login. Given a
  seed list (CNCF members, curated awesome-lists), this resolves org →
  company website cheaply. Unauthenticated GitHub API is rate-limited to
  60 req/hour; an optional `GITHUB_TOKEN` env var raises this to 5,000/hour,
  following the same "conditionally registered, needs credentials" pattern
  France Travail already established in this codebase.
- **CNCF landscape parsed for `name` + `homepage_url` only.** Live-verified
  against `raw.githubusercontent.com/cncf/landscape/master/landscape.yml`
  (2,412 real entries extracted in a live parse during this pass). Per
  `REPORT.md` §4.4's licensing caveat (already cited in ADR-035 §1), this
  pass extracts only project/company name and homepage URL — not the
  Crunchbase-blended fields the same file also carries.
- **Common Crawl records prefer their own redirect target over a
  pattern-derived URL.** End-to-end manual verification surfaced a real
  case: Greenhouse's legacy `boards.greenhouse.io` host now 301-redirects to
  `job-boards.greenhouse.io` for at least some tenants; Common Crawl's CDX
  record for that capture carries the redirect target directly.
  `CommonCrawlAtsDiscoverySource` now prefers `record.redirect`'s host+slug
  when present (`resolveCareerUrl()`), so a candidate isn't pointed at a
  possibly-retired host. This was found and fixed during manual
  verification, not anticipated up front — left as a concrete example of
  why the manual verification step matters even for "obviously live-tested"
  sources.

### Components reused (no parallel implementation)

- `CompanyDiscoveryIntakeService` (dedup → fingerprint → score → route →
  convert) — every bulk source feeds this, none bypass it.
- `CandidateDeduplicationService` / `@careeros/shared`'s Levenshtein
  similarity — no second fuzzy-matcher.
- `CompanyDiscoveryService` (fingerprinting) — unmodified.
- `AtsAdapterRegistry` — unmodified, used for the existing ping/fetchJobs
  dry-run probe.
- `CompanyWatchService.addCompany()` — the only path into `CompanyWatch`,
  bulk or single-shot.
- `@careeros/providers`' `TokenBucketRateLimiter` (used as-is, per-hostname,
  by every CC-Index-seeded source's page fetcher), `Logger`, `MetricsCollector`
  — no new rate-limit/logging primitives. Bulk-fetch retry
  (`retry-fetch.ts`) reuses `RetryPolicy`'s exact config numbers (3 attempts,
  1s/30s/2x backoff, jitter) rather than importing `RetryPolicy` itself,
  since that class is typed against `ProviderResult`/`ProviderError`
  (provider-pipeline-specific) and forcing bulk sources to speak that shape
  for no behavioral benefit would be needless coupling.
- `SyncCursor`-shaped watermarks (`packages/providers/src/interfaces/sync-cursor.ts`
  convention) for each `DiscoverySource`'s incremental state.

### Manual verification results (2026-07-31)

Ran `CncfLandscapeDiscoverySource`, `GitHubOrgsDiscoverySource`, and
`CommonCrawlAtsDiscoverySource` end-to-end through `DiscoveryBulkIngestService`
against their real, live external APIs, feeding the real (unmodified)
`CompanyDiscoveryIntakeService` → `CompanyDiscoveryService` →
`AtsAdapterRegistry` → `computeDiscoveryConfidence` chain, using in-memory
`CompanyCandidateRepository`/`CompanyWatchRepository`/`DiscoverySourceConfigRepository`
(no live Postgres available in this environment — the Prisma implementations
of the first two are Phase 2's own already-tested code; `PrismaDiscoverySourceRepository`
is a thin CRUD wrapper of the same proven shape as `PrismaProviderConfigRepository`).

Results: 13 real candidates found across 3 sources (CNCF project pages,
one GitHub org profile, four Common-Crawl-matched Greenhouse/host slugs).
Confirmed: sources execute against live endpoints; candidates persist with
discovery source/timestamp/ATS fingerprint/confidence breakdown/crawl
metadata intact; re-running a source against the same URLs is idempotent
(no duplicate rows — the existing exact-URL check short-circuits); the
deterministic confidence rubric produced differentiated, explainable scores
(69 for a real company homepage with a detected job signal vs. 22–47 for
open-source project pages with no job board). 0 of the 13 sampled candidates
auto-enrolled or reached the review band in this small sample — see "Known
limitations" below for why, and why that's the existing rubric working as
designed rather than a Phase 4 defect.

### Known limitations

- Per-candidate fingerprinting during a bulk run is concurrency-capped via
  a bounded worker pool (`runWithConcurrency`, default 5) within one
  worker job, but is not yet its own BullMQ queue-per-candidate (ADR §14's
  "each candidate becomes one BullMQ job on `company-discovery-fingerprint`"
  is not built) — a very large single source run still processes candidates
  within one worker job rather than fanning out across the cluster. Fine at
  current volumes; revisit if a source's candidate count grows into the
  thousands per run.
- Real Greenhouse/Lever/etc. companies discovered via
  `CommonCrawlAtsDiscoverySource` frequently land in `REJECTED` rather than
  `AUTO_APPROVED`/`REVIEW_REQUIRED` today — confirmed during manual
  verification (10xgenomics, 2k both fingerprinted as `GREENHOUSE` but
  scored `reachability: 0`). Root cause: `AtsAdapterRegistry`'s
  `ping()`/`fetchJobs()` probe (existing Phase 2 code, unmodified here)
  needs a resolved `atsEndpoint` for a confident reachability check, which
  `CompanyDiscoveryService`'s HEURISTIC_MATCH tier (host string present but
  no structured `boards-api.greenhouse.io/...` match in the page) doesn't
  provide. This is conservative-by-design (never auto-enroll on a weak
  signal) but means Phase 4's real yield is currently gated by Phase 2/
  ADR-033 fingerprinting depth, not by discovery-source coverage. Improving
  this is `ats-adapters`/`CompanyDiscoveryService` work, out of scope here
  given its blast radius (shared with the Provider pipeline) — flagged for
  a future pass rather than patched speculatively in this one.
- No TTL/archival for `REJECTED`/`DUPLICATE`-adjacent candidates yet (Phase 5).
- No dashboard surfacing of `DiscoverySource` run history/yield (Phase 3/5,
  UI not built) — status is readable via the backend repository/API only.

### Future improvements

- Once a specific ToS-cleared Getro or Consider board is identified, add it
  as a source following the exact `DiscoverySourceFetcher` shape already
  established — no framework change needed.
- Wire the WDC source's file URL once provisioned, flip `enabled: true`,
  canary per ADR §16's one-source-at-a-time discipline.
- Phase 3 (Review Queue UI) and Phase 5 (metrics dashboard, feedback loop,
  TTL) remain the natural next EPICs.

## Acceptance criteria

- [x] `CompanyCandidate` schema, confidence rubric, and single-shot intake
      pipeline shipped and tested (Phase 2, pre-existing).
- [x] `CompanyWatch` self-scheduling sync and health/priority lifecycle
      shipped and tested (Phase 0/1, pre-existing).
- [x] At least one bulk `DiscoverySource` live-verified end-to-end against
      its real external API/endpoint.
- [x] Every bulk source feeds the existing `CompanyCandidate` pipeline —
      no second enrollment path, no `CompanyWatch` bypass.
- [x] Deduplication reuses the existing Levenshtein similarity utility — no
      second fuzzy-matching implementation.
- [x] Confidence scoring remains deterministic — no LLM/AI call anywhere in
      the discovery path.
- [x] Every `CompanyCandidate` produced by a bulk source preserves discovery
      source, discovery timestamp, ATS fingerprint (once fingerprinted),
      confidence (once scored), and source-specific crawl metadata.
- [x] `typecheck`, `lint`, `test`, `build` pass with the new package wired
      into the monorepo.
- [ ] Review Queue dashboard UI (Phase 3) — explicitly out of scope for
      this pass.
- [ ] Metrics dashboard, feedback loop, TTL/archival (Phase 5) — explicitly
      out of scope for this pass.
