# ADR-032: Social Message Platform & Telegram Provider V1 → V2 Migration

## Status

Accepted

## Date

2026-07-27

## Context

EPIC-12 introduces a platform-agnostic Social Message Platform: any community
source (Telegram today; Discord/Slack/Reddit/X/VK/etc. later) should be
ingestible through a common `SocialMessageTransport` → `SocialMessage` →
AI extraction pipeline, rather than every platform reimplementing its own
scraping-to-vacancy logic the way Telegram V1 does today.

An architecture audit (Graphify-assisted) of the in-progress EPIC-12 work
found:

1. Only the domain model (`SocialMessage`, `MessageExtraction`) existed —
   no transport, no extraction engine, no pipeline. `SocialMessage` was
   incorrectly hard-FK'd to `TelegramChannel` and its transport enum was
   named `TelegramTransportType`, both baking Telegram into a layer meant
   to be platform-agnostic. **Fixed prior to this ADR**: `SocialMessage`
   now carries generic `sourceId`/`sourceName` strings instead of an FK,
   and the enum is `TransportType`. `SocialMessageRepository` was brought
   in line with this codebase's domain-entity/repository/mapper convention.
2. **Telegram Provider V1 already exists and is in production.** It scrapes
   each channel's public `t.me/s/<channel>` preview page
   (`packages/providers/src/providers/telegram/telegram-fetcher.ts`), maps
   and normalizes posts with **regex** (`telegram-mapper.ts`,
   `telegram-normalizer.ts`) directly into a `NormalizedVacancy`, and is
   registered as an ordinary provider (`createTelegramProvider()` in
   `apps/backend/src/container.ts`) driven by the same generic
   `SyncSchedulerService` → `ProviderRegistry` → dedup
   (`VacancySourceRepository`) → persistence (`VacancyRepository`) path
   every other provider uses. Crucially, **none of the downstream systems —
   Provider Dashboard, matching (`packages/ai/src/matching`), ATS scoring,
   recommendations, or analytics — know Telegram exists**; they all operate
   generically on `Vacancy`/`VacancySource` keyed by `providerId` string.
3. Both V1 and the new `TelegramChannel`/`TelegramChannelSubscription`
   config tables are already shared: V1's `channelProvider` already reads
   channel usernames from `TelegramChannel` via
   `PrismaTelegramChannelRepository.findEnabledUsernames()`.

The open question this ADR resolves: how does Telegram move from V1's
regex-based extraction to V2's AI-based `SocialMessage`/`MessageExtraction`
pipeline without ever running two permanent, parallel "Telegram → Vacancy"
code paths.

## Decision

**V2 does not replace V1 by building a second, independent pipeline. It
replaces the two provider-specific stages of the existing generic pipeline
for the `'telegram'` provider ID, and nothing else.**

The existing provider contract is exactly:

```
Fetcher (RawJob) → Mapper (MappedJob) → Normalizer (NormalizedVacancy)
  → SyncStrategy → PipelineOrchestrator → dedup (VacancySource) → persistence (Vacancy)
```

Only `Mapper` and `Normalizer` are provider-specific plug points; everything
from `SyncStrategy` onward (dedup, persistence, dashboard, matching, ATS,
recommendations, analytics) is generic infrastructure already shared by all
23 providers. So the migration is:

```
TelegramFetcher (unchanged)
  → [V2] write SocialMessage (Layer 1, already built)
  → [V2] MessageExtractionEngine → MessageExtraction (Layer 2, EPIC-12 Phase 4/5)
  → [V2] SocialMessageNormalizer: MessageExtraction → NormalizedVacancy
       (new Mapper+Normalizer pair implementing the EXISTING interfaces,
        gated on MessageExtraction.deterministicConfidence per ADR/Phase 6 —
        rows below threshold never reach this step, matching
        MessageProcessingStatus.LOW_CONFIDENCE/SPAM)
  → (existing, unchanged) TelegramSyncStrategy → PipelineOrchestrator
  → (existing, unchanged) VacancySourceRepository dedup → VacancyRepository persistence
  → (existing, unchanged) Dashboard, matching, ATS, recommendations, analytics
```

`ExtractedVacancyFields` (`packages/ai/src/extraction/social-message-extraction-schema.ts`)
was defined now, ahead of the extraction engine itself, specifically so that
whatever produces it is designed from day one to map cleanly onto
`NormalizedVacancy` — this is the seam the future `SocialMessageNormalizer`
implements.

### Answers to the specific migration questions

**1. Complete replacement or coexistence?** Temporary coexistence, exit-criteria-bound, not calendar-bound. V1 (`TelegramMapper`/`TelegramNormalizer`) keeps running as the sole producer of Telegram vacancies until V2's extraction pipeline (Phases 2–7) is built and validated. There is never a point where both V1 and V2 write `Vacancy`/`VacancySource` rows for the same message — that would double-count through dedup and violate "never duplicate Vacancy."

**2. Coexistence definition:**
- **Duration**: bounded by an exit test, not a date — V2 cuts over once its `Mapper`+`Normalizer` pair, run in **shadow mode** (executed against live channels, results logged/compared but not persisted) for at least 2 consecutive sync cycles per channel, matches or exceeds V1 on: imported-vacancy volume, and manual-sample extraction accuracy.
- **V1 components** (kept as-is, untouched, until cutover): `TelegramFetcher` (also reused by V2 — it's just an HTTP scraper, no reason to fork it), `TelegramMapper`, `TelegramNormalizer`.
- **V2 components** (built across Phases 2–7): `SocialMessageTransport`/`HtmlPreviewTransport`/`BotApiTransport` (wrapping the same fetch mechanics `TelegramFetcher` already has), `MessageExtractionEngine`, a `SocialMessageNormalizer` implementing the existing `Mapper`+`Normalizer` interfaces against `MessageExtraction` output.
- **Cutover point**: a single line in `apps/backend/src/container.ts`'s `createTelegramProvider()` call — the `Mapper`/`Normalizer` arguments swap from `new TelegramMapper()`/`new TelegramNormalizer()` to their V2 equivalents. No other file changes: `ProviderRegistry`, `SyncSchedulerService`, dashboard, dedup, matching, ATS, recommendations, analytics are all unaffected because they only ever depended on the generic contract.
- **V1 removal conditions**: once the V2 swap has run in production for an agreed burn-in period with no regression in sync success rate or dashboard metrics, delete `TelegramMapper`, `TelegramNormalizer`, and their tests in the same cleanup PR that removes the shadow-mode comparison code. No dead code, no permanent flag.

**3. Single production pipeline.** Yes — exactly one `'telegram'` provider registration exists in `container.ts` at all times; "V1" and "V2" are two temporary implementations of its `Mapper`/`Normalizer` slots, not two providers.

**4. No second `NormalizedVacancy` path.** Confirmed by construction: there is one call site that constructs the Telegram `DefaultProviderJob` (`createTelegramProvider()`), and it accepts exactly one `Mapper` and one `Normalizer`. The migration is a swap at that call site, not an addition.

**5/6. No functionality loss; Dashboard/Sync Scheduler/Recommendations/Matching/ATS/Analytics keep working throughout.** These systems have zero Telegram-specific code today (confirmed by audit) — they only see `providerId: 'telegram'` and generic `Vacancy`/`VacancySource` rows. Since the migration never changes their inputs' shape or the provider registration surface, they require no changes and see no downtime at any point in the migration.

## Addendum: generic transport capability model (2026-07-27)

Before Phase 2 implementation started, the transport layer design was
generalized so it's never Telegram-specific, even in the abstractions:

- **`TransportCapability`** (`packages/providers/src/interfaces/
  transport-capability.ts`): `PULL | PUSH | API | BROWSER | FILE | STREAM` —
  the axis a provider's transports are classified by, independent of
  platform. Telegram will register `HtmlPreviewTransport` (PULL) and
  `BotApiTransport` (API); Discord would register a `GatewayTransport`
  (STREAM) and a `RESTTransport` (API); Slack an Events API (PUSH) and Web
  API (API); Reddit an API (API) and RSS (PULL) transport — same interfaces,
  no pipeline change.
- **`SocialMessageTransportRegistry`** (`packages/providers/src/registry/
  social-message-transport-registry.ts`) dispatches by `(providerId,
  capability)`, mirroring the existing `ProviderRegistry.getByCapability()`
  pattern used for job providers. Callers ask "give me this provider's API
  transport", never "if providerId === 'telegram' use HtmlPreviewTransport".
- **`SocialMessageTransport`** (`packages/providers/src/interfaces/
  social-message-transport.ts`) is scoped to exactly one job — `fetch()` →
  `SocialMessageCandidate[]`, `validate()` — with a doc comment stating it
  must not map, normalize, extract, dedupe, or persist. `platform` and
  `contentHash` are deliberately excluded from `SocialMessageCandidate`: the
  orchestrator attaches `platform`, and `contentHash` is computed once
  centrally so transports never duplicate that hash function.
- `transportType` is a plain `string` on the interface, not an imported
  `@careeros/career` enum — `packages/providers` has no dependency on
  `@careeros/career` today (mirrors the existing local `VacancySource =
  string` in `packages/providers/src/types/provider.ts`), so adding a new
  transport kind never requires a cross-package change. The mapping to the
  DB-backed `TransportType` enum happens once, at the persistence boundary.
- Phase 2 implementations (`HtmlPreviewTransport`, `BotApiTransport`) must
  reuse existing infrastructure rather than reimplement it: `resilientFetch`
  (`packages/providers/src/resilience/resilient-fetch.ts`) for HTTP/timeout/
  built-in rate limiting, `RetryPolicy` for retry/backoff, the `TokenBucket`
  rate limiter (`packages/providers/src/rate-limit/rate-limiter.ts`), and the
  `Logger`/`MetricsCollector`/`Tracer` observability interfaces —  the same
  building blocks `TelegramFetcher` already uses. `HtmlPreviewTransport`
  specifically should wrap `TelegramFetcher`'s existing scrape mechanics
  rather than reimplementing `/s/<channel>` scraping from scratch.

## Consequences

- Phase 2 (transport layer) must **not** give transports any responsibility beyond producing `SocialMessage` rows (per EPIC-12's own scope: "Nothing else") — mapping/normalization/persistence stays entirely in the future `Mapper`/`Normalizer` pair, preserving the single swap point above.
- Phase 4/5 (extraction engine, pipeline) must produce `MessageExtraction` rows whose `extractedFields` conform to `ExtractedVacancyFields`, because that's the documented contract the future `SocialMessageNormalizer` will adapt into `NormalizedVacancy`.
- No shadow-mode comparison tooling exists yet — it's a prerequisite for cutover, not for Phase 2, and should be scoped when Phase 4/5 land.

## Addendum: Phase 2.5 — wiring the transport layer into the real sync flow (2026-07-27)

Phase 2 built the transport layer but left it deliberately unwired
(`registerSocialMessageTransports()` in `apps/backend/src/container.ts`
constructed its own `TransportManager` that nothing called). Before starting
Phase 4/5 (`MessageExtractionEngine`), a narrow Phase 2.5 validates the
transport architecture against the real running app — no AI, no
`MessageExtraction`, no Vacancy-pipeline changes:

1. **V1's `TelegramFetcher` instance now routes through `TransportManager`
   instead of scraping directly.** `TelegramFetcherConfig` gained an optional
   `transportManager`; when set, `search()`/`getVacancy()` call
   `transportManager.fetch('telegram', { sourceId: channel }, { capability: 'PULL' })`
   and map the returned `SocialMessageCandidate[]` back to
   `TelegramRawMessage[]`, then continue through the **unchanged**
   `buildRawJob`/classification path. The `RawJob[]` output contract to
   Mapper/Normalizer/SyncStrategy is identical to before, so dedup,
   persistence, Dashboard, matching, ATS, recommendations, and analytics are
   unaffected — this is a narrower breach of "V1 kept as-is" than it looks:
   only the fetch *mechanism* changed, not V1's output or its Mapper/
   Normalizer. The `TelegramFetcher` instance `HtmlPreviewTransport` itself
   wraps (constructed in `registerSocialMessageTransports()`) is a distinct
   instance with no `transportManager` configured, so it still does the real
   `t.me/s/<channel>` scrape — there is no circular fetch and no second
   scraping implementation.
2. **New `SocialMessageIngestionService`** (`apps/backend/src/services/`) is
   the only place that calls `TransportManager.fetch()` and persists
   `SocialMessage` rows — kept out of `packages/providers` because
   `TransportManager` must never map/normalize/persist (its own doc comment)
   and `packages/providers` has no dependency on `@careeros/career`. Every
   valid `SocialMessageCandidate` is checked against
   `findBySourceAndExternalId` first (rows are immutable once written) and
   only upserted if new — this is both the idempotency guarantee and the
   duplicate-count metric.
3. **Cursors** are derived from `SocialMessageRepository.findLatestBySource(platform, sourceId)`
   (new repository method, no migration) rather than any in-memory provider
   state, so incremental fetching survives restarts. The cursor shape
   (`TransportCursor { since?, maxResults? }`) was already platform-agnostic;
   nothing Telegram-specific was added to it.
4. **Wiring trigger**: `SyncSchedulerService` gained one generic,
   provider-agnostic constructor hook, `onProviderSynced?(providerId)`, fired
   after a successful `provider.sync()`. The container wires it to run
   `SocialMessageIngestionService.ingestSource()` per configured Telegram
   channel only when `providerId === 'telegram'` — `SyncSchedulerService`
   itself contains no Telegram-specific code.
5. **`TransportManager.fetch()`** now surfaces `transportType` via
   `meta.providerMeta.transportType` on success, so callers can record which
   transport served a request without reaching into internals — needed to
   persist `SocialMessage.transport`.

No AI, `MessageExtraction`, or Vacancy normalization was introduced in this
phase. Phase 4/5 (extraction engine) remains the next step.

## Addendum: Phase 3 — MessageExtractionEngine (2026-07-27)

Scope, per the original "Nothing else" framing: `SocialMessage in -> validated,
deterministically-scored MessageExtraction out`, persisted. No Telegram
knowledge, no `NormalizedVacancy`, no dedup, no recommendations — those stay
Phase 4/5+.

1. **Domain object location.** `MessageExtraction`/`MessageExtractionRepository`
   live in `packages/ai/src/domain/`, not `@careeros/career`, mirroring
   `MatchResult`/`TailoredResume` — plain interfaces + a `createMessageExtraction()`
   factory, not an `Entity`/`AggregateRoot` class. Reasoning: `packages/ai`
   depends on `@careeros/career`, never the reverse, so any AI-produced,
   AI-package-owned result (already true of `MatchResult`, `TailoredResume`)
   has to live on the `ai` side of that boundary; `packages/database` implements
   the repository importing types from `@careeros/ai`, exactly like
   `PrismaMatchResultRepository`. The status enum is named
   `MessageExtractionStatus`, not `ExtractionStatus`, because `@careeros/career`
   already exports an unrelated `ExtractionStatus` (resume-extraction
   lifecycle) — a same-named export from `@careeros/ai` would collide for any
   caller importing both.
2. **`MessageExtractionEngine`** (`packages/ai/src/extraction/message-extraction-engine.ts`)
   reuses the exact primitives `MatchingEngine` already established — `AIProvider`,
   `AICache`, `CostTracker`, `AILogger`/`AIMetricsCollector`/`AITracer` — rather
   than a second execution/retry/cache framework. Two differences from
   `MatchingEngine`/`ResumeExtractionEngine`, both deliberate:
   - **Validation is inside the retry loop**, not after it. A response that
     fails `extractedVacancyFieldsSchema.parse()` is treated as a retryable
     failure (an LLM producing bad JSON once and good JSON on the next attempt
     is common) instead of being thrown immediately the way
     `ResumeExtractionEngine.parseResponse()` does. Only once retries are
     exhausted does the engine give up.
   - **No `UsageRecorder`.** `AIUsage.userId` is a hard FK to `User`, and
     message extraction runs against public channel content with no owning
     user — there is no valid `userId` to attribute the spend to. Cost/token
     observability instead goes entirely through `CostTracker` + `AI_METRICS`
     (neither needs a user), per the phase's own observability requirements.
   - Idempotency has two independent layers, checked in order: (1)
     `MessageExtractionRepository.findByContentHashAndPrompt(contentHash,
     provider, model, promptChecksum)` — an exact replay of the same message
     against the same reproducibility tuple reuses the existing row and never
     calls the provider; (2) `AICache`, keyed by
     `computeMessageExtractionCacheKey({contentHash, provider, model,
     promptChecksum})` (`message-extraction-cache-key.ts`) — deliberately a
     dedicated key function rather than reusing `computePromptHash()`, because
     that one doesn't hash `provider` at all and only cheaply captures content
     via the assembled prompt text, whereas this phase's spec calls out the key
     shape explicitly. Layer 2 only ever caches a response that already passed
     schema validation once, so a cache hit is replayed without re-validation.
3. **`MessageExtractionPromptBuilder`** (`packages/ai/src/prompts/message-extraction.ts`)
   is the one production prompt (per phase scope: "Create one production
   prompt only"). JSON-only response, no markdown/prose, one extra top-level
   `confidence` key (the AI's own self-estimate) kept structurally separate
   from `extractedVacancyFieldsSchema` — it is read directly off the raw
   parsed JSON and stored as `MessageExtraction.aiSelfReportedConfidence`,
   never blended into the deterministic score. The prompt requires a verbatim
   evidence quote for every populated scalar field, which is what deterministic
   confidence scoring verifies against.
4. **Deterministic confidence** (`packages/ai/src/extraction/message-extraction-confidence.ts`)
   is a weighted-category rubric computed entirely in code, mirroring
   `computeAtsScore`'s "applicable category" pattern (ADR-031): title,
   company, technologies, location, employment/remote type, and
   requirements/responsibilities presence, plus an evidence-integrity category
   that re-checks each populated scalar field's cited quote actually appears
   (normalized substring match) in `SocialMessage.rawText` — a field whose
   evidence can't be verified counts against the score, catching
   hallucination that a purely "is this field populated" check would miss.
   `classifyMessageExtractionStatus()` derives `SUCCESS`/`LOW_CONFIDENCE`/`SPAM`
   from the score plus whether any job-related signal was found at all
   (`MESSAGE_EXTRACTION_LOW_CONFIDENCE_THRESHOLD = 40`, versioned as a named
   constant). This is the number Phase 6's `SocialMessageNormalizer` gate
   reads — it never sees `aiSelfReportedConfidence`.
5. **Persistence.** `MessageExtraction` rows are append-only (`save()` always
   `create()`s, never upserts) — `packages/database/prisma/schema.prisma`'s own
   comment on the model states one message can accumulate multiple extraction
   rows over time, which is what makes reprocessing with a new prompt version
   possible. A failed attempt (schema validation exhausted, or a hard provider
   error) still persists exactly one row — status `PARSE_ERROR`/`PROVIDER_ERROR`,
   `extractedFields` defaulted to the schema's all-null/empty shape (never the
   malformed raw payload), `deterministicConfidence: 0` — so "invalid responses
   must never be persisted" is read as "never persist a fabricated/malformed
   *payload*," not "never record that an attempt failed." The
   `ExtractionStatus` values (`SUCCESS`/`PARSE_ERROR`/`PROVIDER_ERROR`/
   `LOW_CONFIDENCE`/`SPAM`) already existed on the Prisma model before this
   phase specifically to support this.
6. **Wiring.** `apps/backend/src/container.ts` constructs
   `messageExtractionEngine` (own `AICache`/`CostTracker`/`AITracer`
   instances, same convention as `matchingEngine`) and exposes it as a
   top-level `Container` field, documented inline as not yet wired to any
   trigger — no pending-message loop exists yet. That loop, plus
   `SocialMessageNormalizer: MessageExtraction -> NormalizedVacancy`, is
   Phase 4/5+ per the original migration table above; this phase stops at "a
   validated `MessageExtraction` stored in the database."

### Phase 3 completion status (2026-07-29)

Phase 3 is complete and stops exactly at the scope above — no Phase 4/5
(`SocialMessageNormalizer`, pending-message loop) code was started.

- `PrismaMessageExtractionRepository`/`MessageExtractionMapper`
  (`packages/database/src/infrastructure/`, `.../mappers/`) implement the
  repository interface, following the exact `PrismaStructuredResumeRepository`/
  `PrismaMatchResultRepository` convention: a thin mapper (`toDomain`/
  `toPersistence`) plus a repository that only calls `prisma.messageExtraction`
  and never touches another model. `save()` always calls `.create()` — there is
  no `update`/`upsert` call anywhere in the class — which is what makes the
  append-only guarantee structural rather than convention-based.
- Exports wired end-to-end: `packages/ai/src/index.ts` (domain types, prompt
  builder, cache-key/confidence functions, engine), `packages/database/src/index.ts`
  (`PrismaMessageExtractionRepository`), `apps/backend/src/container.ts`
  (`messageExtractionRepository`, `messageExtractionEngine`, both exposed on
  `Container`).
- Tests added: `message-extraction-engine.test.ts` (success path, malformed-response
  retry-then-persist-PARSE_ERROR, recovery on retry, PROVIDER_ERROR after exhausting
  retries, non-retryable error short-circuits retries, cache hit skips the provider,
  idempotent replay via `findByContentHashAndPrompt`, SPAM classification),
  `message-extraction-confidence.test.ts` (determinism, high/zero scoring,
  evidence-hallucination penalty, inapplicable-category handling, status
  classification), `message-extraction-mapper.test.ts` (round-trip, nullable
  defaulting), and `prisma-message-extraction-repository.test.ts` (every
  repository method against a mocked Prisma client, plus an explicit assertion
  that `save()` never calls `update`/`upsert` and that two saves for the same
  `messageId` produce two `create()` calls rather than one row being overwritten).
- Verified architecturally: `message-extraction-engine.ts` has no import from
  and no reference to Telegram, `Vacancy`/`NormalizedVacancy` (beyond the doc
  comment explaining why it doesn't touch them), the matching engine, ATS
  scoring, deduplication, or recommendations — its only domain dependency is
  `SocialMessage` (`@careeros/career`) in, `MessageExtraction` out. No retry
  loop, cache implementation, token/cost accounting, or telemetry was
  duplicated: all of it is the same `AIProvider`/`AICache`/`CostTracker`/
  `AILogger`/`AIMetricsCollector`/`AITracer` interfaces `MatchingEngine`
  already uses, with the two deliberate deltas documented in point 2 above.
