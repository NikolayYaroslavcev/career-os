# Free Vacancy Sources Research — Europe & Remote-First (Priority 3/4)

Research date: 2026-07-30. Scope: sources not already integrated into CareerOS (existing: HeadHunter, Adzuna, Greenhouse, Lever, Ashby, Workday, Teamtailor, SmartRecruiters, Recruitee, Comeet, Remotive, Himalayas, Arbeitnow, Jobicy, We Work Remotely, Working Nomads, NoDesk, HN Who Is Hiring, LinkedIn (scrape), SuperJob, Habr Career, Telegram). `wellfound`/`otta` are reserved enum slots covered by another workstream — noted only where relevant, not deep-dived.

Existing local context checked: `apps/backend/src/config/source-priority.ts`, `packages/ats-adapters/src/adapters/` (currently: greenhouse, lever, ashby, recruitee, smartrecruiters, teamtailor, workday — Personio/BambooHR confirmed **not yet present**, matching the task brief).

---

## Headline finding: Personio vs BambooHR public job-board APIs

**Personio — CONFIRMED public, unauthenticated XML job feed.** Verified via Personio's own developer docs (OpenAPI spec at `github.com/personio/api-docs`, fetched directly):
- Endpoint: `GET https://{company}.jobs.personio.de/xml?language=en` (language param: de/en/fr/es/nl/it/pt)
- No authentication, no API key, no rate limit documented for this endpoint (only the write-side `/v1/recruiting/applications` endpoints require a Bearer token + `X-Company-ID`).
- Returns structured XML: title, office, department, recruiting category, employment type, description blocks (multiple description sections, not just one blob).
- Officially documented and officially supported ("Integrate jobs from Personio into your website via XML" support article) — this is a first-party, sanctioned public feed, not a scrape.
- **Caveat**: it's per-company (`{company}.jobs.personio.de`), like Greenhouse's `boards-api.greenhouse.io/v1/boards/{company}/jobs` — there is no single Personio-wide "all customers" endpoint. You still need a company/tenant list to poll, same discovery problem CareerOS already solves for Greenhouse/Lever via CompanyWatch or a crawled company list.
- **This is a strong new-ATS-adapter candidate** — Personio is extremely common among German/Austrian/Swiss SMEs and scale-ups, an EU segment CareerOS's current ATS adapters (mostly US-headquartered ATS platforms) under-cover.

**BambooHR — NOT a public documented API for job postings.** BambooHR's official REST API is scoped to employee records/time-off/benefits with token auth; the applicant-tracking/careers module has no documented public REST endpoint. The only public surface is an embeddable JS careers widget that calls an internal JSON endpoint whose shape/host is undocumented and changes between releases (per third-party integration write-ups; unverified against BambooHR's own docs since they don't publish it). Building on this would mean reverse-engineering an unstable internal endpoint — explicitly against the spirit of "structured, stable feed" the brief asks for.
- **Recommendation: do not build a BambooHR ATS adapter now.** Revisit only if BambooHR ever documents a public jobs endpoint, or treat individual BambooHR-hosted career pages via the existing generic `CustomHtmlAdapter`/`JsonLdAdapter` (BambooHR career pages commonly emit schema.org JobPosting JSON-LD, already solved by CareerOS).

---

## Poland / CEE

### NoFluffJobs
- **Free/paid**: Free to read, no official public API.
- **API type**: No official developer API found (no docs on nofluffjobs.com). A GitHub community project (`oskar-j/nofluffapi`) exists but its README gives no endpoint/auth/ToS detail (verified by fetching the repo — it's thin). Multiple commercial Apify scrapers exist, implying no clean official JSON endpoint is documented, but the site is scraped at scale by third parties without apparent legal action reported.
- **robots.txt**: Could not fetch nofluffjobs.com/robots.txt directly (tool error). Unverified.
- **Legal/ToS**: Unverified — no ToS clause confirmed either way.
- **Direct apply**: NoFluffJobs listings typically link to company/ATS apply pages or NFJ's own apply flow (unverified which is more common).
- **Salary/remote/location/tech tags**: Strong — NoFluffJobs is known for mandatory salary disclosure, tech-stack tags, and covers Poland, Czechia, Slovakia, Hungary, Netherlands.
- **Duplicate risk**: Low-medium overlap with Arbeitnow/Adzuna-PL; NFJ skews more senior/IT-specific than Adzuna's general listings.
- **Complexity/effort**: M — would require building against an undocumented endpoint (higher maintenance risk) or a scraper, similar risk profile to LinkedIn's existing unofficial-scrape integration.
- **Tier: B.** High salary/tech-tag data quality and CEE volume make it attractive, but no official API means building against an unofficial/undocumented endpoint — same risk class CareerOS already accepts for LinkedIn, so precedent exists, but not a slam-dunk Tier A.
- **Integration shape**: generic `Provider` (unofficial adapter), mirroring the LinkedIn scrape pattern.

### JustJoin.it
- **Free/paid**: Free to read.
- **API type**: Public JSON endpoint `https://justjoin.it/api/offers` is widely referenced by scrapers and community tools as returning job listings in JSON. **Verification note**: my direct WebFetch to `https://justjoin.it/api/offers` returned HTTP 404 — this could mean the endpoint moved/changed shape, requires different headers, or the simple GET without query params doesn't resolve. Treat the exact current endpoint/shape as **unverified** pending a real HTTP client test (WebFetch's markdown-conversion pipeline may also not represent raw JSON responses well/at all).
- **robots.txt**: Verified via direct fetch. `/api/` is explicitly listed in `Disallow`, alongside `/devs`, `/admin/`, `/templates`, `/_includes`, `/_files`, `/terms-and-privacy-policies`, `/pdf/`. Sitemaps ARE offered and allowed: `active-jobs.xml`, `categories.xml`, `core-pages.xml`, `expired-jobs.xml`, `locations.xml`, `top-locations.xml`, `top-companies.xml`, `locations-categories.xml`, `top-companies.xml` at `https://justjoin.it/sitemaps/*`.
- **Legal/ToS**: The robots.txt explicitly disallowing `/api/` is a meaningful signal against polling the JSON API directly, even though it's technically reachable — this raises real ToS-risk versus a source that welcomes API consumption.
- **Direct apply**: JustJoin.it typically links through to company ATS/apply pages.
- **Salary/remote/location/tech tags**: Strong — well known for salary transparency and tech-stack tags, Poland-centric with growing remote-EU listings.
- **Duplicate risk**: Medium overlap with NoFluffJobs (same Polish IT job market) and Arbeitnow.
- **Complexity/effort**: M, and legally murkier than NoFluffJobs given the explicit robots.txt disallow on `/api/`. The sitemap-based route (`active-jobs.xml`) is the more defensible path — sitemaps are explicitly allowed and typically contain job URLs (would then need per-page JSON-LD/HTML parsing via the existing generic adapter, not a new provider).
- **Tier: B** (via sitemap+generic-adapter route) or **C** (if via the disallowed `/api/offers` route). Recommend sitemap route only.
- **Integration shape**: sitemap crawl + existing `JsonLdAdapter`/`CustomHtmlAdapter` per listing page, not a bespoke API provider — avoids the robots.txt conflict on `/api/`.

---

## Portugal / EU

### Landing.jobs
- **Free/paid**: Free, official, documented.
- **API type**: REST, officially documented at `github.com/LandingJobs/LandingJobs-api` (verified by fetching the repo directly). Base URL `https://landing.jobs/api/v1`.
- **Auth**: **Companies and Jobs list/detail endpoints require NO authentication.** Only `/user/*` endpoints need a token.
- **Endpoints**: `GET /jobs`, `GET /jobs/[id]`, `GET /companies`, `GET /companies/[id]`, `GET /companies/[id]/jobs.json`.
- **Fields**: title, company_id, city, country_code/name, salary_low, salary_high, currency_code, remote (boolean), relocation_paid, work_from_home, role_description, nice_to_have, perks, type (contract/part-time/freelance), tags (tech stack), published_at, expires_at.
- **Pagination**: `offset`/`limit`, max limit 50/page.
- **Rate limits**: Not documented (unverified in practice — no stated cap).
- **robots.txt**: Not fetched (API is officially sanctioned, so robots.txt is largely moot for the JSON API).
- **Direct apply**: Landing.jobs is itself a marketplace with in-platform apply, not always company-direct — check apply-URL field behavior at implementation time (unverified whether apply always routes back to CareerOS-crawlable company pages).
- **Salary/remote/location/tech tags**: Excellent — this is one of the richest field sets found in this research (explicit salary range + currency, explicit remote/relocation booleans, tags).
- **Update frequency**: Unverified, but active platform (Portugal's largest tech marketplace, EU-wide reach).
- **Duplicate risk**: Low — Portugal/EU tech-specific niche, limited overlap with Arbeitnow (more DACH-flavored) or Adzuna (general).
- **Complexity/effort**: S — clean documented REST API, no auth for the data CareerOS needs. Estimated 1-2 engineering days for a basic `Provider` integration.
- **Tier: A.** Officially documented, no-auth-required, rich structured fields, low legal risk, low implementation effort.
- **Integration shape**: generic `Provider`.

---

## France / EU

### Welcome to the Jungle (WTTJ)
- **Free/paid**: The company (Welcome to the Jungle **Solutions**) offers a documented "Jobs API" (`developers.welcomekit.co/jobs-api/jobs`), but this is aimed at **ATS/employer-side sync** (pushing your own jobs into WTTJ, or building an internal job board off WTTJ Solutions data you already own) — not a public "pull all WTTJ listings" endpoint.
- **API type for aggregation purposes**: None found that's official/public for reading third-party listings. Only unofficial scraper services (Apify, Mantiks, Parse.bot) exist for pulling the full public job catalog.
- **Legal/ToS**: Unverified whether ToS explicitly bars scraping; existence of many commercial scrapers doesn't confirm legality, just that enforcement (if any) hasn't stopped them.
- **Direct apply**: WTTJ listings generally link through to company ATS.
- **Salary/remote/location/tech tags**: Good — WTTJ has salary and remote filters, France-centric with UK/other EU expansion.
- **Duplicate risk**: Medium-high overlap with Arbeitnow (DACH) less so, but meaningful overlap with Adzuna-FR and with company ATS pages CareerOS can already reach directly (many WTTJ-listed companies use Greenhouse/Lever/etc. underneath, already covered).
- **Complexity/effort**: L if pursuing unofficial scraping (fragile, third-party-tools-only signal).
- **Tier: C.** No official read API, scraping-only route, no confirmed ToS clearance, and heavy overlap with sources CareerOS can already reach via direct ATS integration. Recommend skip/defer.

### Honeypot.io
- **Free/paid**: Free to browse.
- **API type**: None found — no developer/API documentation surfaced. Honeypot's core model ("companies apply to candidates", reverse job board) doesn't naturally expose a conventional "list of open jobs" feed the way a normal board does — the product itself is talent-profile-first, not listing-first.
- **Legal/ToS**: Unverified.
- **Direct apply**: N/A — Honeypot's model is inverted (employers reach out), doesn't map well to CareerOS's "aggregate + direct apply" model at all.
- **Tier: C.** Low structural fit for an aggregator regardless of API availability — the product isn't a conventional vacancy list. Recommend skip.

### France Travail (formerly Pôle emploi) — "Offres d'emploi" API
- **Free/paid**: Free, official French government API via the francetravail.io "Emploi Store Développeurs" portal.
- **API type**: REST, officially documented (`francetravail.io/data/api/offres-emploi`, `francetravail.io/data/documentation`).
- **Auth**: Requires registration/app creation on francetravail.io (OAuth-style client credentials) — not fully anonymous, but free and self-service (exact approval friction unverified — search results say access is "Open" with a "Request access" step).
- **Rate limits**: Documented — Job Offers API quota is **10 calls/second** per application (verified via search of francetravail.io documentation references); 429 + Retry-After on overage.
- **Fields**: title, location, company, contract type, real-time offers, plus reference data (job categories/ROME codes, sectors, contract types, training).
- **robots.txt**: N/A — official API, not scraped.
- **Direct apply**: Mixed — France Travail offers often route through France Travail's own application flow or the employer's, varies per listing (unverified aggregate %).
- **Salary/remote/location/tech tags**: Location and contract-type strong; salary and explicit tech tags weaker (France Travail is a general labor-market API, not tech-specific) — would need software-engineering-relevant filtering (ROME codes like M1805 "Études et développement informatique") to be useful for CareerOS's SWE focus, generating significant noise otherwise.
- **Duplicate risk**: Low overlap with Arbeitnow/Himalayas (France Travail is exhaustive/official, includes many jobs those miss), but high *volume of irrelevant non-tech jobs* to filter.
- **Complexity/effort**: M — official, stable, well-documented, but requires OAuth registration flow, ROME-code filtering logic, and dealing with a broad general-labor dataset rather than a tech-curated one.
- **Tier: A** (for pure legal/stability reasons — official government API, generous rate limit, well-documented) **but flagged for filtering overhead**. High implementation value is contingent on building a good ROME-code (occupation-code) filter for software engineering; without it, signal-to-noise is poor.
- **Integration shape**: generic `Provider`, with a dedicated occupation-code filter layer.

---

## EU-wide / government

### EURES (European Employment Services)
- **Free/paid**: Free, EU public service (~3M jobs, 5,000+ employers across 30+ EEA countries per EURES's own figures).
- **API type**: **No official public API confirmed.** What exists is a reverse-engineered/community-maintained OpenAPI 3.1.0 spec (`github.com/rorar/EURES-API-Documentation`) explicitly described as unofficial, "as-is," documenting the internal API the eures.europa.eu web portal itself calls — with **no guaranteed stability, rate limits, or support**, per the project's own disclaimer.
- **robots.txt**: Not fetched; unverified.
- **Legal/ToS**: Unverified — EURES doesn't publish developer ToS for this internal API since it isn't officially offered for third-party consumption.
- **Direct apply**: EURES aggregates from national employment services; apply flow varies (often redirects to national portal or employer).
- **Salary/remote/location/tech tags**: Location/country coverage excellent (broadest EEA coverage of any source researched); salary/remote/tech-tag granularity likely weak (general labor-market service, not tech-specific), unverified in detail.
- **Duplicate risk**: EURES aggregates national employment-service data (including things like France Travail, German Arbeitsagentur, etc.) — meaningful overlap risk with the France Travail and Bundesagentur integrations below if both are built.
- **Complexity/effort**: L — no stable official contract to build against; would be building on someone else's reverse-engineering of an undocumented internal API, the least stable foundation among all EU-government options here.
- **Tier: B/C** — genuinely EU-official in origin (attractive), but **the actual technical access path is unofficial and unstable**, which is a real risk given it's ~~a government service~~ presenting itself as one without exposing a real public contract. Given Bundesagentur and France Travail *do* have first-party (if unofficial-in-Bundesagentur's-case or officially-documented-in-France's-case) more stable paths, prefer those national APIs over EURES's undocumented aggregation layer. Recommend **defer** unless/until EURES publishes a real public API.

### Germany — Bundesagentur für Arbeit (Federal Employment Agency) Jobsuche
- **Free/paid**: Free.
- **API type**: REST. **Not an official "supported" API** — the Bundesagentur does not offer a formally documented/supported public developer API — but it is the actual backend REST service (`https://rest.arbeitsagentur.de/jobboerse/jobsuche-service/pc/v6/jobs`) that powers the agency's own public job-search website, and it's openly documented by the community `bundesAPI/jobsuche-api` GitHub project (part of the well-known `bundesAPI` German government open-data documentation collective) with an OpenAPI spec.
- **Auth**: A single static, publicly known client ID works as an API key: header `X-API-Key: jobboerse-jobsuche` — this is the *same key the agency's own frontend uses*, effectively making it open in practice, though not "documented as public" by the agency itself.
- **Rate limits**: Sporadic 403s reported in practice under load (per community docs); no official documented quota. Unverified as a hard number.
- **Fields**: Full job search + detail endpoints (`/pc/v6/jobs`, `/pc/v4/jobdetails/{base64(refnr)}`), employer logos.
- **robots.txt**: N/A (REST API, not scraped HTML).
- **Legal/ToS**: Unverified formally, but this pattern (using the same public client ID the official site uses) is very widely used by the German developer community (multiple Rust/Python client libraries exist, actively maintained) without apparent enforcement action — de facto tolerated.
- **Direct apply**: Varies — routes to employer or agency application flow.
- **Salary/remote/location/tech tags**: Location strong (all of Germany), remote/salary/tech-tag granularity general-labor-market-level, not tech-curated — same ROME-code-style filtering challenge as France Travail (would need Berufsbezeichnung/occupation filtering for software engineering roles).
- **Duplicate risk**: Overlaps with Arbeitnow (which is already Germany-focused) — need to check exact overlap %, unverified, but Arbeitnow's own positioning suggests it may already source from adjacent German job-market data, so duplicate risk here is a real concern to validate before building.
- **Complexity/effort**: M — stable-in-practice REST API with existing community tooling to reference, but "unofficial" status and needing occupation filtering add work. Given Arbeitnow already covers Germany, incremental unique yield is the open question.
- **Tier: B.** Free, structured, has a real (if not agency-blessed) API with community precedent, but overlaps with the already-integrated Arbeitnow and needs volume/dedup validation before committing effort. Not as clean as Landing.jobs or France Travail on the "official" axis.
- **Integration shape**: generic `Provider`, gate on validating incremental yield over Arbeitnow first.

---

## Germany — Xing (New Work SE)
- **API type**: A historical `xing_api` Ruby gem and job-related endpoints (`Job.find`, `Job.search`) were documented years ago, but current search results show no confirmation the jobs API is still active, publicly available, or not enterprise/partner-gated post the New Work SE rebrand (2019+) and product overhaul (new app/homepage, 2023). **Could not confirm current status either way — unverified.** Given XING acquired Honeypot (2019) and has repositioned around B2B e-recruiting, the public consumer API surface for third-party job aggregation is plausibly deprecated or partner-only now, but this is inference, not a verified fact.
- **Tier: C (provisional, low confidence).** Recommend a follow-up direct check of XING's current developer portal before any implementation decision — do not treat this write-up as conclusive either way.

---

## Stack Overflow Jobs
- **Status: CONFIRMED DISCONTINUED.** Shut down March 30, 2022 (along with Developer Story and the Salary Calculator), per multiple corroborating sources including contemporaneous coverage. Not a viable source. No further action needed.

---

## Remote-first aggregator boards

| Source | Free API/RSS? | Notes | Tier |
|---|---|---|---|
| **remote.co** | Unverified — no API/RSS found in search results | No evidence of a feed; likely scrape-only or nothing usable | C |
| **JustRemote** | No RSS found; mailing-list-only per search results | Confirmed no RSS | C |
| **Jobspresso** | **Yes — RSS feed confirmed**: `https://jobspresso.co/feed/?post_type=job_listing` | Standard WordPress job-listing RSS, free, low effort | B (RSS-only, no salary/tech-tag structure typical of WP RSS, but free and simple) |
| **Dynamite Jobs** | No — paid job-posting model ($249-$449 per post + $2,000 recruiting), no evidence of a consumption API/feed | Paid-first business model, poor free-aggregator fit | C |
| **Pangian** | No API/RSS found | Job board + learning platform, no feed evidence | C |
| **SkipTheDrive** | No API/RSS found (free to search on-site only) | No feed evidence found | C |
| **VirtualVocations** | No API/RSS found; noted as skewing non-tech professional roles | Low SWE relevance even if a feed existed | C |
| **RemoteLeaf** | Advertises "world's biggest API feed of remote jobs data" (`remoteleaf.com/remote-jobs-api`) but **pricing/free-tier status not confirmed** — page exists but terms unverified | Needs direct pricing-page check before deciding tier | B/unverified — likely paid-tier gated, treat as unverified-free |
| **RemoteRocketship** | No API/RSS found; site itself has category browse pages only (e.g., `/remote-jobs/industry/api/`) | No feed evidence | C |

## EU-Startups Jobs
- **API type**: No developer API; offers per-search **custom RSS feeds** (subscribe to a filtered job search as RSS) and a general magazine RSS (`eu-startups.com/feed`) but not a bulk "all jobs" feed/API.
- **Tier: C** for bulk aggregation purposes (RSS-per-search doesn't scale to a crawl-everything model without simulating many searches) — could be **B** if CareerOS is willing to construct multiple canned RSS subscriptions (e.g., by country + "engineering" keyword), but that's a workaround, not a real feed.

## Jobtensor (Germany, Science/IT/Engineering)
- **API type**: No API found — appears to be a pure job-board website (AI-matching features are consumer-facing, not developer-facing). No GitHub, no docs, no RSS evidence surfaced.
- **Tier: C.** No structured access path found; would require full scraping with no ToS clarity. Low priority given no confirmed unique value over existing German sources (Arbeitnow, potential Bundesagentur integration).

## talent.io
- **API type**: No official public API found. Talent.io connects ~150k developers/3,000 EU companies (self-reported), Paris/Lyon/Berlin/Hamburg/London-focused, but it's a curated placement marketplace (candidates apply to the platform, get matched) — structurally similar to Honeypot/Otta in that it's not a simple public listing feed.
- **Tier: C.** No API, and the marketplace/matching model doesn't map cleanly to CareerOS's aggregate-and-list model regardless.

---

## Other notes

- **Wellfound / Otta**: out of deep-dive scope per brief (another workstream owns these). No new information gathered beyond confirming they remain unimplemented enum slots in `source-priority.ts`.
- **General EU government job portals**: France Travail and Bundesagentur für Arbeit were the two verified in depth. A broader sweep of every EU member state's national employment-service API (Italy's ANPAL, Spain's SEPE, Netherlands' UWV, etc.) was out of time budget for this pass — flagging as a good follow-up if France Travail/Bundesagentur prove valuable, since the pattern (national government open job-data API) is likely to repeat across the EU.

---

## Top picks — ranked by expected unique-vacancy yield for EU/remote software-engineering roles

1. **Personio public XML feed** (new ATS adapter) — highest strategic value: officially documented, zero-auth, unlocks a whole class of German/Austrian/Swiss SME employers CareerOS's current ATS roster under-serves. Primary cost is tenant discovery (same problem already solved for other ATS adapters).
2. **Landing.jobs** — cleanest Tier A find of this research pass: fully documented, no-auth REST API, rich fields (salary, remote, relocation, tech tags), low effort (~1-2 days), Portugal/EU tech-specific with low duplicate risk.
3. **France Travail (Offres d'emploi API)** — official French government API, documented, generous rate limit (10 req/s), but needs an occupation-code (ROME) filter for software-engineering relevance before it pays off.
4. **JustJoin.it via sitemap route** (not the robots.txt-disallowed `/api/`) — strong Polish/CEE tech-salary data, but must go through `active-jobs.xml` + generic `JsonLdAdapter`/`CustomHtmlAdapter`, not the disallowed JSON API, to stay ToS-clean.
5. **NoFluffJobs** — strong CEE tech data (salary, stack tags, 5-country coverage) but no official API; same risk class as the existing LinkedIn unofficial-scrape integration, so there's already an internal precedent for accepting this risk tier.

**Recommend deferring/skip**: BambooHR (no stable public endpoint), Welcome to the Jungle (scrape-only), Honeypot/talent.io (marketplace model, not listing feed), Stack Overflow Jobs (confirmed dead), Jobtensor/EU-Startups-bulk/most remote-aggregator boards in the table above (no free structured access found), Xing (status genuinely unclear — needs a fresh direct check, not a recommendation either way), EURES (unofficial/unstable access path — prefer national government APIs directly).
