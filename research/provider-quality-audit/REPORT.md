# Provider Quality Audit & Vacancy Ecosystem Review

> Generated 2026-07-29 · Architecture & product audit only — no implementation in this pass.
> Scope: all 23 registered job providers in `packages/providers/src/providers/`, plus the
> Company Watch subsystem (`packages/company-watch/`), plus new-provider research.
> Context: EPIC-12 is paused after Phase 3; this audit is the gate before resuming the AI
> pipeline. Goal is **quality over quantity** — every kept source should let a user actually
> apply, with real structured data, and low duplication.

---

## Cross-Cutting Findings (read this before the tables)

These affect the whole audit and change several per-provider recommendations below.

### 1. LinkedIn's backend provider violates the project's own ADR and is redundant with a safer system already built

`packages/providers/src/providers/linkedin/` scrapes `www.linkedin.com` via an unofficial "Guest API." This is exactly what **ADR-013 (LinkedIn Integration Strategy)** decided *not* to do — its own audit note (added 2026-07-23) already flags this as an unresolved conflict between the accepted decision and the shipped code. LinkedIn's ToS explicitly prohibits scraping; *hiQ v. LinkedIn* shows LinkedIn reliably wins on breach-of-contract even when CFAA claims fail, so the exposure (account/IP bans, cease-and-desist, contract claims) is real, not theoretical. The mapped `applyUrl` also points at LinkedIn's own `/jobs/view/<id>` page rather than the employer's original posting or a real apply flow — so it fails the "is direct application possible" test even setting legal risk aside.

The redundancy: `apps/extension/src/content/providers/linkedin/detector.ts` already implements ADR-013's own approved path (**Option 1: Browser Extension** — user-installed, user's own authenticated session, no ToS violation). CareerOS is running the risky version *and* has already built the safe version.

**→ See Phase 2/7: disable the backend LinkedIn provider by default; the extension is the supported LinkedIn path.**

### 2. Five ATS providers are duplicated wholesale by the Company Watch subsystem

`packages/providers/src/providers/{greenhouse,lever,ashby,workday,teamtailor}/` are single-tenant (one hardcoded company per env var, confirmed in `apps/backend/src/container.ts:330-476`). `packages/company-watch/src/adapters/` independently implements **the same five ATS integrations** (`greenhouse-adapter.ts`, `lever-adapter.ts`, `ashby-adapter.ts`, `workday-adapter.ts`, `teamtailor-adapter.ts`) as part of a purpose-built multi-company registry (ADR-010), which is the correct architecture for "watch companies by ATS type" — it has a `CompanyWatch` DB registry, `CompanyDiscoveryService` (auto-detects ATS from a URL), and per-company polling. The single-tenant versions in `packages/providers/` can only ever surface one employer's jobs each; they predate ADR-010 and were never retired.

This is a direct instance of the "no parallel services with overlapping responsibility" problem — it already happened once in this codebase.

**→ See Phase 2/3: deprecate the single-tenant Greenhouse/Lever/Ashby/Workday/Teamtailor entries in `packages/providers/`; Company Watch is the correct home for ATS aggregation going forward.**

SmartRecruiters, Recruitee, and Comeet have **no** Company Watch equivalent yet (ADR-010 lists SmartRecruiters/Recruitee as "Phase 2 (Future)"; Comeet isn't planned there at all) — those three stay in `packages/providers/` for now, but any future ATS provider (see Phase 4/5, e.g. Workable) should be built as a **Company Watch adapter**, not a new single-tenant `packages/providers/` entry.

### 3. Three overlapping, disagreeing quality/dedup calculations already exist

- `packages/providers/src/deduplication/deduplication-engine.ts` — per-sync-batch exact + fuzzy (Levenshtein, company+title) dedup.
- `packages/career` canonical matching (ADR-030) — cross-source, cross-sync weighted matching (title 30%, company 30%, location 15%, remote 10%, employment 5%, salary 10%; threshold 0.75), with ATS > Job Board > Community > Manual priority for merge conflicts. This is the most sophisticated and most authoritative signal.
- `apps/backend/src/services/ranking/provider-quality-calculator.ts` — a **third**, weaker duplicate-rate calculation (naive exact-title string count only, no company field, no fuzzy match) used solely as a ranking-weight input, and totally ignorant of the canonical matching system's better data.

Separately, `apps/backend/src/services/provider-management-service.ts#calculateProviderQuality()` is a **fourth**, independent quality score (different weights, different inputs) that feeds the dashboard's Provider Quality page and persists to `ProviderConfig.qualityScore`. It and the ranking calculator can disagree about the same provider on the same day. **Neither** reads `VacancySource.applyUrl` — the ranking calculator's own comment admits it hardcodes `applyUrlAvailability = 50` as a "neutral default" because "Apply URL not available from Vacancy entity," even though ADR-030 (2026-07-23) already added `applyUrl` to `VacancySource`.

**→ See Phase 6: consolidate into one `ProviderQualityScoreService`, not a third/fifth implementation.**

### 4. Adzuna's mapped URL is an affiliate/tracking redirect, not the original posting

Adzuna's `redirect_url` is Adzuna's own tracking/affiliate link, not the employer's or the original board's page — this is precisely the "redirects through third-party aggregators" pattern the project goals ask to avoid. It also hardcodes `remote: false` (no real remote detection) and tag-extracts technologies heuristically from free text.

### 5. Telegram has no channel-curation or moderation policy

Telegram is architecturally sound (public preview-page scraping is low legal risk, unlike LinkedIn — no login, no ToS acceptance gate), but its actual quality is 100% a function of which channels happen to be configured via `TELEGRAM_CHANNELS`/DB, with zero vetting workflow today. Channels frequently repost other boards' listings (duplicate risk) and the fetcher's own apply-link fallback is the bare `t.me` post URL when no external link is found in the post text — i.e., "direct application" degrades to "read a Telegram post" for an unknown fraction of listings.

---

## Phase 1 — Provider Audit Table

All 23 currently-registered providers (`apps/backend/src/container.ts`). "Quality score" is qualitative (no live-data pull was run in this pass — see Phase 6 for making this a real number).

| Provider | Status | Quality | Free to apply | Structured data | Salary | Remote | Duplicate rate | Recommendation |
|---|---|---|---|---|---|---|---|---|
| **HeadHunter** (`hh`) | Maintained, official API | High | Yes — direct to hh.ru | Good (salary, real remote via `schedule`) | Yes | Yes (real) | Low | **Keep — Tier S** |
| **Himalayas** | Maintained, official API | High | Yes — `applicationLink` often a real direct link | Good (real categories) | Yes | Yes (remote-only board) | Moderate | **Keep — Tier S** |
| **SuperJob** | Maintained, official API (needs key) | High | Yes — direct to superjob.ru | Good, real salary from/to | Yes | No filter | Low | **Keep — Tier S** (CIS) |
| **Habr Career** | Maintained, RSS | High relevance, weak structure | Yes — direct to career.habr.com | Weak (no structured salary/company; regex best-effort) | Best-effort text only | Keyword-inferred | Moderate (CIS overlap) | **Keep — Tier S** (CIS priority; consider headless-browser upgrade later for real fields) |
| **RemoteOK** | Maintained, official API | Medium-High | Yes, but via RemoteOK's own listing page | Good (real tags) | Yes | Yes (remote-only) | **High** (heavily mirrored) | Keep — Tier A |
| **Remotive** | Maintained, official API | Medium-High | Redirects to Remotive's own page, not company | Good (real tags) | Yes | Yes (remote-only) | Moderate | Keep — Tier A |
| **Arbeitnow** | Maintained, official API | Medium | Redirects to Arbeitnow's own page | Real tags; salary field exists but `salaryData` capability flag is wrongly `false` (bug) | Yes (mis-flagged) | Yes (real) | Low-Moderate | Keep — Tier A, **fix capability flag bug** |
| **Adzuna** | Conditionally registered (needs key) | Medium | **No** — `redirect_url` is Adzuna's own affiliate/tracking link | Salary yes; remote hardcoded `false`; tags heuristic | Yes | No detection | Low (own index) | Tier B — **review against "no aggregator redirect" goal** |
| **Jobicy** | Maintained, official API | Medium-Low | Redirects to Jobicy's own page | `fullDescription: false` — excerpt only, hurts AI matching | Yes | Yes (remote-only) | Moderate | Tier B |
| **We Work Remotely** | Maintained, RSS (regex-parsed) | Medium-Low | Yes — WWR's own job page | No salary; single weak category tag; **unstable `sourceId`** (array index, not a stable key) actively hurts incremental dedup | No | Yes (remote-only) | **High** (well-mirrored board) | Tier B — **fix sourceId stability before relying on it** |
| **Working Nomads** | Maintained, official API | Medium-Low | Yes, direct listing URL | No salary; always full-refetch (no incremental cursor — wastes rate-limit budget) | No | Yes (hardcoded) | Moderate | Tier B — add incremental cursor |
| **NoDesk** | Maintained, RSS (regex-parsed) | Low | Yes — RSS `<link>` | Company name **always "Unknown"** — real metadata defect | No | Yes (hardcoded) | Moderate | **Deprecated** until company extraction is fixed |
| **HN Who's Hiring** | Maintained, official Firebase/Algolia API | Low-Medium | Sometimes — often falls back to bare HN comment permalink | Fragile heuristic text parsing of unstructured monthly-thread comments; company often "Unknown" | No | Yes (hardcoded) | Low (niche) | Tier B — inherently format-capped, don't over-weight in ranking |
| **Telegram** | Conditionally registered (needs channels) | Depends entirely on channel curation | Sometimes — falls back to bare `t.me` post link | Best-effort text-mined; no salary structure | Rare | Keyword-inferred | **High** (channels reshare other boards) | Tier B — **needs a formal channel allowlist/review policy before treating as core** |
| **Greenhouse** | Conditionally registered, single-tenant | High per-listing, near-zero volume (1 company) | Yes — company's own Greenhouse board | Weak (no salary; location text only) | No | Text-inferred | Low | **Deprecated — duplicated by Company Watch's `greenhouse-adapter.ts`** |
| **Lever** | Conditionally registered, single-tenant | High per-listing, near-zero volume | Yes — company's own Lever board | Real `salaryRange`, real `workplaceType` enum | Yes | Yes (structured) | Low | **Deprecated — duplicated by Company Watch's `lever-adapter.ts`** |
| **Ashby** | Conditionally registered, single-tenant | High per-listing, near-zero volume | Yes — company's own Ashby board | Structured `isRemote`; no salary | No | Yes (structured) | Low | **Deprecated — duplicated by Company Watch's `ashby-adapter.ts`** |
| **Workday** | Conditionally registered, single-tenant | Medium (bot-detection prone), near-zero volume | Yes — company's own Workday site | No salary; text-inferred location | No | Text-inferred | Low | **Deprecated — duplicated by Company Watch's `workday-adapter.ts`**; also highest-effort/least-reliable ATS integration per external research |
| **Teamtailor** | Conditionally registered, single-tenant, requires paid-tier API key | High per-listing, near-zero volume | Yes — company's career site | No salary | Attribute present but parsing simplified | Low | **Deprecated — duplicated by Company Watch's `teamtailor-adapter.ts`** |
| **SmartRecruiters** | Conditionally registered, single-tenant | Medium, near-zero volume | Yes — company's own application page | Structured salary object (often null) | No | Low | Tier B — keep for now; **earmark for Company Watch Phase 2 adapter** (already planned in ADR-010) |
| **Recruitee** | Conditionally registered, single-tenant | Medium-High, near-zero volume | Yes — company's own Recruitee page | Real `salary_from/to`, real `remote` boolean | Yes | Yes (structured) | Low | Tier B — keep for now; **earmark for Company Watch Phase 2 adapter** |
| **Comeet** | Conditionally registered, single-tenant | Medium, near-zero volume, niche (IL-heavy) | Yes — company's own Comeet page | Salary capability flag overstates reality (relies on optional free text) | Claimed but weak | Structured `is_remote` | Low | Tier B — lowest priority of the ATS set; no Company Watch equivalent even planned |
| **LinkedIn** | **Enabled by default**, unofficial scrape | Low, high legal risk | **No** — routes to LinkedIn's own `/jobs/view/<id>`, not employer or a real apply flow | No salary | Text-inferred | High (cross-posted everywhere) | **Disable by default now** — violates ADR-013, real ToS/legal exposure, redundant with the already-built browser-extension capture path |

---

## Phase 2 — Provider Tiers

**Tier S — Core (must keep, high value, low risk):** HeadHunter, Himalayas, SuperJob, Habr Career.

**Tier A — Recommended:** RemoteOK, Remotive, Arbeitnow (once the `salaryData` capability bug is fixed).

**Tier B — Optional / needs work before elevating:** Adzuna (pending affiliate-redirect review), Jobicy, We Work Remotely, Working Nomads, HN Who's Hiring, Telegram (pending curation policy), SmartRecruiters, Recruitee, Comeet.

**Deprecated (keep `VacancySource` history, stop scheduling, hide from default UI, document reason):**
- **Greenhouse, Lever, Ashby, Workday, Teamtailor** (single-tenant versions) — superseded by Company Watch's adapters of the same name; the env-var-single-company pattern can't scale and duplicates a purpose-built subsystem.
- **NoDesk** — company extraction is fundamentally broken ("Unknown" always); actively works against the "high metadata completeness" goal until fixed.

**Disabled (turn off now — this is a risk fix, not routine cleanup):**
- **LinkedIn** — ToS violation, contradicts the project's own accepted ADR, real legal exposure, and redundant with the already-built browser-extension capture path.

---

## Phase 3 — How to Disable/Deprecate (mechanism already exists — reuse it)

No new mechanism is needed. `ProviderManagementService.updateProvider()` (`apps/backend/src/services/provider-management-service.ts:231`) already:
- Sets `ProviderConfig.enabled = false` in Postgres (config persists, not deleted).
- Calls `syncScheduler.stopProvider()` — stops scheduling immediately.
- Is exposed via `PATCH /providers/:providerId` (`apps/backend/src/routes/providers/provider-management-routes.ts:34`) and the Settings → Providers dashboard page (`apps/dashboard/.../settings/providers/page.tsx`), which already has enable/disable toggle UI (`Power`/`PowerOff` icons).
- Never touches `Vacancy`/`VacancySource` rows — historical data survives automatically, satisfying "preserve historical VacancySource data" without any extra work.

What's genuinely missing (a small schema gap worth flagging, not fixing now — Phase 7 is audit-only):
- `ProviderConfigData` has no dedicated `tier` or `deprecationReason` field — today that classification would have to be stuffed into the free-text `status` string. Recommend adding `tier: 'S' | 'A' | 'B' | 'DEPRECATED' | 'DISABLED'` and `deprecationReason: string | null` columns to `ProviderConfig` at implementation time, so this audit's classification becomes a durable, dashboard-visible fact instead of a one-off document that goes stale. (Not implemented in this pass, per instructions.)

**Action to take when this report is approved:** `PATCH` each Deprecated/Disabled provider above with `{ enabled: false }` and a `status` note; no code deletion required.

---

## Phase 4 — New Provider Candidates

| Candidate | Technical feasibility | API/scraping | Legal | Expected quality | Recommendation |
|---|---|---|---|---|---|
| **Y Combinator Jobs** (workatastartup.com) | High | Public JSON endpoints (`workatastartup.com/companies`, `api.ycombinator.com/v0.1/companies`, `workatastartup.com/jobs`) used with no auth by the entire third-party-scraper ecosystem — closer to an accessible internal API than true scraping | Low-Medium (undocumented internal API, could change without notice) | High — structured salary, equity, visa, skills, company/founder metadata | **Implement — P1** |
| **Djinni** (djinni.co, CIS) | Medium | Scraping only, reverse-engineering repos exist (per existing `research/job-sources-russian-sw/REPORT.md`) | Medium | High — ★★★★★ CIS relevance in existing research | **Implement — P1** (matches CIS priority) |
| **Workable** | Medium | Public per-company Job Board API (`apply.workable.com/api/v1/widget/accounts/{account}`), same single-tenant-per-company shape as Greenhouse/Lever — no aggregate multi-company endpoint; rendered shape varies free vs. paid plan | Low (public, no-auth reads) | High per-listing | **Implement as a 6th Company Watch adapter — P1** (do not repeat the single-tenant `packages/providers/` mistake) |
| **Wellfound** (formerly AngelList Talent) | Low | No official candidate-facing job API found — only unofficial third-party scrapers (Apify etc.) | High (same ToS category as LinkedIn) | Unknown until legit access exists | **Hold — P2.** `ADR-030`'s `PROVIDER_PRIORITY` table already reserves a `wellfound` provider id; only build it if/when a real partner API appears. Do not scrape — repeats the exact LinkedIn mistake this audit just flagged. |
| **Otta** | Low | Otta was acquired by Welcome to the Jungle (Jan 2024) and is being rebranded; no official API found for either brand | High (same caution as Wellfound) | Unknown | **Hold — P2**, and rename the anticipated target from "Otta" to "Welcome to the Jungle" in any future planning docs |
| **Remote.co** | Low | No API/RSS found; appears to be a curated directory without programmatic access | Unknown | Unknown | **Skip / dead end** unless a partner arrangement surfaces |
| **Jobspresso** | Low-Medium | 100% hand-curated listings, no documented API; worth checking for an undocumented RSS/WordPress feed before building a scraper | Medium (small curated board — check ToS) | Medium-High (curated, low-spam) | **P2** — check for an RSS feed first; otherwise low priority |
| **Cord (cord.co)** | Low | No evidence of an active job-board API; low current search visibility suggests low relevance today | Unknown | Unknown | **Skip** — insufficient evidence this is a valuable active source |
| **Arc.dev** | N/A | Talent marketplace, supply-side only — no job board to integrate against (confirmed in existing internal research) | N/A | N/A | **Dead end** (already documented) |
| **FlexJobs** (evaluation only) | N/A | Candidate-facing $24.95/mo paywall | N/A | N/A | **Do not implement** — textbook "monetizes candidate access," exactly what the project goals say to avoid |
| **Indeed** (evaluation only) | N/A | Official API discontinued 2024; aggressive anti-bot enforcement, no viable public access | High | N/A | **Do not implement** (dead end) |
| **Personio** (DACH) | Medium | XML feed only, per-company | Low | Medium | **P2** — Company Watch Phase 2 adapter (already planned in ADR-010) |
| **BambooHR** | Medium | Public per-company JSON | Low | Medium | **P2** — Company Watch Phase 2 adapter (already planned in ADR-010) |
| **JustJoin.it / Pracuj.pl** (Poland) | Medium | Internal JSON, undocumented but stable per existing research | Low-Medium | High (strong salary transparency) | **P2** — from existing `research/job-sources-russian-sw/REPORT.md` Tier A list |

---

## Phase 5 — Implementation Priority Roadmap

**P0 — highest value, lowest effort, do first (risk fixes, not features):**
1. Disable the backend LinkedIn provider by default (`LINKEDIN_ENABLED=false` as the shipped default, not just an opt-out env var) — near-zero effort, removes the single biggest legal-risk item in the audit.
2. Deprecate the single-tenant Greenhouse/Lever/Ashby/Workday/Teamtailor entries via the existing `PATCH /providers/:id` toggle — removes duplicated-subsystem confusion at near-zero effort.
3. Fix or deprecate NoDesk's "Unknown"-company defect.
4. Draft and apply a Telegram channel-curation policy (allowlist + periodic review cadence) before treating it as a trusted core source.
5. Fix Arbeitnow's `salaryData` capability-flag bug (data exists, flag says it doesn't).

**P1 — strong additions:**
1. Y Combinator / Work at a Startup provider.
2. Djinni (CIS relevance).
3. Workable, built as a Company Watch adapter (not a new single-tenant provider).
4. Consolidate the ranking-service and provider-management quality calculators into the single Provider Quality Score design (Phase 6) and wire `applyUrlAvailability` to the real `VacancySource.applyUrl` data ADR-030 already introduced.

**P2 — future:**
1. Wellfound / Welcome to the Jungle — only if/when a real partner API exists.
2. Personio, BambooHR as Company Watch Phase 2 adapters (already planned in ADR-010).
3. JustJoin.it, Pracuj.pl, and the rest of the existing research doc's Tier A European boards.
4. Jobspresso (check for an RSS feed before scraping).

**Not recommended:** Remote.co, Cord.co, Arc.dev, FlexJobs, Indeed.

---

## Phase 6 — Provider Quality Score: Target Architecture (design only, not implemented)

### Why not build a third/fifth scorer

Per the reuse-before-creating rule, and per Finding #3 above: two quality-adjacent scorers already exist (`provider-quality-calculator.ts` for ranking, `ProviderManagementService.calculateProviderQuality()` for the dashboard), plus two dedup-adjacent systems (`DeduplicationEngine`, canonical matching from ADR-030). A new Provider Quality Score must **replace and consolidate**, not add a fifth calculation.

### Design

**One service**, e.g. `ProviderQualityScoreService`, as the single source of truth for both the ranking engine and the dashboard:

| Factor | Current source (weak/duplicated) | Target source (real signal) |
|---|---|---|
| Freshness | `Vacancy.publishedAt` age bucket only | Also fold in `VacancySource.lastSeenAt` / `lastSuccessfulSync` (already tracked per ADR-030) |
| Salary / company availability | Null-rate on `Vacancy` fields (fine, keep) | Same, unchanged |
| Structured metadata completeness | Only salary + company checked | Extend to remote-type-known and employment-type-known, both first-class fields since ADR-030 |
| Duplicate rate | Naive exact-title string count (ranking calculator) *or* invalid-`sourceUrl` count (management service) — two different weak proxies | Read directly from the canonical matching system's actual match stats (sources-per-canonical-Vacancy vs. total ingested) |
| AI extraction / parsing quality | Not measured | Static per-provider weight from `ProviderCapabilities`, extended with a `dataQuality` tier (`structured` vs. `best-effort-text-mined`) — distinguishes e.g. Lever's real `salaryRange` from Habr Career's regex-guessed salary |
| Successful parsing rate / reliability | Tracked but not folded into any score | Pull from `ProviderDiagnosticsService` + `SyncSchedulerService`'s existing per-provider failure/health tracking |
| Direct application availability | Hardcoded `50` "neutral default" (ranking calculator's own comment admits this is a stopgap) | New signal from `VacancySource.applyUrl` presence **and** whether it resolves to the source's own/employer's domain vs. an aggregator's affiliate/redirect domain (the Adzuna/RemoteOK/Remotive pattern this audit found) — needs a small per-provider `isDirectApply: boolean` config since domain-string heuristics alone won't catch every case |

**Versioning:** give the consolidated score an explicit version constant, the same pattern already used for the AI matching algorithm (`CURRENT_MATCHING_ALGORITHM_VERSION` in `packages/ai/src/matching/matching-algorithm-version.ts`), so historical scores don't silently become incomparable when the formula changes.

**Integration points:**
- `vacancy-ranking-service.ts`'s existing "Provider quality" ranking weight (5/100 today) reads from this one service instead of computing its own inline copy.
- `GET /providers/quality` and the Settings → Providers dashboard page read the same service, so the two UIs can never disagree about the same provider again.
- Computed on a schedule (e.g. a small daily BullMQ job), not per-request — several inputs (`countDistinctCompaniesByProvider`, canonical-match stats) are DB scans, and `ProviderConfig.qualityScore` already exists as a place to cache the result.
- Add `ProviderConfig.tier` (derived from score bands, e.g. ≥85 → S, ≥70 → A, ≥50 → B, <50 → flagged for review) so this audit's classification becomes a durable, dashboard-visible fact instead of a document that goes stale the next time a provider's data quality changes.

**Not implemented in this pass**, per Phase 6 instructions — this is the target architecture for a future implementation task.

---

## Phase 7 — Final Recommendation

**1. Providers to keep (Tier S/A):** HeadHunter, Himalayas, SuperJob, Habr Career, RemoteOK, Remotive, Arbeitnow.

**2. Providers to disable now (risk, not cleanup):** LinkedIn (backend scraper) — flip the default off; the browser extension is the supported LinkedIn path.

**3. Providers to deprecate (stop scheduling, hide from default UI, keep history, document reason):** Greenhouse, Lever, Ashby, Workday, Teamtailor (single-tenant versions — superseded by Company Watch), NoDesk (broken company extraction).

**4. Providers to leave as-is for now, with follow-up earmarked:** Adzuna (affiliate-redirect review), Jobicy, We Work Remotely (sourceId bug), Working Nomads (no incremental cursor), HN Who's Hiring, Telegram (needs curation policy), SmartRecruiters/Recruitee/Comeet (earmarked for Company Watch migration).

**5. New providers to implement first (P0/P1):** Y Combinator Jobs, Djinni, Workable-as-Company-Watch-adapter.

**6. Estimated engineering effort:**
| Item | Effort |
|---|---|
| Disable LinkedIn by default | Trivial (config flip) |
| Deprecate 5 single-tenant ATS providers | Trivial (existing `PATCH` toggle, no code changes) |
| Fix NoDesk company extraction | Small (1 file) |
| Fix Arbeitnow capability flag | Trivial (1 line) |
| Telegram channel-curation policy | Small (process + allowlist, not code) |
| Y Combinator Jobs provider | Medium (new Fetcher/Mapper/Normalizer/SyncStrategy, same pattern as existing 23) |
| Djinni provider | Medium (scraping-based, same pattern) |
| Workable as Company Watch adapter | Medium (new adapter, reuses Company Watch scaffolding) |
| Provider Quality Score consolidation | Medium-Large (touches ranking service, dashboard routes, provider config schema, canonical-matching read path) |

**7. Recommended implementation order:** the five P0 risk/cleanup items first (all trivial-to-small, ships this week) → Provider Quality Score consolidation (unblocks trustworthy tiering going forward) → Y Combinator Jobs + Djinni + Workable-as-Company-Watch-adapter (P1 net-new value) → P2 items opportunistically.

This report is an audit and roadmap only. No provider code, schema, or configuration was changed in this pass — awaiting review before any of the above is implemented.
