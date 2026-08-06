# EPIC: Free Provider Expansion

**Status:** Proposed — research complete, no implementation started.
**Depends on:** `REPORT.md` (architecture review + source tiering) in this same directory.
**Goal:** Make CareerOS one of the largest aggregators of free, direct-apply software-engineering vacancies, prioritizing quality, freshness, legality, and direct application links — by extending the existing Provider / ATS-Adapter / CompanyWatch architecture, not building parallel pipelines.

**Non-goals:** No new pipeline architecture (Provider, ATS-Adapter, CompanyWatch, and SocialMessage layers already cover every shape of source found). No freelance/gig-marketplace support until a separate product decision is made (§ REPORT.md §7.2). No RemoteOK-style apply-gated sources, ever (ADR-034 precedent).

Every phase below is independently shippable and revertable, following the same discipline ADR-033's ATS migration used: build against fixtures, prove parity/behavior before wiring into production sync, canary one source at a time before moving to the next.

---

## Phase 0 — Zero-code / config-only wins

**Goal:** Capture the cheapest wins in the entire research pass before any engineering work starts. No new adapters, no new packages.

1. **Widen `HH_AREAS`** to add Georgia (28), Armenia (13), Tajikistan (86), Moldova (62) — after a live smoke-test against `api.hh.ru` confirms these area IDs return real results. Do not add Ukraine (area 5) without separately confirming live data first (see REPORT.md §4.7).
2. **Add JetBrains as a Greenhouse board-token config entry** (already-confirmed live on `job-boards.eu.greenhouse.io/jetbrains`) — and spot-check a handful of other named CIS/OSS companies from this research for the same "already on a supported ATS, just needs a config row" pattern before building anything new.
3. **Retire the `otta` slot** in `source-priority.ts` / the `VacancySource` enum — Otta no longer exists as an independent product (merged into Welcome to the Jungle) and was never direct-apply even pre-merger. Product sign-off needed on whether to delete the slot outright or leave it reserved-but-dormant; either way, do not build against it.
4. **Verify a16z Speedrun's apply-flow** — one manual browser check of a live job's "Apply" click-through, to gate whether Phase 2's Speedrun work proceeds as scoped or gets dropped (REPORT.md §4.6). **Done (2026-07-30): passed.** The per-job detail endpoint exposes `apply: {kind: "external", url: "https://jobs.ashbyhq.com/.../application"}` — confirmed real ATS direct-apply, not an inbox/handshake model. Also found the API silently ignores the documented `function` filter param; the working one is `fn` (confirmed via its own facet keys) — without it, ~62% of results are non-engineering roles.

**Effort:** Hours, not days. **Ships same week** the EPIC is approved.

---

## Phase 1 — New ATS adapters (extends `packages/ats-adapters`)

**Goal:** Unlock two entire employer segments CareerOS's current ATS roster under-covers, using the exact adapter pattern ADR-033 already established (build adapter + parity tests → wire into CompanyWatch registry → wire into Provider fetcher wrapper → canary).

1. **Personio adapter** — `{company}.jobs.personio.de/xml` per-tenant XML feed. Unlocks the DACH SME/scale-up segment.
   - Sub-steps mirror ADR-033's migration shape: build `transport/personio-transport.ts` + `parsers/personio-parser.ts` + `adapters/personio-adapter.ts` in `packages/ats-adapters`, add `PERSONIO` to `AtsAdapterRegistry` (closing the gap ADR-033's Context section already flagged), then a thin `PersonioFetcher` in `packages/providers` following the Greenhouse/Lever precedent.
   - **Tenant discovery is the real work**, not the adapter — reuse whatever company-list mechanism Phase 3's discovery infra produces, or seed manually from known DACH companies in this research.
2. **Workable adapter** — `apply.workable.com/api/v1/widget/accounts/{slug}` per-tenant JSON + `jobs.workable.com/sitemap.xml` for slug discovery. Unlocks the SMB/mid-market segment.
   - Same adapter shape as Personio. Sitemap-based discovery is a genuine scalability advantage over Personio (no external company list needed to bootstrap).

**Effort:** ~1 week combined (S+S adapter builds, following an already-proven pattern from 8 prior ATS migrations this codebase has already done). **Legal note:** a human skim of Workable's full ToS (beyond robots.txt, which is permissive) recommended before shipping, per REPORT.md §4.1.

---

## Phase 2 — Tier-A generic Provider integrations (RSS/REST, existing `Fetcher/Mapper/Normalizer/SyncStrategy` pattern)

**Goal:** Ship the highest-confidence, lowest-effort net-new sources, each following the exact pattern Remotive/Arbeitnow/We Work Remotely already use.

Recommended build order (cheapest/cleanest first):
1. **dou.ua** (RSS, Ukraine dev-specific) — S effort, cleanest robots.txt of the Ukrainian sources. **Shipped** (`dou` provider, `packages/providers/src/providers/dou/`) — per-category RSS fetch (feed only accepts one `category` param per request) across the software-engineering category set, title-parsed for company/location/salary/remote.
2. ~~**Landing.jobs** (REST, Portugal/EU)~~ — **Rejected at implementation-time verification**, the gate this EPIC itself required (REPORT.md §7). The live `/jobs` API has no company field at all (docs describe `company_id`; not present in practice — would require scraping each job's own page for `company_name`, defeating the "clean REST API" premise), and individual job pages embed `waiting_counter`/`inbox_counter`/`review_counter` fields plus cancel reasons like "I was never contacted" and "Got tired of waiting for a final decision" — an inbox/handshake apply model, the same class of problem that got RemoteOK removed (ADR-034) and Work at a Startup/Djinni flagged elsewhere in this research. Do not build.
3. **PyJobs.com** and **Django Jobs board** (RSS, niche) — S effort each, can ship together given near-identical shape. **Shipped** (`pyjobs` and `django_jobs` providers). Django Jobs merges both feeds `djangoproject.com/community/jobs/` itself aggregates (builtwithdjango.com RSS + djangojobboard.com Atom); the Atom side has no separable company field so it's left `Unknown` rather than guessed.
4. **a16z Speedrun Talent Network** (REST) — **only if Phase 0's apply-flow check passes.** S effort, ~15.9K jobs, salary data. **Shipped** (`speedrun` provider) after the Phase 0 gate passed. Paginates the list endpoint with `fn=engineering` (not `function` — see Phase 0 note); does not call the per-job detail endpoint (would be ~6,000 extra requests/sync), so it uses the list endpoint's own job-page `url` like WWR/Arbeitnow/DOU do, and composes description text from structured fields rather than fetching prose.
5. **France Travail Offres d'emploi** (REST + new ROME-code filter layer) — M effort, the filter layer is the one piece of genuinely new logic in this phase (needed so a general labor-market API doesn't firehose non-tech postings into CareerOS). **Shipped** (`france_travail` provider, conditionally registered — needs a free `FRANCE_TRAVAIL_CLIENT_ID`/`SECRET` from francetravail.io, defaults the ROME filter to M1805). **Caveat: unverified against a live response** — the francetravail.io docs are a client-rendered SPA this codebase's tooling can't execute, and no one has registered credentials yet, so the response field mapping is built on the API's long-stable public shape rather than a live-fetched sample (unlike every other provider in this phase, all of which were live-verified end to end). Both the OAuth2 token endpoint and the search endpoint were confirmed live/reachable during implementation. **Action: validate against a real response as soon as credentials are provisioned** (see `packages/providers/src/providers/francetravail/francetravail-types.ts`).

**Effort:** ~2-3 weeks combined, sequenced so each source ships and is observed (quality score, dedup rate) before the next starts — same discipline as ADR-033's "one ATS at a time" canary approach.

---

## Phase 3 — CompanyWatch discovery infrastructure (the one genuinely new piece of plumbing)

**Goal:** Stop discovering companies to onboard into `CustomHtmlAdapter`/`JsonLdAdapter` one at a time — build the tooling to do it at scale.

1. **Web Data Commons / Common Crawl JobPosting bulk-discovery batch job** — a periodic (proposed: quarterly) offline pipeline: download the latest Web Data Commons schema.org JobPosting extract, parse the (large) N-Quads files, extract distinct domains, dedupe against CareerOS's existing company list, rank by posting frequency/site authority, and produce a ranked CompanyWatch onboarding candidate list. This is infrastructure/tooling, not a live `Provider` — it never talks to `ProviderRegistry`.
2. **YC companies API ingestion** (`api.ycombinator.com/v0.1/companies`) — a lightweight script pulling company name/website/hiring-status, feeding the same CompanyWatch candidate pipeline as #1.
3. **CNCF `landscape.yml` and GitHub "awesome career-pages" curation** — one-time (or infrequent) scripted extraction of company *names* (not the full Crunchbase-blended dataset, per the licensing caveat in REPORT.md §4.4) feeding the same candidate pipeline.
4. **Getro/Consider VC-board discovery** — where feasible without a headless browser (several are JS-rendered SPAs; may need to defer the JS-heavy boards to a later pass), extract portfolio company names/domains into the same candidate pipeline.

All four feed **one shared output**: a ranked list of candidate companies + career-page URLs for a human (or semi-automated QA pass) to run through the *existing, unmodified* `CustomHtmlAdapter`/`JsonLdAdapter` onboarding flow. No new adapter code ships in this phase — it's entirely about improving what feeds the adapters that already exist.

**Effort:** ~1-1.5 weeks for the Common Crawl pipeline (the only M-effort item; it involves large-file parsing), days each for the three lighter-weight scripts.

---

## Phase 4 — Tier-B unofficial/scrape-based Providers (risk-gated, sequence by product sign-off)

**Goal:** Ship the higher-friction-but-real-value sources, each individually gated on the open questions in REPORT.md §7 rather than blocking on all of them at once.

Sequence by whichever risk/product sign-off lands first — no hard dependency order between these:
- **Djinni.co** — pending product sign-off on its inbox-style apply flow.
- **work.ua** — bot-friendly robots.txt (explicit `ClaudeBot` allow), general Ukraine-market volume.
- **NoFluffJobs** and **JustJoin.it** (sitemap route only — never the robots-disallowed `/api/`) — CEE volume, LinkedIn-class risk tolerance needed.
- **Bundesagentur für Arbeit Jobsuche** — build only after confirming incremental yield over the already-live Arbeitnow provider (real risk of high duplicate overlap, per REPORT.md's Tier-B table).
- **ai-jobs.net / Foorilla** — gated on a live browser re-check of whether the historically-documented free API/RSS still exists under the 2026 rebrand; if confirmed, this jumps to Phase 2-equivalent priority.
- **BuiltIn** — gated on the same scrape-risk-tolerance conversation as Djinni/NoFluffJobs, given its ToS explicitly disclaims open-data licensing.

**Effort:** Variable per source (M-L each, scrape-based), sequence opportunistically rather than as a strict queue.

---

## Phase 5 — Diaspora & niche RSS extension

**Goal:** Lower-urgency, lower-effort sources that round out coverage after the core buildout, mirroring the diaspora-extension framing already established in `research/job-sources-russian-sw/CIS-ROADMAP.md` §3 Phase 3.

- **Poslovi Infostud** (Serbia, RSS) — lowest-effort diaspora source.
- **CV-Online Baltics** — a parallel business-development track (Alma Career partner conversation), not a pure-engineering task; can run alongside any other phase.
- **HR.ge**, **AllJobs/JobMaster** (Israel) — moderate scrape effort, real Russian-speaking-diaspora audience.
- **Trudvsem.ru** — official RU government API, lower priority given it skews non-tech.
- **Dev.to/Forem Listings API** — real documented API, but expect modest SWE-specific signal.

**Effort:** Days each, no strict sequencing required, good "gap week" work between the heavier phases above.

---

## Explicitly out of scope for this EPIC

Per REPORT.md's Tier-C table: RemoteOK (never — ADR-034), Wellfound, Otta (as an implementation — retired in Phase 0), Y Combinator Work at a Startup (as a vacancy source), robota.ua, GeekJob.ru, Huntflow/Talantix/Potok.io (as dedicated adapters), Relocate.me, Welcome to the Jungle/Honeypot/talent.io, EURES, Xing (pending a fresh status check outside this EPIC), BambooHR, Reddit, Discord (general), Open Collective, IndieHackers Jobs, Product Hunt Jobs, Console.dev, Changelog.com, VentureLoop, RemoteRocketship, SaaStr Jobs, startup.jobs, Stack Overflow Jobs, most remote-first aggregator boards (remote.co, JustRemote, Pangian, SkipTheDrive, VirtualVocations, RemoteLeaf, Dynamite Jobs), Linux Foundation members (as distinct from CNCF), vc.ru, Careerist.ru/Tproger (pending a cheap follow-up outside this EPIC), Zarplata.ru/Job.ru, and all freelance/gig marketplaces (FL.ru, Kwork, Habr Freelance) pending the product decision in REPORT.md §7.2.

---

## Sequencing summary

```
Phase 0 (hours)     → config wins, retire `otta`, verify a16z apply-flow
Phase 1 (~1 week)   → Personio + Workable ATS adapters
Phase 2 (~2-3 weeks)→ dou.ua, ~~Landing.jobs (rejected)~~, PyJobs, Django Jobs, a16z Speedrun (shipped), France Travail (shipped, unverified-live — see caveat)
Phase 3 (~1-2 weeks)→ Common Crawl discovery pipeline, YC/CNCF/GitHub/Getro curation feeds
Phase 4 (variable)  → Djinni, work.ua, NoFluffJobs, JustJoin.it, Bundesagentur, ai-jobs.net, BuiltIn
Phase 5 (variable)  → Poslovi Infostud, CV-Online Baltics, HR.ge, AllJobs/JobMaster, Trudvsem.ru, Dev.to
```

Phases 1-3 are the recommended near-term commitment (roughly 4-6 engineering weeks total, mostly S/M-effort items following patterns this codebase has already proven 8+ times over via the ATS migrations). Phases 4-5 should be re-prioritized against whatever Phase 1-3 actually yield in production (quality scores, dedup rates, user engagement) rather than committed to wholesale up front.
