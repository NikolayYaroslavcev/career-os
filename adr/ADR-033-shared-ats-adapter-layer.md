# ADR-033: Shared ATS Adapter Layer

## Status

Accepted — approved after Phase 1/2/3 migrations for Greenhouse, Lever, and
SmartRecruiters shipped and validated (see addenda below). Remaining
migration order: Recruitee, Comeet, Ashby, Workday, Teamtailor.

## Date

2026-07-29

## Context

Two independent parts of the codebase talk to the same set of ATS
(Applicant Tracking System) APIs today, with no shared code between them:

**1. `packages/providers/src/providers/{ats}/`** — one `Fetcher` +
`Mapper` + `Normalizer` + `Provider` per ATS
(`greenhouse`, `lever`, `ashby`, `workday`, `teamtailor`, `smartrecruiters`,
`recruitee`, `comeet`). Each is registered **once, globally**, from env vars
(see `apps/backend/src/container.ts:330-480`, e.g.
`GREENHOUSE_BOARD_TOKEN`/`GREENHOUSE_COMPANY_NAME`) — one company's board per
deployment. Output (`NormalizedVacancy`) flows into the cross-workspace
**Vacancy Sync** pipeline: `ProviderSearchService` →
`DeduplicationEngine` → `Vacancy` / `VacancySource` / `Company`
(`@careeros/career`), which feeds AI matching/ranking for every workspace.

**2. `packages/company-watch/src/adapters/`** — one `AtsAdapter`
per ATS (`greenhouse`, `lever`, `ashby`, `workday`, `teamtailor`, plus
fallback `custom-html` and `json-ld` adapters), held in an
`AtsAdapterRegistry`. Invoked **per `CompanyWatch` DB row** — a workspace can
watch any number of companies, each with its own `atsType` /`careerUrl`
/`atsEndpoint` / `metadata` (e.g. `boardToken`). Output (`NormalizedJob`)
feeds a separate, per-workspace **notification** pipeline:
`CompanyWatchEvent` (`NEW_JOB` / `REMOVED_JOB` / `CHANGED_JOB`) +
`CompanyWatchSyncLog` — it never writes to `Vacancy`.

### Duplication is real and verified, not assumed

Side-by-side read of Greenhouse (representative — Lever/Ashby/Workday/
Teamtailor mirror this pattern):

| | `packages/providers/.../greenhouse-fetcher.ts` | `packages/company-watch/.../greenhouse-adapter.ts` |
|---|---|---|
| URL construction | `` `${baseUrl}/${boardToken}/jobs?content=true` `` | identical |
| Single-job URL | `` `${baseUrl}/${boardToken}/jobs/${id}?questions=false` `` | identical |
| 404 handling | returns `null` | returns `null` |
| Salary parsing | `pay_input_ranges[0]`, cents → units, default `USD` | byte-identical logic |
| Tech extraction | `/tech(nolog(y|ies))?|skills?/i` over `metadata` | byte-identical regex |
| Output shape | `RawJob` (`sourceId`, `technologies`, ...) | `AtsJob` (`externalId`, `technologies`, ...) |

The only real difference between the two implementations is the output
type name and a couple of field names (`sourceId` vs `externalId`) — the
HTTP call, parsing, and business rules are copy-pasted.

There is a second, related duplication one layer up that this ADR
deliberately does **not** resolve: `company-watch`'s `NormalizationService`
and `DeduplicationService` re-implement simplified versions of
`providers`' `DefaultNormalizationPipeline` and `DeduplicationEngine`
(whitespace/HTML stripping, tech lowercasing, content-hash dedup). Folding
that in alongside the adapter migration would double the risk surface of
every phase below; it's flagged here as a follow-up ADR candidate, not
in scope.

### A concrete gap this consolidation would also fix

`AtsType` (`packages/company-watch/src/domain/value-objects/ats-type.ts`)
declares `SMARTRECRUITERS`, `RECRUITEE`, `PERSONIO`, `BAMBOOHR`, but
`AtsAdapterRegistry` has no adapter for any of them — `.get()` throws today
if a `CompanyWatch` row is ever created with those types. Meanwhile
`packages/providers` **already has** full Fetcher/Mapper/Normalizer stacks
for SmartRecruiters, Recruitee, and Comeet. Building the shared layer closes
this gap almost for free instead of writing three more one-off adapters.

### Dependency fact that shapes the design

Neither package currently depends on the other, or on `@careeros/shared`
(`packages/providers/package.json` and `packages/company-watch/package.json`
both declare zero runtime `dependencies`). Any shared layer must preserve
this — it must not make `providers` and `company-watch` depend on each
other, directly or via a cycle through the new package.

## Question 1 — Should ATS providers keep existing as standalone Providers?

**Yes.** Provider and Company Watch are different consumers with genuinely
different semantics, not just two copies of the same feature:

- **Tenancy**: Provider is single-tenant/global, configured once via env
  vars at deploy time. Company Watch is multi-tenant, N companies per
  workspace, configured via DB rows created by users.
- **Downstream contract**: Provider output becomes a canonical `Vacancy`
  used for cross-workspace search, matching, and ranking. Company Watch
  output is a lightweight change-event stream (`NEW_JOB`/`REMOVED_JOB`/
  `CHANGED_JOB`) for notifications — it is intentionally *not* trying to
  become a canonical vacancy.
- **Orchestration**: Provider sits inside `ProviderRegistry` /
  `SyncSchedulerService` / `ProviderConfig` (health, quality score, cron
  scheduling per provider ID). Company Watch sits inside its own
  `CompanyWatchService.syncAll()` / `CompanyWatchSyncLog` loop, polling
  per-row `pollingInterval`.

Merging either direction is a much bigger, riskier change than the actual
problem (duplicated HTTP/parsing code) requires: forcing Provider to become
DB-multi-tenant touches `ProviderRegistry`, `ProviderConfig`, and the sync
scheduler's assumptions; forcing Company Watch through the Vacancy/matching
pipeline drags in `DeduplicationEngine`/`MatchResult` consumers it has no
use for. **Keep both orchestration layers. Unify only what's actually
identical: the ATS HTTP client + raw response parsing.**

## Question 2 — Can both reuse the same Adapter implementation?

**Yes.** `Fetcher` (providers) and `AtsAdapter` (company-watch) already do
the same job — call the ATS API, return parsed jobs — with almost the same
shape. A single per-ATS adapter can implement "call ATS, return a canonical
raw job" exactly once; `Fetcher` and `AtsAdapter` become thin wrappers that
translate the canonical shape into their own consumer-specific type.

## Proposed Architecture

New package: **`packages/ats-adapters`**. A new package (not folded into
`providers` or `company-watch`) so that neither existing package has to
depend on the other, and so `company-watch` doesn't inherit the large
surface of unrelated job-board code (`RemoteOK`, `HH`, `Telegram`, ...)
that lives in `providers`.

```
packages/ats-adapters/
  src/
    interfaces/
      ats-adapter.ts      // fetchJobs/fetchJob/ping contract (was base-adapter.ts)
      ats-raw-job.ts       // canonical raw job shape (supersedes RawJob-for-ATS and AtsJob)
      ats-config.ts        // typed per-ATS config (boardToken, tenant, etc.)
    adapters/
      greenhouse-adapter.ts
      lever-adapter.ts
      ashby-adapter.ts
      workday-adapter.ts
      teamtailor-adapter.ts
      smartrecruiters-adapter.ts   // new — closes the enum/registry gap
      recruitee-adapter.ts         // new — closes the enum/registry gap
      custom-html-adapter.ts       // moved from company-watch (no Provider equivalent)
      json-ld-adapter.ts           // moved from company-watch (no Provider equivalent)
    registry/
      ats-adapter-registry.ts      // single registry, used by both consumers
```

```
                        packages/ats-adapters
                 ┌───────────────────────────────┐
                 │          ATS Adapter            │
                 │ fetchJobs / fetchJob / ping      │
                 │      → AtsRawJob (canonical)     │
                 └───────────────┬───────────────┘
              ┌──────────────────┴──────────────────┐
              ▼                                      ▼
   packages/providers                     packages/company-watch
  ┌─────────────────────┐              ┌───────────────────────┐
  │ GreenhouseFetcher     │              │ CompanyWatchService    │
  │ implements Fetcher    │              │ calls AtsAdapter        │
  │ AtsRawJob → RawJob     │              │ directly (no wrapper)   │
  └──────────┬───────────┘              └───────────┬───────────┘
             ▼                                       ▼
     Mapper → Normalizer                     NormalizationService
             ▼                                       ▼
      NormalizedVacancy                       NormalizedJob
             ▼                                       ▼
    ProviderSearchService                   DeduplicationService
             ▼                                       ▼
  Vacancy / VacancySource                CompanyWatchEvent / SyncLog
  (Vacancy Sync — cross-workspace)      (Company Watch — per-workspace)
```

This matches the requested target shape exactly:

```
ATS Adapter → Provider → Vacancy Sync
ATS Adapter → Company Watch
```

Design details:

- **`AtsRawJob`** is the union superset of what `RawJob` and `AtsJob`
  already both carry (`externalId`/`sourceId`, `title`, `description`,
  `url`, `location?`, `salary?{min,max,currency}`, `technologies`,
  `publishedAt?`, `departments?`) — the mapping from `AtsRawJob` to either
  consumer's own type is near-identity, not a real transformation.
- **HTTP resilience** (`fetchWithTimeout`, retry, HTML-entity decoding,
  tech-keyword extraction) currently lives in `packages/providers/src/
  resilience/` and `shared/`. `ats-adapters` cannot depend on `providers`
  (that would make `providers → ats-adapters → providers`, a cycle). Given
  how small these helpers are (a handful of pure functions), the
  pragmatic option is for `ats-adapters` to own its own minimal copies
  rather than stand up a new shared package for ~50 lines of code —
  `packages/shared` already exists as a dependency-free home for
  cross-cutting infra (`config`, `logger`, `redis`, `queues/`) and would be
  the right place *if* this grows beyond a couple of functions, but that's
  an optional refinement, not a blocker.
- **Error contract**: `Fetcher` returns `ProviderResult<T>`
  (`ok`/`error`/`retryable`/`ProviderErrorType`); `AtsAdapter` currently
  just throws. Keep `ats-adapters` throwing typed errors (simpler, and
  `CompanyWatchService.syncCompany`'s existing try/catch already expects
  this) — the `providers`-side `Fetcher` wrapper catches and re-wraps into
  `ProviderResult` at the boundary. This is an explicit adapter-boundary
  decision, not an implicit behavior change.

## Migration Strategy

Phased so each step is independently shippable and revertable; nothing is
deleted until its replacement has run and been observed.

**Phase 1 — Build `packages/ats-adapters` as a pure addition**
Implement `AtsAdapter`/`AtsRawJob`/`AtsConfig` once. Port Greenhouse first
(smallest, best-covered on both sides). Test against both existing
providers' and company-watch's current fixtures to prove behavioral parity
before anything switches over. Nothing consumes this package yet — zero
risk to production code paths.

**Phase 2 — Migrate Company Watch onto the shared adapters**
Lower blast radius than Phase 3: fewer production tenants than the global
Vacancy Sync pipeline, and `company-watch-service.test.ts` already exercises
adapter substitution through the registry seam. Swap
`AtsAdapterRegistry` to build from `packages/ats-adapters`, one ATS type at
a time; call sites (`registry.get(atsType)`) don't change. Delete the local
`packages/company-watch/src/adapters/{ats}-adapter.ts` files once each is
confirmed. Add SmartRecruiters/Recruitee adapters here — closes the
existing gap independent of anything on the Provider side.

**Phase 3 — Migrate Provider fetchers**
One ATS at a time: `GreenhouseFetcher` becomes a thin wrapper delegating to
`ats-adapters`' adapter, mapping `AtsRawJob → RawJob`. `Fetcher`'s public
contract (`search`/`getVacancy`/`fetchWithCursor`/`ping`) doesn't change, so
existing fetcher test suites should mostly pass unmodified. Do this
sequentially, with each ATS observed in production (via the existing
`ProviderDiagnosticsService` / health monitor / `ProviderManagementService.
calculateProviderQuality` as a canary signal) before moving to the next —
these providers feed live matching/ranking for every workspace.

**Phase 4 — Cleanup**
Remove dead duplicate parsing code. Update ADR-008 (Provider Architecture)
and ADR-022 (Provider SDK) to reference the shared adapter layer. Update
`docs/product/CURRENT_FEATURES.md` once shipped (per the standing
documentation-sync rule).

## Compatibility

- **`Fetcher`** (`packages/providers/src/interfaces/fetcher.ts`) —
  unchanged. `ProviderSearchService`, `ProviderRegistry`,
  `SyncSchedulerService`, `DefaultProviderJob` keep working against
  `Fetcher`/`RawJob` exactly as today.
- **`AtsAdapter`** (`packages/company-watch/src/adapters/base-adapter.ts`) —
  unchanged in shape (`fetchJobs`/`fetchJob`/`ping`); `AtsAdapterRegistry`'s
  public API (`get`/`has`/`getAll`/`getSupportedTypes`) unchanged.
- **Database** — no schema changes. `ProviderConfig`, `CompanyWatch`,
  `CompanyWatchEvent`, `VacancySource` all stay as-is; this is an
  application-layer refactor only.
- **API routes** — no changes to `provider-management-routes.ts`,
  `application-routes.ts`, or any company-watch route.
- If the stronger consolidation is taken (retiring `AtsJob` in favor of
  `AtsRawJob` everywhere), `company-watch`'s `NormalizationService`/
  `DeduplicationService` need mechanical field-rename updates
  (`externalId` ↔ `sourceId`), not logic changes.

## Risks

1. **Untested per-ATS quirks.** Greenhouse's near-identity between the two
   implementations may not generalize to Workday (tenant/region URL
   scheme) or Lever (postings vs. opaque-postings) without a closer look.
   Mitigation: diff each ATS pair explicitly during its Phase-1/3 port,
   don't assume free consolidation from the Greenhouse sample alone.
2. **Dependency cycle** if `ats-adapters` naively imports
   `resilient-fetch`/logger/metrics from `providers`. Mitigation: keep
   small local copies in `ats-adapters` (see Proposed Architecture), or
   extract into `packages/shared` if the helper set grows.
3. **Error-contract mismatch** (`ProviderResult` vs. throw) must be handled
   explicitly at the `Fetcher` wrapper boundary, not left implicit — see
   Design details above.
4. **Live-traffic regression risk on Phase 3.** These ATS providers feed
   production `Vacancy`/`MatchResult` data for every workspace; a subtle
   parsing regression (e.g. salary off by a factor of 100) could silently
   degrade match quality. Mitigation: per-ATS canary via the existing
   quality-score mechanism, one ATS at a time, not a batch cutover.
5. **Test debt.** ~40 existing test files across both packages assert on
   today's exact field names. Public shapes at each boundary (`RawJob`,
   `AtsJob` or its replacement) must stay stable during migration so this
   isn't a single giant test-rewrite PR.
6. **Scope creep temptation.** The normalization/dedup duplication
   (`NormalizationService`/`DeduplicationService` vs.
   `DefaultNormalizationPipeline`/`DeduplicationEngine`) is real but is
   explicitly out of scope here — pulling it in doubles the risk surface
   of every phase above.

## Estimated Implementation Effort

Rough sizing for one engineer already familiar with both packages;
excludes this review.

| Phase | Scope | Estimate |
|---|---|---|
| 1 | `ats-adapters` package + contracts + Greenhouse pilot + parity tests | 2–3 days |
| 1b | Port remaining 4 shared ATS types (Lever/Ashby/Workday/Teamtailor) + 2 new (SmartRecruiters/Recruitee) | 3–4 days |
| 2 | Migrate Company Watch registry, delete local adapters, regression-test | 1–2 days |
| 3 | Migrate Provider fetchers, one ATS at a time, prod canary each | 3–5 days (mostly sequencing/observation, not raw coding) |
| 4 | Cleanup, docs, ADR updates | 0.5 day |
| **Total** | | **~10–15 engineer-days**, likely 3–4 calendar weeks due to Phase 3's sequential canary requirement |

## Alternatives Considered

- **Do nothing.** Rejected — every future ATS parsing bugfix (salary
  format, new field, changed endpoint) has to be applied twice today and
  will silently drift the two implementations further apart; the
  SmartRecruiters/Recruitee gap above is an example of that drift already
  happening.
- **Merge Company Watch into the Provider/Vacancy Sync pipeline
  entirely.** Rejected — see Question 1: different tenancy model and
  downstream consumers; would force Company Watch through matching/ranking
  machinery it doesn't need.
- **Merge Provider entirely into Company Watch.** Rejected — Company
  Watch's event model doesn't fit `ProviderSearchService`/
  `DeduplicationEngine`/`MatchResult` consumers; would be a larger rewrite
  than the actual duplication justifies.

## Decision

Accepted. Greenhouse, Lever, and SmartRecruiters have shipped; remaining ATS
providers migrate on the same pattern (see addenda for precedent, and future
addenda as each ships).

## Addendum: Lever migration parity (Phase 1b, Lever only)

Following the same process used for Greenhouse (build shared adapter, migrate
Company Watch, migrate Provider, prove parity), Lever was read line-by-line in
both `packages/providers/src/providers/lever/lever-fetcher.ts` and
`packages/company-watch/src/adapters/lever-adapter.ts` before writing any
shared code. Risk #1 above ("Lever's near-identity with Greenhouse may not
generalize") was confirmed: **Lever's two implementations were never
behaviorally identical**, unlike Greenhouse's byte-identical pair. The
differences below are preserved exactly as they were pre-migration — nothing
was unified — and are pinned down by tests in
`apps/backend/src/__tests__/ats-adapter-parity.test.ts` (see the "documented
divergences" describe block) so a future refactor can't silently erase them.

| | `providers/.../lever-fetcher.ts` | `company-watch/.../lever-adapter.ts` |
|---|---|---|
| Listing URL | `{base}/{company}?mode=json&skip={n}&limit={n}` — always paginated, default page 100 | `{base}/{company}` — bare, no params, fetches the entire board in one shot |
| Single-job fetch | None — `getVacancy` re-fetches page 0 via `search({})` and finds the id client-side; a job outside the first page is invisible to it | Real single-posting endpoint: `{base}/{company}/{externalId}` |
| Technologies | Copies the raw `tags` array verbatim | Regex-matches keyword patterns (`react`, `kubernetes`, `go`, ...) out of the description text — structurally different data source, not just a different format |
| Salary | Reads `salaryRange` (the field Lever's API actually returns — confirmed against both packages' existing fixtures) | Reads a field named `salary`, which does not exist on real Lever postings. This has therefore always evaluated to `undefined` in production — **found during this migration, not fixed**. Preserved as-is per "keep behavior identical"; flagging here as a candidate follow-up bugfix requiring explicit sign-off, same as the SmartRecruiters/Recruitee registry gap this ADR already flags above |
| Departments | Not a canonical concept — `department`/`team`/`commitment`/`allLocations`/`workplaceType`/`applyUrl` are kept separately under `RawJob.extensions` | Combines `categories.department` + `categories.team` into one `departments: string[]` |
| Description field order | `description ?? descriptionPlain ?? ''` | `descriptionHtml || description || ''` — but `descriptionHtml` is not a real Lever field (confirmed against both fixtures), so this has always fallen through to `description` in practice. The two are observably equivalent today, not truly unified |
| Response validation | Explicit: throws `'Response is not an array of Lever postings'` if the payload isn't an array, then filters each item through an `isValidJob` shape check before mapping | None: casts the response directly and maps unconditionally — a malformed payload fails with a native `TypeError`, not a custom message |
| Ping | HEAD against the paginated URL (`skip=0&limit=100`) | HEAD against the bare URL |

Because the two consumers never agreed on the listing shape, a single shared
`LeverAdapter` class (mirroring Greenhouse's `GreenhouseAdapter`, used
wholesale by both sides) could not serve both identically. The design that
emerged:

- `packages/ats-adapters/src/transport/lever-transport.ts` exports **both**
  URL shapes as distinct functions (`fetchPostingsPage`/`pingPostingsPage`
  for the paginated form, `fetchAllPostings`/`pingAllPostings` for the bare
  form, plus `fetchSinglePosting` for the real single-job endpoint) rather
  than one canonical builder.
- `packages/ats-adapters/src/adapters/lever-adapter.ts` (the `LeverAdapter`
  class) composes only the *unpaged* shape — this is what Company Watch's
  wrapper delegates to wholesale, same pattern as Greenhouse.
- `providers/.../lever-fetcher.ts` does **not** use that class. It imports
  the transport/parser functions directly and composes the *paginated* shape
  itself, same as it always has, keeping its own metrics/tracing/
  `ProviderResult` error envelope — same pattern `GreenhouseFetcher` already
  established (it also bypasses the shared `GreenhouseAdapter` class for the
  same reason: it needs its own error envelope, not the class's throw
  contract).
- `AtsRawJob.rawMetadata` carries the **entire untouched posting** for Lever
  (vs. just the `metadata` array for Greenhouse), because both consumers need
  different raw sub-fields (`tags` for Provider's tech extraction;
  `categories.department`/`team` for Company Watch's department combination;
  `workplaceType`/`applyUrl`/`categories.*` for Provider's `extensions`).
  Canonical `AtsRawJob.departments` is deliberately left unpopulated by the
  Lever parser (unlike Greenhouse, where both sides used it identically) —
  Company Watch's wrapper computes its own `departments` from `rawMetadata`.

No behavior changed for either consumer as part of this pass. The `salary`
field-name mismatch above is the one finding that looks like a genuine bug;
it is called out for a decision, not silently fixed.

## Addendum: SmartRecruiters migration (Phase 1b/2/3, SmartRecruiters only)

Unlike Greenhouse and Lever, this migration had no company-watch
implementation to diff against: `packages/company-watch/src/adapters/
adapter-registry.ts` had no `SmartRecruitersAdapter` at all —
`AtsAdapterRegistry.get('SMARTRECRUITERS')` threw, even though `AtsType`
already declared the enum value (the "concrete gap" flagged in this ADR's
Context section). The audit therefore compared `packages/providers/src/
providers/smartrecruiters/smartrecruiters-fetcher.ts` (the only prior
implementation) line-by-line, then closed the gap by building a new
company-watch adapter on top of the shared layer rather than porting an
existing one.

### What moved to `packages/ats-adapters`

- `src/transport/smartrecruiters-transport.ts` — `fetchPostingsPage`
  (offset/limit/optional `q`, matching the provider's original
  `buildSearchUrl`), `fetchSinglePosting` (404 → `null`, other non-ok →
  throws `AtsHttpError`), `pingPostings`.
- `src/parsers/smartrecruiters-parser.ts` — `isValidSmartRecruitersPosting`,
  `parseJob`, `parseJobsResponse` (filters then maps — SmartRecruiters, unlike
  Greenhouse, always validated in its one prior implementation, so there was
  no "consumer that skipped validation" divergence to preserve).
- `src/adapters/smartrecruiters-adapter.ts` — `SmartRecruitersAdapter` class.
  `fetchJobs` crawls every page up to the same `offset < 1000` cap the
  provider's original `search()` used, stepping by a fixed page size of 100
  (not by the actual returned count) — this exact stepping behavior is
  reproduced, not just approximated. Because there was no legacy
  company-watch shape to keep separate (unlike Lever), **this single class is
  used directly by company-watch's wrapper, the same way `GreenhouseAdapter`
  is** — not two divergent transport shapes.

### What stayed consumer-owned

- **Company name derivation (Provider only, and it's a bug).** The original
  `SmartRecruitersFetcher.parseResponse` set `RawJob.companyName` from
  `posting.department?.name ?? 'Unknown'` — the job's *department* ends up in
  the *company* field; the fetcher's own configured `companyName` is never
  used for this. Confirmed against the mapper test fixture (`smartrecruiters-
  mapper.test.ts` literally passes `companyName: 'Engineering'` as sample
  input). This is the same category of finding as Lever's `salary` bug: found
  during migration, preserved exactly, flagged here for a decision rather
  than silently fixed. It cannot affect company-watch, whose `AtsJob` type
  has no `companyName` field at all.
- **Technology extraction differs by design, not by accident.** Provider's
  fetcher always returns `technologies: []`; `SmartRecruitersMapper`
  regex-extracts them downstream from the description. Company-watch's new
  adapter extracts technologies itself, directly in `toAtsJob`, using the
  same keyword-pattern list already established by `LeverAdapter`/
  `AshbyAdapter` (SmartRecruiters postings carry no metadata array to key off
  of, unlike Greenhouse). Both consumers end up regex-matching the same
  description text, coincidentally, but at different layers — this was a
  deliberate design choice for the new adapter, not a preserved legacy
  divergence.
- **`ping` uses a plain GET, not HEAD.** Every other migrated ATS
  (Greenhouse, Lever) pings via HEAD; SmartRecruiters' original fetcher
  issued a normal GET against `postings?limit=1` and checked `response.ok`.
  Reproduced as-is in `pingPostings` — not unified with the HEAD convention.
- **No rate-limit-specific error classification (Provider only).**
  Greenhouse's and Lever's fetchers both special-case HTTP 429 into
  `RATE_LIMITED`; SmartRecruiters' `search()` never had this branch — any
  HTTP error (including 429) falls into `NETWORK_ERROR`. Preserved exactly;
  company-watch's new adapter throws a plain `SmartRecruiters API error: {status}
  {statusText}` for any non-ok status, same convention as every other
  company-watch adapter.
- **`fetchWithCursor` and `search()` classify errors differently from each
  other (Provider only, pre-existing, unrelated to this migration).**
  `search()` maps an `AtsHttpError`-shaped message to `NETWORK_ERROR`;
  `fetchWithCursor` does not perform that check at all and always falls
  through to `UNKNOWN_ERROR`, even for the identical underlying HTTP failure.
  This asymmetry predates the shared adapter and is reproduced unchanged.
- **`getVacancy` swallows every HTTP error as "not found" (Provider only,
  and it's a second bug).** The original code returned `{ok: true, data:
  null}` for *any* non-ok response, not just 404 — a 500 or 429 on a single-
  job lookup silently looks identical to "job doesn't exist." This diverges
  from Greenhouse's `getVacancy` (404 → `null`, everything else propagates as
  an error result). Reproduced by catching `AtsHttpError` broadly in the
  fetcher wrapper rather than fixing the classification. Company-watch's
  `fetchJob` has no such history to preserve and throws normally, like every
  other adapter.
- **Salary uses a falsy check, not a nullish check.** `parseSalary` treats
  `!salary.min && !salary.max` as "no salary" — a `min: 0, max: 0` posting is
  dropped, unlike Greenhouse's `== null` check (which would keep a genuine
  zero). Reproduced exactly in `smartrecruiters-parser.ts`.
- **Location defaults to `'Unknown'`, not `''` or `undefined`, when both
  `city` and `country` are empty.** The canonical parser leaves `location`
  `undefined` in that case (consistent with how Greenhouse/Lever's canonical
  parsers avoid consumer-specific defaults); the `'Unknown'` fallback is
  applied only in the provider's own `toRawJob`, matching where the original
  fetcher applied it.

### Verification

- `packages/ats-adapters`: new transport/parser/adapter unit tests (22
  cases) plus fixtures (`smartrecruiters-response.json`,
  `smartrecruiters-single-job.json`).
- `packages/providers`: `smartrecruiters-fetcher.test.ts` is new — no fetcher
  test existed before this migration (a pre-existing coverage gap, closed
  here) — 13 cases pinning every divergence above; existing mapper/
  normalizer/provider suites (24 tests) pass unmodified.
- `packages/company-watch`: new `smartrecruiters-adapter.test.ts` (7 cases).
- `apps/backend/src/__tests__/ats-adapter-parity.test.ts`: new "SmartRecruiters"
  describe block (4 cases) proving identical listing/salary/location parsing
  between both consumers where they now share code, and pinning the four
  provider-only divergences (429 classification, `getVacancy` error
  swallowing, `companyName`-from-department, technology-extraction layer)
  as regressions rather than prose.
- Full validation gate run for all four affected packages
  (`ats-adapters`, `providers`, `company-watch`, `apps/backend`): lint (0
  errors, pre-existing warning baseline unchanged), typecheck, `tsc` build,
  and test suites all green (60 + 37 + 38 + 523 tests respectively, including
  this migration's additions).

### Lessons learned

- A "gap" migration (no prior second implementation) is a different shape of
  work than a "duplication" migration (Greenhouse/Lever): there's no second
  set of behavior to diff, but there *is* a first set of undiscovered bugs to
  avoid baking into the new consumer. SmartRecruiters produced two
  bug-shaped findings (`companyName`-from-department, `getVacancy`
  swallowing all errors) purely from reading the one existing implementation
  closely, neither of which would have surfaced from a mechanical port.
- Because company-watch had nothing to preserve, its new adapter could
  reuse an existing sibling convention (the Lever/Ashby technology-regex
  helper) instead of inventing a third pattern — worth checking for on every
  "gap" ATS before assuming new code is needed.
- Two more registry gaps remain open per this ADR's Context section:
  Recruitee (provider stack exists, no company-watch adapter — same shape as
  SmartRecruiters) and Personio/BambooHR (`AtsType` declares them, no
  provider stack exists either). Recruitee is next in the migration order.

## Addendum: Recruitee migration (gap, same shape as SmartRecruiters)

Same shape as the SmartRecruiters gap: `AtsType` declared `RECRUITEE`, no
company-watch adapter existed. Ported `packages/providers/src/providers/
recruitee/recruitee-fetcher.ts` (the only prior implementation) into
`transport/recruitee-transport.ts` + `parsers/recruitee-parser.ts` +
`adapters/recruitee-adapter.ts`. Recruitee has no real single-job endpoint on
either side — `fetchJob` fetches the paginated listing (page/per_page, max 10
pages) and filters client-side, matching the provider's original
`getVacancy` exactly rather than inventing an unverified endpoint. New
`company-watch/src/adapters/recruitee-adapter.ts` closes the registry gap,
combining `department`/`team` into `departments` and deriving technologies
via the shared keyword-regex convention. No fetcher test existed before this
migration (closed, 12 new cases); no company-watch adapter test existed
either (closed, 7 new cases).

## Addendum: Comeet migration (providers-only, no company-watch consumer)

Comeet has no company-watch relevance at all — `AtsType` doesn't declare a
`COMEET` value (unlike Recruitee/SmartRecruiters, this ATS was never even a
declared gap), so this migration only touches `packages/ats-adapters` and
`packages/providers`. No `ComeetAdapter` class was built in `ats-adapters` —
nothing would consume it (avoiding a speculative abstraction); only
`transport/comeet-transport.ts` + `parsers/comeet-parser.ts` exist, consumed
directly by `providers/comeet-fetcher.ts`, the same way Greenhouse/Lever
bypass their own Adapter classes. `companyName` comes from the API response
itself (`job.company_name`), not the fetcher's configured company name —
verified as Comeet's actual behavior, not the SmartRecruiters-style bug (the
fetcher never had its own `companyName` config field to begin with). No
fetcher test existed before this migration (closed, 11 new cases).

## Addendum: Ashby migration (replacement, not diff — broken company-watch implementation)

Unlike Lever (two genuinely different, both-working shapes) or SmartRecruiters/
Recruitee (a clean gap), Ashby's company-watch adapter was neither: it called
an undocumented GraphQL endpoint (`jobs.ashbyhq.com/api/non-user-graphql`)
with `variables: {}` — `jobBoardName` was required in `AtsConfig.metadata`
but never actually placed in the request, so it could not have selected a
specific company's board for any workspace. It also had zero test coverage
(no `ashby-adapter.test.ts` existed). This is a different class of finding
than a preserved bug like Lever's `salary` field or SmartRecruiters'
`companyName`-from-department: those were subtly wrong outputs on an
otherwise-functioning path; this was non-functional for its stated purpose.
Replaced outright with the shared adapter built from providers' proven,
documented REST Job Board API (`api.ashbyhq.com/posting-api/job-board/
{jobBoardName}`) — the first time company-watch's Ashby integration can
actually select a per-workspace board. New `company-watch/src/adapters/
__tests__/ashby-adapter.test.ts` (8 cases) asserts `jobBoardName` is present
in the request URL, pinning down the fix as a regression test.

## Addendum: Workday migration (replacement, not diff — broken company-watch implementation)

Same shape of finding as Ashby, for different reasons. Company-watch's prior
`WorkdayAdapter` built its request subdomain as `wd${site}` — conflating the
job board's `site` path segment (e.g. `External`) with Workday's actual
per-tenant pod number (`wd1`, `wd2`, `wd3`, ...), which are unrelated values
with no derivation from one to the other. Its single-job URL was also
missing the `/job/` path segment real Workday external paths carry (visible
in providers' own test fixtures: `externalPath` is always `/job/...`). It
also mapped `postedOn` — free text like `"Posted 3 Days Ago"` — straight
through `new Date(postedOn)`, which produces `Invalid Date` for every real
posting; providers' fetcher's regex-based relative-date parser was always
correct. Zero test coverage existed. Replaced with the shared adapter built
on providers' proven tenant/host/site URL scheme and the correct relative-
date parser (now shared, so both consumers benefit); `WorkdayAdapterConfig`
gained an optional `host` field so company-watch can specify the right pod,
same as providers' config always could. Company-watch's wrapper builds
`description` from `bulletFields` (more useful than providers' synthesized
placeholder text) as a deliberate per-consumer enrichment, same pattern as
Lever's wrapper computing its own `departments`. New `workday-adapter.test.ts`
(10 cases) pins the correct URL and valid-Date behavior as regressions.

## Addendum: Teamtailor migration (replacement, not diff — broken company-watch implementation)

Same shape again. Company-watch's prior `TeamtailorAdapter` authenticated
with an `X-Api-Key` header — not a header Teamtailor's API documents or
recognizes; the real scheme (confirmed by providers' fetcher and its
passing tests) is `Authorization: Token token=...` plus a required
`X-Api-Version` header. It also read job fields under names that don't exist
on the real Teamtailor Job resource (`description`/`description-html`
instead of `body`/`pitch`; `remote` instead of `remote-status`) and
hardcoded a career-site URL pattern (`jobs.teamtailor.com/jobs/{id}`) instead
of the real `careersite-job-url` link Teamtailor's API actually returns.
Zero test coverage existed. Its `included`-relationship resolution for
department/role *was* the correct JSON:API pattern, just built on the wrong
request — the shared parser now does that resolution correctly
(`teamtailor-parser.ts`), so `departments` is a real capability for
company-watch, not a placeholder. Unlike Ashby/Workday, Teamtailor does have
a real single-job endpoint on both sides, used directly by `fetchJob`. New
`teamtailor-adapter.test.ts` (8 cases) asserts the real auth headers and
department resolution.

## Addendum: cross-cutting cleanup after all eight ATS migrations

`packages/company-watch`'s six regex-based `extractTechnologies` methods
(Lever, SmartRecruiters, Recruitee, Ashby, Workday, Teamtailor adapters) plus
the two fallback adapters (`CustomHtmlAdapter`, `JsonLdAdapter`) were
byte-identical — eight copies of the same keyword-pattern list and loop.
Consolidated into `packages/company-watch/src/adapters/technology-keywords.ts`
(a single `extractTechnologies` export), imported by all eight. This stays
inside `company-watch` rather than moving to `packages/shared` or
`packages/ats-adapters`: `providers` already has its own equivalent
(`shared/tech-keywords.ts`), and the two packages must not depend on each
other (see this ADR's "Dependency fact that shapes the design"). All eight
ATS providers/adapters are now migrated; `AtsAdapterRegistry` builds every
non-fallback adapter from `@careeros/ats-adapters`.
