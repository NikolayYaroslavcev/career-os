# EPIC-21 Phase 1 — Vacancy Search Quality Audit

Date: 2026-08-05
Scope: full vacancy pipeline, Provider → Fetcher → Mapper → Normalizer → Quality
Filters → Deduplication → Persistence → Recommendation → AI Matching → Search
API → Dashboard.
Method: static audit (no live database available in this environment — see
Data Quality Metrics for what that does and doesn't allow us to claim).

---

## 1. Investigation Summary

**Task:** Audit-only pass across the vacancy pipeline; implement only
deterministic, low-risk fixes surfaced by evidence, and stop after this report.

**Relevant existing code:** `packages/providers/src/*` (24 provider
fetcher/mapper/normalizer triples, shared normalization pipeline, dedup
engine), `apps/backend/src/services/provider-search-service.ts` (fetch →
dedup → filter → persist orchestration), `apps/backend/src/services/ranking/*`
(quality scoring, recommendation ranking), `apps/backend/src/routes/vacancies/`
and `recommendations/` (API surface), `apps/dashboard/src/app/app/search/` and
`src/features/recommended-jobs.tsx` (UI).

**Reusable pieces found:** `non-vacancy-content.ts`'s `isNonVacancyContentShape`
(correct Cyrillic-safe spam regex, already used by the read-path routes) vs. a
second, buggy, hand-duplicated copy inline in `provider-search-service.ts`
(the write path) — same responsibility, two implementations, one of them
wrong. Consolidated (see §9).

**Dependency / blast radius:** `provider-search-service.ts` is the single
choke point every provider's output passes through before persistence — a fix
there affects all 24 providers uniformly. `vacancy-ranking-service.ts` is
shared by `/recommendations` only, not by plain `/vacancies` search — the two
endpoints rank independently (see §5).

**Architectural boundary:** Provider layer (`packages/providers`) owns
fetch/map/normalize/dedup; `apps/backend/src/services` owns
filtering/ranking/persistence orchestration; `packages/database` owns the
Prisma schema and query building; `apps/dashboard` owns presentation only —
confirmed no business logic duplicated in the dashboard beyond client-side
sort-order convenience.

**Relevant ADRs:** ADR-026 (decoupled AI matching), ADR-027 (diagnostics,
`VacancyRanker` extension point — intentionally unwired), ADR-030 (multi-source
model, weighted-field dedup design), ADR-034/036 (RemoteOK/Himalayas/DOU.ua
removal). Notable finding: **ADR-030's documented dedup formula (weighted
title/company/location/remote/employment/salary, threshold 0.75) was never
actually implemented that way** — the shipped `DeduplicationEngine` only
scores company+title (see §4). This is a doc/code divergence, not a
regression; flagged in Remaining Technical Debt.

**Test coverage found:** 618 backend tests, 871 provider tests, 43 dashboard
tests (1 pre-existing failure, unrelated — see §11) all passing after fixes.
Existing dedup tests never exercise the fuzzy path against the scenarios this
audit traced; `non-vacancy-content.test.ts` had 2 assertions, neither covering
Cyrillic input, before this pass.

**Schema facts confirmed:** `Vacancy` has no `applyUrl`/`isActive`/`deletedAt`
column (these live on child `VacancySource`); domain entity `Vacancy` declares
`isActive`/`expiresAt` fields the schema cannot persist (see §8).
`VacancySource.status` supports `EXPIRED`/`REMOVED`/`BROKEN` but no code path
ever writes those values.

---

## 2. Vacancy Pipeline Diagram

```
Provider (24 registered: 7 ATS + hh/superjob/habr_career/linkedin + 12 free
          aggregators + telegram)
   │  RawJob  — provider-native shape
   ▼
Fetcher (packages/providers/src/providers/*/[name]-fetcher.ts)
   │  RawJob[] — HTTP fetch, pagination, provider-specific auth/rate-limit
   ▼
Mapper (*-mapper.ts)
   │  MappedJob — RawJob → common shape; HTML-entity decoding done HERE,
   │  per-provider (28/28 mappers call decodeHtmlEntities)
   ▼
Normalizer (normalization-pipeline.ts: DefaultNormalizationPipeline)
   │  NormalizedVacancy — text cleanup, experience/employment inference
   │  (Unicode-aware regex, RU+EN), salary/location pass-through,
   │  contentHash computed here (title|companyName|location.raw|url)
   │  Per-provider Normalizer.validate() rejects empty title/company/url/date
   ▼
Quality Filters (provider-search-service.ts, in order):
   1. DeduplicationEngine.deduplicate()      — see §4
   2. filterNonVacancyContent()              — see §3 (fixed in this pass)
   3. filterByRelevance()                     — SearchProfile keyword/tech gate
   ▼
Persistence (provider-search-service.ts persistVacancy() → Prisma)
   │  Vacancy + VacancySource rows. No canonical cross-provider merge check
   │  beyond the fuzzy dedup step above — first-seen (provider, externalId)
   │  always creates a new Vacancy row.
   ▼
Recommendation (recommendation-routes.ts → VacancyRankingService)     ┐
AI Matching (ai-matching-service.ts → MatchingEngine, async via BullMQ) ┤ two independent
                                                                          ┘ scoring systems (§5)
   ▼
Search API (vacancy-routes.ts → prisma-vacancy-repository.findMany())
   │  filter + sortBy (freshness/salary/company/title only — "relevance"
   │  silently falls through to freshness, see §5)
   ▼
Dashboard (apps/dashboard/src/app/app/search/page.tsx,
           src/features/recommended-jobs.tsx — two independent, non-sharing UIs)
   ▼
User
```

---

## 3. Provider Quality Report

24 providers registered and exported (`packages/providers/src/index.ts`), all
with complete fetcher+mapper+normalizer triples — **no provider is stubbed**.
`SOURCE_PRIORITY` (`apps/backend/src/config/source-priority.ts:8-38`) ranks ATS
providers (greenhouse/lever/ashby, 95-100) above job boards (hh/superjob/
habr_career, 75) above telegram (40) — a reasonable authority ordering.

**Confirmed bugs:**

- **Salary period mislabeled for every non-monthly source**
  (`normalization-pipeline.ts:126-138`): `normalizeSalary()` hardcodes
  `period: 'monthly'` regardless of the source's actual period, and derives
  `isEstimate` from `salary.period !== 'monthly'` rather than converting
  units. An hourly-rate posting (e.g. Upwork-style $50/hr) or an annual-salary
  posting keeps its raw numeric value but is persisted and displayed as if it
  were a monthly figure — no unit conversion anywhere downstream. Root cause is
  one level deeper than the function: `SalaryInfo.period`
  (`packages/providers/src/types/vacancy.ts:31`) is typed as the literal
  `'monthly'` only — the domain contract itself has no room for other units.
  **Not fixed in this pass** — correcting it means widening a shared domain
  type and adding real hourly/yearly→monthly conversion, which is a product
  decision (what conversion factor? surface original period in the UI
  instead?), not a mechanical patch. Flagged P0 in §9, left for a follow-up
  pass with product input.
- **Telegram silently fabricates company names**
  (`social-message-mapper.ts:77-80`): an empty extracted company name defaults
  to the literal string `"Unknown"` before normalization runs, so
  `SocialMessageNormalizer.validate()`'s "missing companyName" check can never
  fire for Telegram — unlike every other provider, where an empty company is a
  hard validation error. Telegram vacancies with no real company can reach the
  DB as `companyName: "Unknown"`.
- **HH's location split is naive**: `location.split(',')`
  (`hh-mapper.ts:53-67`) breaks on any location string not shaped like
  "City, Country".

**Strongest part of the pipeline:** Telegram's `message-precheck-classifier.ts`
— a deterministic (no LLM) gate rejecting 9 junk categories (candidate resumes,
recruiter self-promo, agency ads, course/bootcamp, webinars, giveaways, crypto,
affiliate/sponsorship, newsletters) before the cheaper IT-relevance check. This
is materially better spam coverage than any other provider gets, but it's
**Telegram-only** — no other provider's pipeline path runs giveaway/crypto/
affiliate/newsletter detection at all (see §3.1 gap list below).

**Verification gaps:** `test-providers-sync.ts` and `full-pipeline-test.ts`
smoke-test only 13 of 24 providers — every ATS provider (the highest-priority
sources), superjob, france_travail, adzuna, and telegram have zero smoke-test
evidence despite being fully coded. `full-pipeline-test.ts` also dedups by a
naive `title + companyId` lookup that bypasses the real `DeduplicationEngine`
entirely, and swallows persistence errors with a bare `catch {}`
(`full-pipeline-test.ts:189-191`) — a "production readiness" check that would
hide the very failures it exists to catch.

### 3.1 Junk-category coverage (per Step 2 checklist)

| Category | Detected? | Where |
|---|---|---|
| Duplicate vacancies | Partial | `DeduplicationEngine` — company+title fuzzy only, see §4 |
| Incomplete vacancies (missing company/desc/URL) | Yes | Per-provider `Normalizer.validate()` |
| Missing company names | Yes, except Telegram | See bug above |
| Broken apply URLs | **No** | Format-only checks (`startsWith('http')`); no reachability/HEAD check anywhere |
| Missing descriptions | Yes | `Normalizer.validate()` |
| Invalid salary parsing | **No — confirmed bug** | See salary period bug above |
| Invalid locations | Partial | HH's naive split; no general validation |
| Stale vacancies | **No** | No expiry/cleanup mechanism exists at all (§8) |
| Deleted vacancies | **No** | `VacancySource.status` supports it; nothing writes it (§8) |
| Fake vacancies / AI-generated junk | **No** | No such detector anywhere in the codebase |
| Advertisements / recruiter promotions | Telegram only | `message-precheck-classifier.ts` |
| Training/course posts | Yes (buggy for Cyrillic until this pass, see §9) | `non-vacancy-content.ts` / former inline copy |
| Newsletters | Telegram only | Not checked for any other provider |
| Agency spam | Partial, Telegram richer | `AD_PROMO_PATTERNS` (generic) vs. full taxonomy (Telegram) |

---

## 4. Deduplication Report

Implementation: `packages/providers/src/deduplication/deduplication-engine.ts`.
Two-stage: exact-key match on `contentHash` (title|companyName|location.raw|url,
rolling hash, `normalization-pipeline.ts:140-154`), then a fuzzy fallback
(Levenshtein similarity on `companyName` [weight 0.5, individual floor 0.7] and
`title` [weight 0.5, individual floor 0.6], combined score must clear
**0.75** in production, `provider-search-service.ts:348`; fuzzy dedup enabled
via `container.ts:1118`).

**This is materially simpler than ADR-030's documented design** (weighted
title/company/location/remote/employment/salary scoring) — the shipped code
only ever compares two fields.

| Scenario | Result | Why |
|---|---|---|
| a. Identical title/company/location, different provider | **DEDUPED** | companySim=titleSim=1.0 |
| b. Title differs slightly ("...Engineer" vs "...Engineer (Remote)") | **DEDUPED** | titleSim ≈0.77, companySim=1.0, combined ≈0.887 ≥0.75 |
| c. Company formatting differs ("Google" vs "Google LLC"/"Google Inc.") | **NOT DEDUPED (false negative)** | companySim ≈0.6 < 0.7 individual floor — candidate skipped before title is even checked. Also creates two separate `Company` rows (`Company.findByName` is exact-match). |
| d. Salary differs | **DEDUPED regardless** | Salary is in neither `contentHash` nor the fuzzy comparison — ignored entirely, no merge/reconciliation of the surviving record's salary |
| e. Location differs (Kyiv / "Kyiv, Ukraine" / Remote) | **DEDUPED regardless — false-positive risk** | Location breaks the exact-key stage but isn't checked at all in the fuzzy stage |
| f. Apply URL differs | **DEDUPED** (by design) | This is what makes cross-provider dedup work at all |
| g. Description paraphrased/translated | **DEDUPED regardless** | Not part of either comparison |

**Net read:** the fuzzy matcher's blind spot on location/salary means two
*genuinely different* openings — same company, same title, different city or
comp — get silently merged into one `Vacancy` row, and whichever source was
fetched second simply loses its distinct data. This is the highest-severity
finding in the audit (§9, P0). Conversely, (c) shows the *opposite* failure
mode already in production: a legal-suffix difference alone defeats the
company-similarity floor, so the same employer's listings can permanently
fork into duplicate `Company` records.

**Test coverage:** `deduplication.test.ts` only ever exercises the exact-key
path; only `telegram-deduplication.test.ts` exercises the fuzzy path, and only
for a single scenario (same title/company, case-changed). None of (c)-(g)
above have any test coverage, and the production `0.75` threshold isn't the
one used in the test fixtures (`0.8`).

**Persistence-level safety net:** none. `@@unique([vacancyId, providerId,
externalId])` on `VacancySource` only prevents duplicate rows for the *same*
provider re-fetching the *same* external ID — it does nothing for
cross-provider content dedup. A fuzzy-match false negative becomes a
permanent duplicate `Vacancy` row with no DB constraint to catch it.

---

## 5. Search Ranking Report

**Plain search** (`GET/POST /vacancies` → `prisma-vacancy-repository.ts:98-113`):
`sortBy` switches on `salary` (by `salaryMax`), `company`, `title`, or
`newest`/default (`publishedAt desc`). **Confirmed bug:** `relevance` is a
valid enum value in the route schema (`vacancy-routes.ts:12`) but has no
`case` in the switch — it silently falls through to `publishedAt desc`. No
relevance/quality/AI score is ever wired into this endpoint's `ORDER BY`.
Freshness is the only real signal.

**Two other scores exist in the codebase and are never used for ordering
here:** `filterByRelevance`'s `calculateVacancyRelevance` (keyword/tech match)
is a pass/fail persistence gate, not a sort key — persisted order is fetch
order. `source-priority.ts`'s provider weights are used only for
field-merge conflict resolution, never for list ordering.

**`/recommendations`** (`recommendation-routes.ts` → `VacancyRankingService.
rankVacancies()`, `vacancy-ranking-service.ts:654-730`) is a **separate**
heuristic ranking pipeline: careerFitScore (role 35 + tech 30 + experience 15
+ location 10 + salary 5 + providerQuality 5, ×0.7) + interestScore×0.1 +
qualityScore×0.1 + freshnessScore×0.1, tiered HOT/WARM/COLD/REJECT at
80/60/40. Interaction weights: SAVE +10, **APPLY +15**, VIEW +2, IGNORE −10,
HIDE −20.

**The AI/LLM path** (`intelligence-workflow-service.ts` / `morning-digest-
service.ts` → `MatchingEngine`) is a **third, independent** scoring system —
`RecommendationService.sortByScore()` sorts purely by `MatchResult.
overallScore`. Plain search, heuristic recommendations, and AI matching are
three unrelated ranking formulas, not one engine with three views.
`ADR-027`'s `VacancyRanker` extension point exists precisely because of this
fragmentation but is deliberately not wired in yet.

**Confirmed bug — the most consequential ranking finding:** neither
`vacancy-routes.ts` nor `recommendation-routes.ts` excludes already-applied
vacancies. Worse, `recommendation-routes.ts` fed `APPLY` interactions into
`calculateInteractionBoost`, which **added +15** — an applied job was actively
promoted rather than removed. **Fixed in this pass, see §9.**

**Confirmed:** hidden jobs are excluded from `/recommendations` (pre-fix) but
were, and remain, **not excluded from plain search** — `vacancy-routes.ts`
only filters non-vacancy-content shape, no interaction check at all. This is
a real gap but requires joining the interaction repository into the plain
search path — larger blast radius than this pass's "low-risk only" bar, left
as P1.

**Not found / could not verify:** company-watch duplication against search
results, and recommendation/search mutual dedup — no code was found either
confirming or ruling these out conclusively; flagged as an open question
rather than an asserted bug.

---

## 6. Filtering Report

Schema: `vacancy-routes.ts:15-32`. Query builder:
`prisma-vacancy-repository.ts:44-126`.

| Filter | Implemented | Matching logic | Issue |
|---|---|---|---|
| Remote/Hybrid/Onsite | Yes | Enum-typed column (`RemoteType`), written via `.toUpperCase()` | None |
| Country | **No** | `Location.country` exists in the domain value object but `Vacancy.location` is a flat `String?` column that only ever receives `city` | Dropped at persistence; no API param at all |
| City | Partial | Only via free-text `location` `contains` substring | Not a real city filter |
| Salary range | Yes | Overlap logic (`salaryMax gte min`, `salaryMin lte max`) | None |
| Employment type | Yes | Exact, **case-sensitive** string equality, no canonical enum | False negatives: "full_time" vs "Full-time" vs "FULL_TIME" won't match |
| Experience level | Yes | Exact, case-sensitive against a lowercase enum; API schema is `z.string()` not `z.enum` | Unvalidated casing silently returns zero rows |
| Technology | Yes | Prisma `has` on `String[]`, **exact case-sensitive** match; `Technology.create()` only trims, never lowercases | Confirmed false negatives: `technology=react` won't match stored `"React"` |
| Provider | Yes | Exact match, but provider ids are lowercase-only enum values | None |
| Language | **No** | No field anywhere — schema, criteria, Prisma model, or mapper | Genuinely absent, not a no-op |
| Company | Yes | Case-insensitive substring on relation | None |
| Date range | Yes | `gte`/`lte` on `publishedAt`, correctly composable | None |
| Free-text query | Yes | Case-insensitive `OR` on title/description, scoped inside its own clause | None |

**Combination:** all filters attach as sibling keys on one Prisma
`WhereInput`, implicitly ANDed — confirmed combinable with no OR-leakage
between filter types. Test coverage for real multi-filter combination is
thin: existing tests assert params are forwarded to a mocked `findMany`, not
that the `where` clause combines correctly against a real/test DB.

**No dead/no-op filters found** — every schema-defined param has a
corresponding `where` clause. The real gaps are *absent* fields
(`country`/`city`/`language`), not silently-ignored ones.

---

## 7. UX Report

- **URL state / filter persistence: not implemented.** All filter/search
  state lives in local `useState` (`search/page.tsx:42-48`) — no
  `useSearchParams`, no localStorage, no restoration on mount. A refresh
  resets every filter to hardcoded defaults.
- **Pagination:** real offset/limit, not infinite scroll — Previous/Next
  buttons driven by `params.offset`/`limit`. No virtualization, but bounded
  by `limit` (default 20) so not currently a problem.
- **Empty state:** present but plain (static text) on the main search page;
  the separate Recommendations UI has a richer `EmptyState` component —
  inconsistent polish between the two.
- **Loading states:** a full-page `Loading` swap-in gates *every* refetch,
  including filter-driven ones — the whole list disappears behind a spinner
  on each filter change rather than showing stale content with a subtler
  indicator.
- **Sorting:** real backend param (`sortBy`), but no UI control for
  `sortOrder` — fixed ascending/descending, never toggleable from the UI.
- **Dead code found:** `searchVacancies()` (POST `/vacancies/search`) exists
  in the API client but is never called anywhere in the UI — only
  `listVacancies()` is used.
- **Search vs. Recommendations: fully disconnected UIs.** Different
  endpoints, different data shapes, independently re-implemented loading/
  empty/sort UI with no shared code, no pagination at all on the
  Recommendations panel (fixed `limit: 20`), and no cross-navigation or
  visual link between the two — a user can see the same vacancy in both
  with no indication they're the same listing.

---

## 8. Data Quality Metrics

**No live database was available in this environment** (`docker ps` returned
no containers; no seed/fixture run was performed) — real, current coverage
percentages cannot be computed here, and none are fabricated in this report.

What *can* be reported with evidence:

- **Scoring infrastructure already exists and is unused for filtering:**
  `apps/backend/src/services/ranking/vacancy-quality-score.ts` (per-vacancy:
  company/salary/applyUrl existence, description-length buckets, source
  reliability, freshness buckets → weighted /100) and
  `provider-quality-calculator.ts` (same, aggregated per provider, plus a
  duplicate-title rate). Both are display/diagnostics-only — neither rejects
  or demotes a vacancy. Note `provider-quality-calculator.ts:108-109`
  hardcodes `applyUrlAvailability` to a neutral `50` with a comment
  admitting "Apply URL not available from Vacancy entity" — this metric is
  currently a constant, not a measurement. Also note `companyAvailability`
  can only ever read `vacancy.companyId` truthiness — since `companyId` is a
  required FK, this metric cannot detect the Telegram `"Unknown"`
  placeholder-company bug from §3; it will always read ~100%.
- **The most recent real evidence available** is
  `docs/reports/data-quality-audit-2026-07-22.md`, a prior audit against the
  local dev Postgres instance (680 imported vacancies across 9 providers at
  the time). Headline numbers from that report: 7 of 9 active providers
  failed the missing-salary threshold (>85%), several at 100% (`hn_hiring`,
  `jobicy`, `arbeitnow`, `we_work_remotely`, `working_nomads`), and two
  providers (`nodesk`, `we_work_remotely`) showed 100% "unknown company name"
  placeholders. That audit predates ADR-034/036 (RemoteOK, Himalayas, DOU.ua
  removed since), so its per-provider numbers are stale for today's active
  provider set, though the *shape* of the problem (aggregator feeds have
  systematically worse salary/company data than ATS feeds) is still
  architecturally true today, since nothing in the pipeline has changed
  that dimension.
- **Broken URL rate:** cannot be measured — no reachability check exists
  anywhere in the codebase (confirmed absence, §3.1), only format checks.
- **Duplicate rate:** cannot be measured from a live corpus here; the
  *mechanism's* known blind spots are documented precisely in §4 instead.

**Recommendation:** run `provider-quality-calculator.ts`'s existing logic (or
the script behind the 2026-07-22 report) against current production/staging
data as a follow-up — the scoring code to do this already exists and does not
need to be rebuilt.

---

## 9. Improvements (Prioritized, Implemented)

### P0 — implemented in this pass

1. **Recommendations no longer boost applied jobs — they're excluded.**
   `recommendation-routes.ts`: extended the existing hidden-vacancy exclusion
   set to also exclude `APPLY` interactions, mirroring the exact pattern
   already used for `HIDE`. Previously an applied vacancy received a **+15**
   ranking boost and could resurface as a top recommendation.
2. **Fixed silent Cyrillic spam-filter bypass by removing a duplicate,
   buggier implementation.** `provider-search-service.ts` carried its own
   hand-copied version of the course/webinar/ad regex bank using plain `\b`
   word boundaries, which are ASCII-only in JS and never match inside
   pure-Cyrillic text (verified: `/\bкурс[аоы]?\b/i` fails on `'Курс по
   программированию'`). The read-path file `non-vacancy-content.ts` already
   had the correct, working version (character-class boundaries). Deleted
   the duplicate and pointed `provider-search-service.ts` at the existing
   correct implementation — one filter, used everywhere, per the "reuse
   before creating" rule this duplication had already violated.

### P0 — documented, not code-fixed (needs product input or wider blast radius)

3. **Dedup ignores location/salary/description entirely.** Two genuinely
   different openings (same company+title, different city/comp) merge into
   one `Vacancy` row today. Fixing this means changing `DeduplicationEngine`'s
   fuzzy comparison to weigh location (and probably reconciling ADR-030's
   documented-but-unimplemented multi-field formula) — real architectural
   work, not a mechanical patch, and risks changing dedup behavior for every
   provider at once. Recommend a follow-up pass scoped to this alone, with
   before/after fuzzy-match sampling against real data.
4. **Salary period is hardcoded to "monthly" for every source.** Needs a
   product decision (convert units vs. surface original period in the UI) and
   a domain-type change (`SalaryInfo.period` is currently the literal type
   `'monthly'`, not a union) — out of scope for a low-risk patch.

### P1 (documented, not implemented — larger blast radius or requires design)

- `technology`/`employmentType`/`experienceLevel` filters are case-sensitive
  against inconsistently-cased provider data (needs either a data-migration
  to canonical casing at write time, or a schema-supported case-insensitive
  comparison — Prisma's `has` on a `String[]` doesn't support `mode:
  insensitive`).
- `country`/`language` filters don't exist; `city` filtering is a substring
  hack. Needs schema changes (a real `country`/`city` column) — out of scope
  for "no redesign."
- Hidden jobs still reappear in plain search (only excluded from
  Recommendations) — needs joining the interaction repository into the main
  search query path.
- `sortBy=relevance` is accepted by the API but has no distinct behavior
  (falls through to freshness) — needs either removing the enum value or
  wiring a real relevance score into the DB-level sort, both real design
  decisions.
- Non-Telegram providers get none of the giveaway/crypto/affiliate/newsletter
  detection that Telegram's classifier already has — extending it generically
  is straightforward reuse but touches every provider's pipeline output.

### P2 (documented, cosmetic/consistency)

- Dashboard search UI has no URL/filter persistence across refresh.
- Dead code: `searchVacancies()` API client function is never called.
- Recommendations panel has no pagination and a plainer empty state than the
  main search page; the two UIs don't share code or cross-link.
- `full-pipeline-test.ts` and `test-providers-sync.ts` don't smoke-test 11 of
  24 providers, including every ATS source.
- `provider-quality-calculator.ts`'s `applyUrlAvailability` is a hardcoded
  constant (50), not a real measurement.

---

## 10. Files Changed

- `apps/backend/src/services/provider-search-service.ts` — removed the
  duplicate, buggy `isNonVacancyContent`/`filterNonVacancyContent` and its
  three regex banks; now imports the correct `filterNonVacancyContent` from
  `non-vacancy-content.ts`.
- `apps/backend/src/routes/recommendations/recommendation-routes.ts` —
  extended the exclusion set from `HIDE`-only to `HIDE`-or-`APPLY`, so applied
  vacancies are removed from recommendations instead of boosted.

## 11. Tests Added

- `apps/backend/src/services/__tests__/non-vacancy-content.test.ts` — 3 new
  assertions confirming Cyrillic course/webinar/agency titles (no ASCII word
  boundary) are correctly rejected.
- `apps/backend/src/routes/__tests__/recommendation-routes.test.ts` — 1 new
  test confirming an `APPLY`-interaction vacancy is excluded from
  recommendations rather than appearing boosted.

## 12. Validation Results

- `pnpm --filter @careeros/backend typecheck` — clean.
- `pnpm --filter @careeros/backend test` — **618/618 passed** (57 files),
  including the 2 new regression tests.
- `pnpm --filter @careeros/providers test` — **871/871 passed** (97 files),
  unaffected by these changes (confirms the dedup/normalization findings
  above are pre-existing behavior, not introduced by this pass).
- `pnpm --filter @careeros/dashboard test` — 39/43 passed; **1 pre-existing
  failure** (`ai-actions-panel.test.tsx`, an AI-panel combobox-selection
  issue, 4 assertions) unrelated to vacancy search/recommendations and not
  touched by this pass — confirmed no dashboard files were modified here.

## 13. Remaining Technical Debt

- ADR-030's documented weighted multi-field dedup score was never actually
  implemented — the shipped engine is a simpler 2-field (company+title)
  comparison. Either update the ADR to reflect reality or implement the
  documented design; leaving them mismatched will mislead the next reader.
- Domain/persistence drift: `Vacancy` entity declares `isActive`/`expiresAt`
  that the Prisma schema has no columns for; `experienceLevel` is
  non-optional in the domain but nullable in the DB.
- `VacancySource.status` (`EXPIRED`/`REMOVED`/`BROKEN`) is fully modeled in
  the schema but no worker or scheduled job ever transitions a source out of
  `ACTIVE` — there is currently no vacancy-staleness or removed-listing
  detection in production at all, despite the schema being ready for it.
- Three independent ranking/scoring systems (plain-search freshness-only sort,
  heuristic `VacancyRankingService`, AI `MatchingEngine`) exist with no shared
  implementation — ADR-027's `VacancyRanker` extension point was built for
  exactly this consolidation but remains unwired.
- 11 of 24 providers (including every ATS provider) have zero smoke-test
  coverage in `test-providers-sync.ts`/`full-pipeline-test.ts`, and the latter
  swallows persistence errors silently, undermining its purpose as a
  production-readiness check.

---

**Stopping here per scope** — this is an audit-and-narrow-fix pass for
EPIC-21 Phase 1. No further EPIC work follows from this report.
