# Free Provider Expansion — Architecture Review & Source Research

**Date:** 2026-07-30
**Status:** Research only. No source, config, schema, or `.env` files were modified as part of this pass. Nothing here should be implemented without the phase-by-phase sign-off described in `EPIC.md`.
**Scope:** Full architectural review of CareerOS's provider stack (Graphify-assisted) + exhaustive research into FREE software-engineering vacancy sources, prioritized per the 13-category order below, tiered A/B/C, and mapped onto the existing Provider / ATS-Adapter / CompanyWatch / SocialMessage architecture.
**Builds on:** `research/job-sources-russian-sw/REPORT.md` and `CIS-ROADMAP.md` (2026-07-21/23) — this document does not re-litigate their verdicts, it extends past their gaps. Raw per-category research (full detail, every source, every robots.txt/API check performed) is preserved in `research/free-provider-expansion/raw/`.

---

## 1. Executive summary

CareerOS's provider architecture is in unusually good shape to absorb new free sources cheaply — three pieces of existing infrastructure do most of the work already:

1. **`packages/ats-adapters`** (ADR-033) — a shared ATS layer used by both the global Provider/Vacancy-Sync pipeline and the per-workspace CompanyWatch pipeline. Adding a new ATS platform here (one adapter) unlocks every company that uses that platform, for both consumers, at once.
2. **`CustomHtmlAdapter` / `JsonLdAdapter`** (`packages/company-watch/src/adapters/`) — a generic scraper for any company career page emitting schema.org `JobPosting` JSON-LD. This already solves "can we ingest company X's career page" for a large fraction of the internet; the open problem is *discovery* (which companies, which URLs), not ingestion capability.
3. **`SocialMessageTransport` / `TransportCapability`** (ADR-032) — a platform-agnostic community-source pipeline (Telegram today, designed for Discord/Slack/Reddit/X/VK). New community platforms plug in as a transport, not a new pipeline.

The single biggest finding of this research: **most of the highest-value new sources are not new source *types*, they're new instances of patterns CareerOS already has.** Two genuinely new ATS adapters (Personio, Workable) both verified live with free, unauthenticated, per-company endpoints — structurally identical to the Greenhouse/Lever adapters already shipped. Several RSS/REST aggregators (dou.ua, Landing.jobs, PyJobs, Django Jobs, a16z Speedrun) slot into the exact `Fetcher → Mapper → Normalizer` pattern Remotive/Arbeitnow/WWR already use. The one genuinely *new* piece of infrastructure worth building is a periodic bulk-discovery job (Web Data Commons / Common Crawl JobPosting extraction, or the VC/YC/CNCF company lists below) that feeds the existing `JsonLdAdapter` at scale instead of one company at a time.

The second biggest finding: **several sources that look attractive on the surface fail CareerOS's own hard-won product requirements** — specifically the direct-apply requirement that got RemoteOK removed (ADR-034). Y Combinator's "Work at a Startup" is confirmed **not** direct-apply (introduction-only model). Otta no longer exists as an independent product (merged into Welcome to the Jungle). Wellfound has no API and an inconsistent apply flow. All three are recommended against, and the `otta` slot already reserved in `source-priority.ts` should be retired rather than implemented.

---

## 2. Architecture review (Graphify-assisted)

### 2.1 Current provider inventory (22 live sources, post-ADR-034)

| Provider | Type | Auth | Region | Notes |
|---|---|---|---|---|
| HeadHunter (`hh`) | Job Board | Optional token | RU/BY/KZ/UZ/KG/AZ (`HH_AREAS`) | Highest-priority CIS source |
| SuperJob (`superjob`) | Job Board | Free API key | RU | |
| Habr Career (`habr_career`) | Job Board | None (unofficial) | RU | |
| Telegram (`telegram`) | Community | None (scrapes `t.me/s/<channel>`) | RU/CIS | V1 regex-based; V2 (AI extraction via `SocialMessageTransport`) mid-migration per ADR-032 |
| Greenhouse, Lever, Ashby, Workday, Teamtailor, SmartRecruiters, Recruitee, Comeet | ATS | Varies (mostly none/board-token) | Per-company | All migrated onto shared `packages/ats-adapters` per ADR-033 |
| Adzuna | Job Board | App ID + key | GB/US/DE/FR/AT/BE/BR/CA/CH/IN/NL/PL/SG/ZA | |
| Remotive, Himalayas, Arbeitnow, Jobicy, We Work Remotely, Working Nomads, NoDesk | Job Board | None | Global remote | |
| HN Who Is Hiring | Community | None | Global | |
| LinkedIn | Job Board | None (unofficial direct scrape) | Global | Accepted ToS-risk precedent CareerOS already carries |

**Removed:** RemoteOK (ADR-034, 2026-07-30) — paid-access-to-apply violated the direct-apply requirement. **Never recommend bringing it back**, and its removal is the concrete precedent this research uses to reject similarly-shaped sources (Work at a Startup, Otta, Wellfound — see §4.5).

**Reserved but unimplemented:** `wellfound`, `otta` (both priority-70 `JOB_BOARD` slots in `source-priority.ts`). See §4.5 for the recommendation to retire `otta` and reject `wellfound`.

### 2.2 Canonical data model (ADR-030)

One `Vacancy` aggregate owns many `VacancySource` rows (`providerType: ATS | JOB_BOARD | COMMUNITY | MANUAL`, priority-ranked, weighted multi-field canonical matching at ≥0.75 similarity). `primaryApplyUrl` is computed from the highest-priority ACTIVE source with an `applyUrl` — this is the mechanism that makes "direct apply support" a first-class, already-modeled field, not something a new source has to invent.

`SOURCE_PRIORITY` (`apps/backend/src/config/source-priority.ts`) already encodes the hierarchy new sources should slot into: ATS (85–100) > Job Board (55–80) > Community (40–55) > Manual (10). Every new source recommended below gets an explicit suggested priority band in §4.

### 2.3 Shared ATS adapter layer (ADR-033)

`packages/ats-adapters` — one adapter per ATS platform (`AtsAdapter.fetchJobs/fetchJob/ping` → canonical `AtsRawJob`), consumed by:
- `packages/providers` (`Fetcher` wraps it, feeds the global Vacancy-Sync pipeline)
- `packages/company-watch` (`AtsAdapterRegistry` calls it directly, feeds the per-workspace notification pipeline)

Seven ATS types are migrated (Greenhouse, Lever, Ashby, Workday, Teamtailor, SmartRecruiters, Recruitee); Comeet is provider-only (no company-watch consumer exists for it). Two `AtsType` enum values (`PERSONIO`, `BAMBOOHR`) are declared but have **no adapter at all** — this is the exact gap ADR-033 already flagged for SmartRecruiters/Recruitee before they were closed. This research closes the Personio half of that gap (§4.1) and confirms BambooHR should stay unclosed (no stable public endpoint exists to build against).

### 2.4 CompanyWatch generic scraping (fallback adapters)

`CustomHtmlAdapter` and `JsonLdAdapter` (both in `packages/company-watch/src/adapters/`) are **already-built, general-purpose ingestion for any company career page**, keyed off schema.org `JobPosting` markup or configurable CSS selectors. This is the mechanism that makes "Priority 12/13: OSS companies, Engineering companies" mostly a **curation problem, not an integration problem** — the overwhelming majority of individually-named companies in this research (JetBrains, most CNCF members, most YC/VC-portfolio startups) either already run a supported ATS or already emit JobPosting JSON-LD. The value-add work is producing better *candidate lists* of companies to onboard, at scale — see §4.4.

### 2.5 SocialMessage / Telegram V2 (ADR-032)

A platform-agnostic pipeline (`SocialMessageTransport` → `SocialMessage` → `MessageExtractionEngine` → `MessageExtraction` → future `SocialMessageNormalizer` → `NormalizedVacancy`) is mid-migration for Telegram (Phase 3 of 7 complete as of 2026-07-29: transport layer + extraction engine built and wired; `SocialMessageNormalizer` + cutover still pending). The `TransportCapability` axis (`PULL | PUSH | API | BROWSER | FILE | STREAM`) was deliberately generalized so Discord/Slack/Reddit/X/VK can plug in without a pipeline change — **but no community source researched here clears the bar to justify building one now** (see §4.3). The architecture is ready; the sourcing isn't, yet.

### 2.6 Deduplication & quality scoring

`DeduplicationEngine` (exact key-field match + Levenshtein fuzzy match, 0.8 similarity threshold, 7-day window) and `ProviderManagementService.calculateProviderQuality()` (30% salary completeness + 30% company completeness + 25% location completeness + 15% valid-URL rate) are provider-agnostic — every new source recommended below plugs into both without modification. This matters directly for §4.4 (dedup risk) and the EPIC's phasing (§ EPIC.md) since new sources should be expected to *self-report* a quality score from day one, no new scoring logic required.

---

## 3. Research methodology

Four parallel research passes (one per thematic cluster, matching the user's priority list) verified sources via direct `WebFetch`/`WebSearch` — API docs, `robots.txt`, live endpoint calls — rather than trusting secondary summaries. Anything not independently confirmed is marked **unverified** in the raw files, matching the honesty standard already established in this repo's `docs/reports/telegram-channel-research.md`. Raw, unabridged findings (every source evaluated, including rejects, with full evidence) are in:

- `raw/ru-cis.md` — Priority 1–2 (Russian-speaking companies, CIS product companies)
- `raw/europe-remote.md` — Priority 3–4 (European companies, remote-first companies)
- `raw/ai-startup-vc.md` — Priority 5–11 (AI, SaaS, startups, scale-ups, product companies, VC portfolios, accelerator portfolios)
- `raw/oss-community.md` — Priority 12–13 (OSS companies, engineering companies) + community sources (GitHub, CNCF, Linux Foundation, Discord, Reddit, IndieHackers) + Workable ATS verification

This document (`REPORT.md`) is the synthesis; `EPIC.md` is the resulting implementation plan.

---

## 4. Cross-cutting findings

### 4.1 Two verified new ATS adapters — the highest-leverage finds in this research

Both follow **exactly** the adapter pattern `packages/ats-adapters` already establishes (public, unauthenticated, per-company endpoint + a discovery problem, not an auth problem):

**Personio** — `GET https://{company}.jobs.personio.de/xml?language=en`. Officially documented, first-party, unauthenticated XML feed (Personio's own support docs, verified against their OpenAPI spec). No rate limit documented. Unlocks the DACH (Germany/Austria/Switzerland) SME/scale-up segment, which CareerOS's current mostly-US-headquartered ATS roster under-covers. **Tier A.**

**Workable** — `GET https://apply.workable.com/api/v1/widget/accounts/{slug}?details=true`. Live-verified (tested against a real account, returned 8 real jobs with apply URLs). Unauthenticated, robots.txt-permissive, and `jobs.workable.com/sitemap.xml` gives a scalable slug-discovery path. No salary field. **Tier A.**

**BambooHR**, checked as the natural third candidate (declared in `AtsType` alongside Personio), has **no stable public endpoint** — only an undocumented internal widget call that changes between releases. **Do not build.** Individual BambooHR-hosted career pages are already reachable via the generic `JsonLdAdapter` where they emit JobPosting markup.

### 4.2 RU-specific ATS platforms don't generalize like Greenhouse — the hypothesis that didn't hold

The task brief's own framing hypothesized that a RU-market ATS (Huntflow, Talantix, Potok.io) might unlock many RU companies the way Greenhouse unlocks many US/EU ones. **Verified false for all three.** Huntflow, Talantix, and Potok.io all expose per-tenant, Bearer-token-authenticated APIs designed for *that company's own* recruiting-CRM integration — there is no public, cross-company, unauthenticated board endpoint the way Greenhouse's `boards-api.greenhouse.io/v1/boards/{token}/jobs` works. Building against any of them would mean one bespoke integration per employer, not one adapter unlocking many — a fundamentally worse economics than the Greenhouse/Personio/Workable pattern. **Do not build dedicated adapters for any of the three.** Where a specific high-value RU employer runs on one of these platforms, evaluate their public career page individually via the existing `CustomHtmlAdapter`/`JsonLdAdapter` (a CompanyWatch case, not a shared-adapter case).

### 4.3 No community platform beyond Telegram clears the bar this round

Both Discord and Reddit were evaluated seriously against the `TransportCapability` model ADR-032 already built for exactly this purpose:

- **Discord**: the public Server Widget API exposes only member/channel counts, never message content. Reading actual job postings requires a bot invited per-server with admin consent — an operational/BD problem, not a scalable engineering one. Discord's ToS also actively prohibits scraping (enforced — 2024 bans cited).
- **Reddit**: technically has a free OAuth tier (100 req/min), but Reddit's **November 2025 "Responsible Builder Policy"** now requires pre-approval for *all* API use including non-commercial, and redistribution/commercial use requires a negotiated contract — not self-serve. `robots.txt` was also broadened in 2024 to block scrapers generally. Combined with inherently unstructured content (free-text posts, high false-positive rate), this is a clear reject.

**Recommendation: build no new `SocialMessageTransport` this round.** The infrastructure is ready and cheap to extend later; revisit only if Reddit's policy changes or a specific tech Discord community opts into a partnership.

### 4.4 CompanyWatch discovery is the real lever for "OSS companies" / "Engineering companies" / VC-portfolio categories

Across three of the four research passes, the same structural pattern kept recurring: **the company already has a usable career page (known ATS or JobPosting JSON-LD); the missing piece is knowing the company exists and has that URL.** Four discovery mechanisms were found, none of which are new "Providers" in the usual sense — they're curation/discovery tooling that feeds the existing `JsonLdAdapter`/CompanyWatch onboarding flow:

1. **Web Data Commons / Common Crawl JobPosting extraction** (`webdatacommons.org/structureddata/schemaorg/`) — a real, freely-downloadable, annually-updated dataset of every domain Common Crawl found emitting `JobPosting` JSON-LD (grew from ~7K to ~50K sites over five years, per cited analysis). Not a live feed — a periodic (e.g. quarterly) batch job to extract new candidate domains. **This is the one genuinely new piece of infrastructure this research recommends building** (§ EPIC.md Phase 3).
2. **YC's company API** (`api.ycombinator.com/v0.1/companies`) — free, live, unauthenticated, 245 pages of company metadata including a hiring-status flag. Useless as a *vacancy* source (see §4.5) but excellent as a CompanyWatch seed list.
3. **CNCF `landscape.yml`** (`github.com/cncf/landscape`) — 700+ member companies. **Licensing caveat**: the enriched dataset blends Crunchbase data restricted to Linux-Foundation-landscape use only — safe to use as a plain company-*name* list for manual/semi-automated CompanyWatch onboarding, not to redistribute the dataset itself.
4. **Getro/Consider-powered VC portfolio boards** (Sequoia, Index Ventures, and most others — confirmed most VC "portfolio jobs" pages run on one of these two SaaS platforms) — mostly **re-surface postings that already live on Ashby/Greenhouse/Lever**, so building direct adapters against Getro/Consider has low incremental yield. Their value is as a **company/URL discovery layer** (find which portfolio companies exist and their career-page domains), same shape as YC's API.

### 4.5 Three sources rejected specifically on the direct-apply requirement

This is worth calling out as its own finding because it directly parallels the reasoning in ADR-034 (RemoteOK removal) and should inform any future source evaluation, not just this round's:

- **Y Combinator "Work at a Startup"** — confirmed via YC's own FAQ and a corroborating HN thread: candidates build one profile, YC makes it visible to startups, and *if a company is interested, they contact you*. This is an introduction/inbound model, not per-job application to an employer. **Reject as a vacancy source** (its company-metadata API is still useful as a discovery feed, per §4.4).
- **Otta** — no longer exists as an independent product; `otta.com` now 301-redirects into Welcome to the Jungle after a merger, and even pre-merger Otta's UX was "curated matches → apply via Otta profile → introduction," not raw direct-apply. **Recommend retiring the reserved `otta` enum slot** in `source-priority.ts` rather than ever implementing it — the entity it was reserved for has materially changed.
- **Wellfound** (formerly AngelList Talent) — no official API, robots.txt suggests ToS-restricted scraping, and apply flow is inconsistent (sometimes in-platform message, sometimes a real ATS link). **Reject.** CareerOS already carries LinkedIn's unofficial-scrape risk for materially overlapping company supply; a second high-risk unofficial scraper isn't justified for the incremental yield.

### 4.6 a16z Speedrun Talent Network — the single strongest individual find, with one open question

`speedrun-talent-network.com/api/v1` is a real, versioned, documented, free, unauthenticated JSON API — 15,909 live jobs at time of check, with salary fields, officially run by a16z. This is larger than most individual ATS pools CareerOS already has. **The one gating question**: the `url` field points back to a16z's own domain (`speedrun-talent-network.com/jobs/[slug]`), not directly to the employer's ATS — whether that page then forwards to a genuine employer apply flow (acceptable) or an a16z-mediated contact gate (same problem as Work at a Startup, reject) was not confirmed by static fetch. **Action before scoping any implementation work: a single manual browser check of one job's actual "Apply" click-through.** If it resolves to the employer's own application page, this becomes an immediate Tier-A build; if not, downgrade to reject alongside Work at a Startup.

### 4.7 Free config-only wins already sitting in the codebase

- **Widen `HH_AREAS`** to add Georgia (28), Armenia (13), Tajikistan (86), Moldova (62) — verified against `api.hh.ru/areas/countries`. Zero new code against an already-live, already-highest-priority source. (Do not add Ukraine's area ID 5 without first confirming live data — HH's Ukraine operation was sold/rebranded years before 2022 and access patterns since are unverified.)
- **JetBrains** confirmed live on Greenhouse (`job-boards.eu.greenhouse.io/jetbrains`) — an already-supported ATS. Just needs a board-token config entry, not new code.

---

## 5. Master tier table

Every source evaluated across all four research passes, condensed. Full evidence (robots.txt text, exact endpoints, rate limits, ToS citations) is in the `raw/` files under the source's name.

### Tier A — build now (free, stable/structured access, low legal risk, meaningful unique volume, low-medium effort)

| Source | Category | Integration shape | Effort | Notes |
|---|---|---|---|---|
| Personio | EU (DACH) | New ATS adapter (`packages/ats-adapters`) | S (2-3d) | Public unauthenticated XML feed |
| Workable | Global/OSS | New ATS adapter (`packages/ats-adapters`) | S (2-3d) | Live-verified JSON widget + sitemap discovery |
| Widen `HH_AREAS` | RU/CIS | Config change | Hours | Georgia/Armenia/Tajikistan/Moldova, pending live smoke-test |
| dou.ua | RU/CIS (Ukraine) | Generic `Provider` (RSS) | S (2-4d) | Dev-specific, clean robots.txt |
| France Travail Offres d'emploi | Europe | Generic `Provider` (REST) + ROME-code filter | M | Official French gov API, 10 req/s |
| PyJobs.com | OSS/niche | Generic `Provider` (RSS) | S (1-2d) | Python-specific, live/active |
| Django Jobs board | OSS/niche | Generic `Provider` (RSS) | S (1-2d) | Django-specific, live/active |
| a16z Speedrun Talent Network | AI/startup/VC | Generic `Provider` (REST) | S (1-2d) | **Gated on apply-flow verification (§4.6)** — 15.9K jobs, salary data |
| YC companies API | AI/startup discovery | CompanyWatch seed feed (not a vacancy Provider) | S | Discovery only — see §4.5 for why not a vacancy source |
| Web Data Commons / Common Crawl JobPosting | Discovery infra | New periodic batch tool feeding `JsonLdAdapter` | M (3-5d) | The one genuinely new piece of infrastructure recommended |
| JetBrains (Greenhouse) | RU/OSS | Config addition to existing ATS adapter | Hours | Zero new code |

### Tier B — worth doing, higher friction/risk/effort (unofficial API, scrape-with-ToS-ambiguity, manual curation, or moderate uncertain yield)

| Source | Category | Integration shape | Notes |
|---|---|---|---|
| Djinni.co | RU/CIS | Generic `Provider` (scrape) | Largest new UA/CIS volume; apply-flow (inbox model) needs product sign-off |
| work.ua | RU/CIS (Ukraine) | Generic `Provider` (scrape) | Explicitly allows `ClaudeBot` w/ crawl-delay |
| NoFluffJobs | Europe (CEE) | Generic `Provider` (unofficial) | Same risk class already accepted for LinkedIn |
| JustJoin.it | Europe (CEE) | Sitemap crawl + `JsonLdAdapter`, **not** the robots-disallowed `/api/` | Must avoid the disallowed API path |
| Bundesagentur für Arbeit Jobsuche | Europe (Germany) | Generic `Provider` (de-facto-open key) | Validate incremental yield over already-live Arbeitnow first |
| ai-jobs.net / Foorilla | AI/startup | Generic `Provider` (RSS/REST) | Historically Tier A; documented URLs now 404, needs live browser re-check |
| Getro/Consider VC boards | VC portfolio | CompanyWatch discovery layer only | Mostly re-surface existing Ashby/Greenhouse/Lever postings |
| CNCF `landscape.yml` | OSS | CompanyWatch curation batch (names only) | Crunchbase-blended fields not redistributable |
| GitHub "awesome career-pages" lists | OSS | CompanyWatch curation batch | Manual/curated seed list |
| Dev.to/Forem Listings API | OSS/niche | Generic `Provider` (REST) | Documented, free, but modest SWE-specific volume |
| BuiltIn | AI/SaaS/startup | Generic `Provider` (scrape) | Real volume, ToS explicitly disclaims open-data licensing |
| Habr Freelance / FL.ru / Kwork | RU/CIS | Generic `Provider` (scrape) | **Gated on a product decision**: freelance vs. FTE scope (ADR-030 currently canonicalizes FTE) |
| CV-Online Baltics | Europe (diaspora) | Generic `Provider`, partner-gated | Requires an Alma Career partner conversation — BD track, not pure engineering |
| Poslovi Infostud (Serbia) | Europe (diaspora) | Generic `Provider` (RSS) | Lowest-effort of the diaspora tier |
| HR.ge, AllJobs/JobMaster (Israel) | RU/CIS (diaspora) | Generic `Provider` (scrape) | Real Russian-speaking-diaspora audience |
| Trudvsem.ru | RU/CIS (gov) | Generic `Provider` (official XML) | Official but skews non-tech, lower quality |
| Jobspresso | Remote-first | Generic `Provider` (RSS) | Standard WP job-listing RSS, no salary/tech structure |
| Golang Cafe | OSS/niche | Unverified — rate-limited during research | Needs a follow-up check |

### Tier C — reject or defer (ToS-prohibited/fragile, low volume, heavy duplicate overlap, high maintenance, or wrong product model)

| Source | Reason |
|---|---|
| RemoteOK | **Already removed (ADR-034) — never revisit.** |
| Landing.jobs | **Reverted from Tier A after implementation-time verification** (2026-07-30): live `/jobs` API has no company field at all (docs describe `company_id`, not present in practice), and job pages embed `waiting_counter`/`inbox_counter`/`review_counter` plus cancel reasons ("I was never contacted", "Got tired of waiting for a final decision") indicating an inbox/handshake apply model — same problem class as RemoteOK/Work at a Startup. |
| Wellfound | No API, ToS-risky scraping, inconsistent direct-apply |
| Otta | Merged into Welcome to the Jungle, no API, was platform-mediated apply — **retire the reserved enum slot** |
| Y Combinator "Work at a Startup" | Confirmed not direct-apply (introduction-only model) — company API still useful for discovery |
| robota.ua | Direct 403 on a `robots.txt` fetch — real anti-bot posture, same risk class as Avito |
| GeekJob.ru | Low volume, its one structured path (`/json/`) is explicitly robots-disallowed |
| Huntflow / Talantix / Potok.io (as adapters) | All three are per-tenant authenticated CRM APIs, not public discoverable board APIs |
| Relocate.me | Relocation-broker apply flow, not clean direct-apply |
| Welcome to the Jungle, Honeypot, talent.io | Marketplace/inverted models or scrape-only with no confirmed ToS clearance |
| EURES | Only an unofficial/unstable reverse-engineered API exists — prefer national gov APIs (France Travail, Bundesagentur) directly |
| Xing | Status genuinely unclear post-2019 rebrand — needs a fresh direct check, not a verdict either way |
| BambooHR | No stable public jobs endpoint |
| Reddit | Nov-2025 pre-approval policy + commercial-contract requirement for redistribution + hostile robots.txt |
| Discord | Widget API exposes no message content; per-server bot access is a BD problem, not scalable engineering |
| Open Collective | Not a jobs source at all |
| IndieHackers Jobs, Product Hunt Jobs, Console.dev, Changelog.com | No API / product doesn't exist / confirmed dead |
| VentureLoop, RemoteRocketship, SaaStr Jobs, startup.jobs | Paid-first, secondary-aggregator, or no confirmed structured access |
| Stack Overflow Jobs | Confirmed shut down March 2022 |
| Most "remote-first aggregator" boards (remote.co, JustRemote, Pangian, SkipTheDrive, VirtualVocations, RemoteLeaf, Dynamite Jobs) | No free API/RSS evidence found, or explicitly paid-first |
| Linux Foundation members (as distinct from CNCF) | Redundant with CNCF list, no structured feed |
| vc.ru | Content/curation platform, not a job board |
| Careerist.ru, Tproger | Real boards but no verified API/robots-friendliness this pass — worth a cheap follow-up, not a build commitment |
| Zarplata.ru, Job.ru | Unverified/stale evidence (referenced 2017-era API) |

---

## 6. The 10 strategic questions

**1. Recommended implementation order** — see `EPIC.md` §Phases. Summary: config-only wins first (hours), then the two verified new ATS adapters (highest leverage), then Tier-A RSS/REST Providers, then the discovery-infrastructure build, then Tier-B sources gated on individual risk/product sign-offs.

**2. Which providers should become ATS adapters** — Personio and Workable (§4.1), both via `packages/ats-adapters` following the exact ADR-033 migration pattern. No RU-specific platform qualifies (§4.2). BambooHR does not qualify (no stable endpoint).

**3. Which providers should become SocialMessage providers** — None, this round (§4.3). Telegram remains the sole `SocialMessageTransport` implementation. Discord and Reddit were both evaluated and rejected on technical/legal grounds, not lack of interest — revisit only if Reddit's policy changes or a specific community opts into a direct partnership.

**4. Which providers should become CompanyWatch providers** — Individually-curated companies without a shared platform API: large RU employers running custom in-house platforms (Yandex, Sber, Ozon, Kaspersky — each needs its own `CustomHtmlAdapter` mapping, confirmed no clean ATS/JSON-LD signal in a spot-check), plus the curated batches from CNCF `landscape.yml` and GitHub "awesome career-pages" lists, plus VC/accelerator portfolio companies discovered via Getro/Consider boards or the YC companies API.

**5. Which providers should become generic Provider implementations** — dou.ua, Landing.jobs, France Travail, PyJobs.com, Django Jobs board, a16z Speedrun Talent Network (Tier A); Djinni.co, work.ua, NoFluffJobs, JustJoin.it (sitemap route), Bundesagentur für Arbeit, ai-jobs.net/Foorilla (pending re-verification), Dev.to/Forem, BuiltIn (Tier B, each individually risk/effort-gated per §5 table).

**6. Which sources can reuse existing infrastructure** — All RSS sources (dou.ua, PyJobs, Django Jobs, Poslovi Infostud, Jobspresso) reuse the same RSS-ingestion pattern already established by We Work Remotely. JetBrains and any other Greenhouse/Lever/Personio/Workable-hosted company reuses the shared ATS-adapter layer with zero new adapter code (just config). Any company already emitting JobPosting JSON-LD reuses `JsonLdAdapter` as-is. `HH_AREAS` widening reuses the `hh` provider entirely.

**7. Which sources require new infrastructure** — Only two things in this entire research pass are genuinely new plumbing, not new instances of existing patterns: (a) the Web Data Commons/Common Crawl bulk-discovery batch job (§4.4), and (b) an occupation/ROME-code filtering layer needed to make France Travail (and similarly-shaped general-labor-market government APIs) usable for software-engineering-specific filtering rather than firehosing all professions.

**8. Which providers are likely to produce the highest number of unique vacancies after deduplication** — By raw volume: a16z Speedrun (~15.9K jobs, though meaningful overlap with existing Ashby/Greenhouse-posted startups needs post-launch dedup measurement), France Travail (large government dataset once ROME-filtered), Djinni.co and dou.ua (large UA/CIS dev-specific pools with low overlap against RU-core HH/SuperJob/Habr Career), NoFluffJobs/JustJoin.it (CEE volume, moderate overlap with each other but low overlap with existing sources).

**9. Which providers are most valuable specifically for Russian-speaking developers** — In order: widen `HH_AREAS` (immediate, zero-cost reach into Georgia/Armenia/Tajikistan/Moldova), dou.ua (Ukraine dev-specific, RSS, Tier A), Djinni.co (largest new UA/CIS volume), work.ua, JetBrains-via-Greenhouse, and the Tier-B diaspora cluster (CV-Online Baltics, Poslovi Infostud, HR.ge, AllJobs/JobMaster Israel) for Russian-speaking communities outside CIS territory proper.

**10. Which providers are best for AI/LLM/startup jobs** — a16z Speedrun Talent Network is the standout (pending the apply-flow check in §4.6). YC's companies API and the Getro/Consider VC-board family are valuable as *discovery* feeds for CompanyWatch rather than direct vacancy sources. ai-jobs.net/Foorilla would be a strong Tier-A AI-specific pick if its historically-documented free API is confirmed still live under its 2026 rebrand (currently unverified — needs a browser-based follow-up, not a curl check).

---

## 7. Open questions requiring product/legal sign-off before Tier-B implementation

1. **Djinni.co / Relocate.me apply-flow model** — both route through an in-platform inbox/introduction rather than a clean external apply link. Product needs to decide whether this meets the "direct apply" bar or falls into the same category as Work at a Startup/Otta.
2. **Freelance vs. FTE scope** — Habr Freelance, FL.ru, and Kwork are all easy scrape targets with real RU volume, but represent gig/freelance postings, a different vacancy *type* than the FTE model ADR-030 currently canonicalizes around. This is a product decision, not an engineering one.
3. **Scrape-based ToS risk tolerance beyond LinkedIn** — NoFluffJobs, work.ua, Djinni.co, BuiltIn, and Bundesagentur für Arbeit all lack an official API and would extend the unofficial-scraping risk class CareerOS already accepts for LinkedIn to several more sources. Worth an explicit, single risk-tolerance conversation rather than re-litigating it per source.
4. **a16z Speedrun apply-flow verification** — a 10-minute manual browser check gates whether this becomes an immediate Tier-A build or a reject (§4.6).

---

*Full source-by-source evidence — every robots.txt fetched, every endpoint tested, every rejected source's reasoning — is preserved in `research/free-provider-expansion/raw/`.*
