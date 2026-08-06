# Free Vacancy Source Research — AI / SaaS / Startup / Scale-up / VC & Accelerator Portfolios

Scope: source-priority.ts Priority 5 (AI companies), 6 (SaaS), 7 (Startups), 8 (Scale-ups), 9 (Product companies), 10 (VC portfolio), 11 (Accelerator portfolio).
Research date: 2026-07-30. All claims marked "unverified" could not be confirmed via WebFetch/WebSearch in this session — treat as directional, not load-bearing.

Reminder of context: CareerOS already has a generic `CustomHtmlAdapter` + `JsonLdAdapter` for any company career page emitting schema.org `JobPosting` JSON-LD. That means individual company career pages are usually already coverable. The value of this research is aggregator-level: platforms that expose many companies' jobs through one API/feed, or that reveal common ATS usage.

---

## 1. Wellfound (formerly AngelList Talent) — PRIORITY

- **Official API**: None found. No self-serve developer docs, no API keys, no OAuth app registration flow discovered. Third-party sources ("apitracker.io", Apify listings) merely index unofficial scrapers, not an official API.
- **robots.txt** (`wellfound.com/robots.txt`, fetched): Disallows `/_jobs/`, `/jobs/` application/signup subpaths, `/auth/`, `/profile/*`, `/recruit/dashboard`, `/u/`, `/projects/`, and any URL containing `jobId`, `jobSlug`, `preview`, `role`, `inFrame` query params. **Allows** `/company/*` pages and plain public job-listing pages without those params. Two sitemaps referenced. No crawl-delay, no explicit bot bans. This is consistent with "allow search-engine indexing of public listings, block deep-linking into interactive/auth flows" — i.e., scraping the public listing pages is not robots-blocked, but this is not the same as ToS permission.
- **ToS**: Not directly fetched (blocked/paywalled in this session — **unverified**). Secondary sources (Apify scraper descriptions) explicitly state "end user is responsible for compliance with... Wellfound's Terms of Service" and note scraping should avoid private/personal data — implying Wellfound's ToS restricts scraping in some form typical of VC-backed consumer platforms (anti-scraping clause is near-universal on such sites). Treat as **likely ToS-restricted**, unverified in exact wording.
- **Direct apply**: Wellfound historically supports both "Apply" (goes to an in-platform application, sometimes forwarded to the company, sometimes just a message) and, for some listings, a link out to the company's own ATS. Mixed/inconsistent — **not guaranteed direct-apply**, similar risk profile to LinkedIn's unofficial scrape already used by CareerOS.
- **Salary/remote/tags**: Rich structured data (salary range, equity, remote flag, stage) is a genuine differentiator — this is Wellfound's strongest value proposition.
- **Volume**: Very large — 10M+ candidate profiles claimed, thousands of active startup listings, historically the biggest single startup-jobs aggregator.
- **Duplicate risk**: High overlap with Ashby/Greenhouse postings from the same startups (many post to both), and with LinkedIn scrape.
- **Implementation**: Only via unofficial scraping (GraphQL endpoint reverse-engineering, per `github.com/subbuwu/wellfound_graphqlscout`) or paid third-party scraper APIs (Apify, ~$/1000 results). No stable free path.
- **Effort**: M–L (reverse-engineered GraphQL endpoint is undocumented and can break without notice; ongoing maintenance burden).
- **Tier: C.** No official free API, ToS scraping risk, inconsistent direct-apply. Recommend **skip/defer** — same class of risk profile that led to RemoteOK's removal, and CareerOS already gets LinkedIn-scrape coverage of overlapping companies with an accepted risk tradeoff; adding a second high-risk unofficial scraper for materially overlapping supply isn't justified.
- **Integration shape if ever revisited**: Would need a bespoke unofficial-API adapter (not a `Provider`/ATS pattern) with heavy monitoring — not recommended now.

## 2. Otta (now "Welcome to the Jungle" after merger) — PRIORITY

- **Rebrand confirmed**: `otta.com` 301-redirects to `uk.welcometothejungle.com` (fetched, confirmed live). Otta merged into Welcome to the Jungle (a large French/European job platform) — the standalone "Otta" brand/product is effectively gone as of this research.
- **robots.txt** (`uk.welcometothejungle.com/robots.txt`, fetched): Fully permissive — `Disallow:` empty, `User-agent: *`, no path restrictions, no crawl-delay, no bot-specific rules. Everything crawlable per robots.txt.
- **API**: No public/documented API found. Ashby's docs reference "welcome to the jungle (formerly otta)" only as an *outbound* distribution partner for Ashby-posted jobs (i.e., Ashby can push jobs to WTTJ, not that WTTJ exposes a public read API for third parties).
- **Direct apply**: Historically Otta's UX was "curated matches, apply via Otta profile then introduction," not a raw job-board apply — i.e., **platform-mediated**, not classic direct-apply. Under Welcome to the Jungle now, behavior likely varies by listing (unverified in detail).
- **ToS**: Not fetched directly — unverified, but a large commercial job platform (WTTJ) almost certainly prohibits bulk scraping/republishing in ToS even though robots.txt is permissive (robots.txt ≠ ToS permission).
- **Volume/relevance**: WTTJ is large in Europe but not particularly AI/startup-specialized post-merger; Otta's original tight "curated startup/scale-up" focus is diluted.
- **Tier: C.** No API, ToS likely prohibits scraping despite permissive robots.txt, application flow historically platform-mediated not direct-apply, and the product identity CareerOS's slot was reserved for (a curated AI/startup board) no longer really exists standalone. Recommend **retire/repurpose the `otta` enum slot** rather than implement — the entity behind it has changed materially since the slot was likely reserved.

## 3. Y Combinator "Work at a Startup" (workatastartup.com) — PRIORITY

- **Real public API found and verified**: `https://api.ycombinator.com/v0.1/companies` returns live, unauthenticated JSON — confirmed via direct fetch: paginated (`page`, `totalPages`: 245 at time of check), company metadata (id, name, slug, website, logo, description, team size, location/region, industry tags, YC batch, hiring status). This is a genuine, currently-working, no-auth-required endpoint.
- **Jobs-specific endpoint**: `https://api.ycombinator.com/v0.1/jobs` returned **404** in this session — the equivalent jobs endpoint (if it exists) is not at that path, or requires different auth/params. **Unverified** — would need further reverse-engineering (e.g. via browser devtools on workatastartup.com/jobs) to find the real jobs-list endpoint, which almost certainly exists client-side since the site renders job listings dynamically.
- **Direct apply — CRITICAL FINDING, verified via multiple sources**: Work at a Startup is explicitly **NOT** a per-job direct-apply system. Per YC's own FAQ summary and corroborating HN discussion (news.ycombinator.com/item?id=44303866, fetched): candidates build **one profile**, YC "makes it available to startups," and "if a company is interested... they'll contact you" — it is an *inbound-interest / introduction* model, not outbound application-to-ATS. One HN commenter (a YC founder) reports being "ghosted by every single company" and speculates the apply flow is "essentially an email" that may be "silently ignored." This is functionally the same category of problem that got RemoteOK removed (platform-mediated, not genuine direct-apply-to-employer) — arguably worse, since there's no confirmed per-job apply URL to the employer's own ATS at all.
- **robots.txt** (`workatastartup.com/robots.txt`, fetched): Fully permissive, no disallows, no API paths mentioned.
- **Volume**: Large — "4,000+ YC companies," every batch since 2005.
- **Duplicate risk**: Very high — most funded YC startups already use Ashby or Greenhouse (both already integrated by CareerOS), so their real direct-apply postings are likely already reachable through existing ATS adapters once a career-page URL is known.
- **Tier: B/C.** The company-metadata API (`v0.1/companies`) is a genuinely useful, free, stable, unauthenticated data source for *discovering which companies exist / are hiring* (useful as a feed to seed CompanyWatch or to find career-page URLs for the existing JSON-LD/HTML adapter) — that part is Tier A-quality as a **discovery** source. But as a **vacancy/apply source** it fails the direct-apply requirement outright, so Tier C for that purpose.
- **Recommended shape**: Not a new ATS `Provider`. If anything, use `v0.1/companies` as a **CompanyWatch seed/discovery feed** (cheap, free, real, gives company name + website + YC batch + hiring flag) to auto-populate career-page targets for the existing `CustomHtmlAdapter`/`JsonLdAdapter` — not as a vacancy source in its own right. Do not build a jobs adapter against `workatastartup.com`.

## 4. AI-specific job boards

### 4a. ai-jobs.net / aijobs.net (operated by "Foorilla")
- Historically documented (per Foorilla's own "Insights" blog posts, found via search) a free **RSS feed** (`ai-jobs.net/feed/`) and free **JSON API** (`ai-jobs.net/api/list-jobs/`, ~200 most recent jobs, refreshed ~2h, explicit stated permission to "re-publish data on a website of yours, even another job board or aggregator").
- **However, verification in this session found those exact URLs now 404** on the live site (`aijobs.net`, confirmed via curl with both `ai-jobs.net` — which 301-redirects to `aijobs.net` — and directly). The site has been re-skinned (v1.3.7, Django/htmx stack) and its footer no longer links an RSS/API page; robots.txt (`aijobs.net/robots.txt`, fetched) is permissive (`Allow: /`, only `Disallow: /account/`) but that doesn't confirm the API still exists.
- The operator "Foorilla" is consolidating properties into **`foorilla.com`** ("the career platform for coders, builders, hackers and makers") which has a live `/api/` page (200 OK, confirmed), but its content is JS-rendered (htmx) and couldn't be read statically in this session — **unverified** whether a current self-serve free API exists under the new brand, or whether it's now paid/partner-only.
- A related Foorilla open-data repo (`github.com/foorilla/ai-jobs-net-salaries`, CC0) confirms Foorilla does publish some data in the public domain, suggesting an open-data-friendly posture historically.
- **Direct apply**: The historical API schema was described as including an "apply link" (i.e., pass-through to the original job posting) — consistent with direct-apply, but unverified against current site.
- **Tier: B** (downgraded from what would be Tier A if the documented API still worked) — **recommend a follow-up engineering spike** to manually inspect `foorilla.com`'s live network requests (needs a browser, not curl) before committing engineering time, since the documented endpoints are stale.
- **Note**: Foorilla likely also operates other niche boards CareerOS may already touch indirectly (worth checking if Jobicy, already integrated, is a related/sibling property — not confirmed).

### 4b. Hugging Face "Jobs"
- **Rejected — false lead.** `huggingface.co/docs/hub/jobs*` refers to Hugging Face's **compute/job-execution product** (run GPU jobs via `hf` CLI, Docker/UV-based), not an employment/careers board. No employment jobs board found at Hugging Face. **Tier: N/A — not a vacancy source.**

### 4c. Other "AI jobs" directories
- Generic search turned up mostly low-quality SEO directories and third-party scrapers (ZipRecruiter/SimplyHired-style aggregations, not primary sources) with no structured API — not worth individual write-ups; none met the bar of "real structured data/API" beyond ai-jobs.net/Foorilla above.

## 5. VC Portfolio Job Boards — key structural finding

**Most large VC firms' "portfolio jobs" pages are not bespoke — they run on one of two third-party SaaS platforms: Getro or Consider.** This is the single most useful finding for engineering-effort estimation: building one well-behaved adapter for each platform's data shape could cover many VC firms at once, rather than one-off adapters per firm.

| Firm | Board URL | Platform (confirmed) |
|---|---|---|
| Sequoia Capital | jobs.sequoiacap.com | **Consider** (footer: "Powered by Consider", confirmed via fetch) |
| Index Ventures | indexventures.getro.com | **Getro** (confirmed via domain + robots.txt sitemap pattern) |
| General Catalyst | jobs.generalcatalyst.com | Unconfirmed platform, likely Getro/Consider-class (not fetched) |
| Bessemer Venture Partners | jobs.bvp.com | Unconfirmed platform (not fetched) |
| Lightspeed Venture Partners | jobs.lsvp.com | Unconfirmed platform (not fetched) |
| Accel | (no dedicated aggregated board found; third-party trackers like TopStartups.io/FoundingHunt fill the gap unofficially) | N/A |
| First Round Capital | (no dedicated aggregated board found beyond Wellfound company page) | N/A |
| Techstars | jobs.techstars.com | Unconfirmed platform (not fetched) |

### Getro
- **What it is**: B2B SaaS ("#1 Job Board & Warm Intro Solution," per getro.com) sold to VC firms/accelerators to run a portfolio-wide job board + "talent network." Getro states it's used by "700+ VC platform teams" — meaning Getro-class boards likely power the *majority* of VC/accelerator "portfolio jobs" pages industry-wide, not just the handful above.
- **API**: Getro advertises a "Network Data API" (`getro.com/api`) for "real-time contact, job, and company data" — but this returned **403 Forbidden** on direct fetch (bot-protected) and appears to be a **paid/partnership product sold to Getro's VC customers**, not a self-serve free API for third-party aggregators like CareerOS. **Unverified pricing, but framing is enterprise-sales, not public/free.**
- **Frontend**: Confirmed JS-rendered SPA (empty static HTML on curl fetch of indexventures.getro.com) — scraping would require a headless browser, not simple HTTP.
- **robots.txt** (indexventures.getro.com, fetched): Permissive (`Allow: /`), includes `Crawl-delay: 1` and a sitemap — scraping is not robots-blocked, but requires JS rendering.
- **Direct apply**: Unverified per-listing; Getro boards typically link out to the portfolio company's own job posting (often itself an Ashby/Greenhouse/Lever posting), which if true would actually be genuine direct-apply — but not confirmed by testing an actual link click in this session.
- **Tier: B.** Real structured data exists behind a JS wall; no free self-serve API; likely good direct-apply if links resolve to company ATS pages (plausible but unverified); duplicate risk vs. existing Ashby/Greenhouse/Lever integrations is probably **high**, since Getro boards mostly aggregate postings that already live on those ATSes.

### Consider
- **What it is**: Same category as Getro — "Powered by Consider" SaaS for VC talent boards (confirmed on Sequoia's board). `product.consider.com/ctc/talent-circle` referenced in footer.
- **API**: Not found/not investigated in depth this session — **unverified**.
- **Tier: B/unverified**, same reasoning as Getro (likely re-aggregates existing ATS postings).

### Bottom line on VC portfolio boards
Because these platforms mostly **re-surface jobs that already live on Ashby/Greenhouse/Lever/Workday** (all already integrated by CareerOS), the *unique* vacancy yield from building Getro/Consider adapters is likely **low relative to effort**, even though the aggregation convenience (one URL → many startups) is real. The better ROI is using these boards as a **company/URL discovery mechanism** (find portfolio company names + career-page domains to feed the existing `CustomHtmlAdapter`), similar to the YC companies API recommendation above — not as a primary vacancy-ingestion `Provider`.

### Individually-run VC job pages without a shared platform (Accel, First Round Capital)
No dedicated firm-run aggregated jobs page found for Accel or First Round Capital beyond generic third-party trackers (TopStartups.io, FoundingHunt, VentureCapitalCareers — none of which are official, structured, or reliable enough to be worth adapters). **Tier: C / skip.**

## 6. Accelerator Portfolio Job Boards

| Accelerator | Board | Notes |
|---|---|---|
| Y Combinator | workatastartup.com | Covered in detail above (§3) — not direct-apply, Tier C for vacancies, Tier A-ish for company discovery. |
| Techstars | jobs.techstars.com | Exists, structure/platform not confirmed (unverified whether Getro/Consider/bespoke); `jobs.foundry.vc/companies/techstars` also surfaced, suggesting Techstars' board may itself run on a third platform ("Foundry"?) — **unverified, needs follow-up**. |
| 500 Global | 500.co/careers | This is 500 Global's *own hiring* page, not a portfolio-wide jobs aggregator — no evidence of a portfolio jobs board. **Tier: C / not applicable.** |
| Antler | careers.antler.co/jobs, global.antler.com/pages/careers | Appears to mix Antler's own hiring with portfolio-company roles; platform/API unconfirmed. **Unverified, low confidence.** |
| Plug and Play Tech Center | jobs.pnptc.com/jobs | Portfolio-wide board exists; platform/API not confirmed. **Unverified.** |

None of these were verified to expose a public API in this session; all would need direct fetch/devtools inspection (several are likely also Getro/Consider-class SPAs, consistent with the pattern above) before any implementation decision. Given the VC-board pattern found, the reasonable prior is: **mostly Getro/Consider-class re-aggregation of existing ATS postings**, i.e., low unique yield, Tier B/C pending verification.

## 7. a16z "Speedrun" Talent Network — notable find (not explicitly requested, but same VC-portfolio category)

- **Real, live, documented, free, no-auth JSON API — best-verified source in this research.**
- Base: `https://speedrun-talent-network.com/api/v1` — fetched, returned a real OpenAPI-style metadata document (name, version, `docs`, `openapi` spec link, `mcp` reference, and 7 documented endpoint groups: jobs list/by-id, companies list/by-slug, collections list/by-slug, hiring stats).
- `GET /api/v1/jobs` — fetched directly, returned **real live data**: 50 jobs per page, **15,909 total jobs** across 319 pages. Fields per job: `id, title, company, location, workplace_type, employment_type, function, seniority, remote, comp_min, comp_max, comp_currency, comp_period, published_at, url, tier, stealth`. Salary fields present — good. No API key required in this fetch.
- **Officially run by a16z** — confirmed via page branding/footer ("© 2026 a16z speedrun", links to a16z.com Privacy/Terms/Disclosures).
- **Direct apply — caveat**: No `apply_url` field; the only link is `url`, which points back to `speedrun-talent-network.com/jobs/[slug]` (the aggregator's own domain), not directly to the company's ATS. Whether that page then forwards/redirects to the employer's own apply flow is **unverified** (would need to load an actual job page and follow the "Apply" CTA in a browser — not confirmed by static fetch).
- **Volume**: ~15,900 jobs is very large — bigger than most single ATS-vendor pools CareerOS already has, and specifically VC-portfolio/startup flavored (a16z-backed, includes AI-heavy portfolio).
- **Scale/coverage**: Covers "speedrun and a16z portfolios" — broader than just a16z's namesake accelerator.
- **Tier: A, conditional on confirming direct-apply behavior.** This is the strongest single find in this research — free, real, versioned, documented API, huge volume, salary data, official operator, no auth. The only open question gating a Tier-A recommendation is whether `url` ultimately routes to genuine employer-side application or an a16z-mediated contact-gate. **Recommend this as the top follow-up to verify with a quick browser check before scoping implementation.**
- **Recommended shape**: New generic `Provider` (REST/JSON, paginated, versioned) — clean fit for CareerOS's existing Provider abstraction, not an ATS adapter (it's not an ATS, it's a curated aggregator, so treat like Remotive/Arbeitnow/Himalayas-style integrations already in the codebase).
- **Effort**: S — well-documented REST JSON API, standard pagination, no auth. Estimate 1–2 engineering days for initial ingestion + mapping, assuming direct-apply is confirmed acceptable.

## 8. Startup.jobs

- **robots.txt** (startup.jobs, fetched): Notably **disallows** `*/apply$` and `/apply/*` (i.e., don't crawl the apply-flow pages) and `/cdn-cgi/`, `/metrics/*`, `/reports/new`, and template-artifact URLs. Explicitly rate-limits several known aggressive bots (SemrushBot, MJ12bot, AhrefsBot, DotBot fully disallowed) and sets `Crawl-delay: 10` for GPTBot/ClaudeBot/Amazonbot/Bytespider. Job-listing pages themselves are not disallowed.
- **API/feed**: No public API or RSS feed found via search — startup.jobs appears to be a curated directory/marketing site (it also publishes "job board review" articles about competitors, e.g. it was the source for several other boards' write-ups referenced elsewhere in this doc) rather than a jobs data provider itself. **Unverified whether any feed exists** — worth a direct email/partner inquiry, not resolvable via search.
- **Tier: C (pending)** — no confirmed structured data access; the `Crawl-delay: 10` for AI/LLM-bots plus disallowed apply-paths signals a scraping-averse operator even though core listing pages aren't blocked.

## 9. BuiltIn (builtin.com)

- **robots.txt** (fetched): Standard Drupal-generated robots.txt. Disallows admin/user/account/search/taxonomy/event/billing/member paths and some company-directory filter permutations (`/companies/*hiring/office`, `?ni=5`), but **does not disallow individual job posting or company profile pages** — those are crawlable per robots.txt.
- **API**: No official API found. Multiple third-party Apify scrapers exist (confirms scrape-only access), with explicit disclaimers that "Built In's content is not released under an open-data license" and scraper operators push ToS-compliance responsibility onto the end user.
- **Direct apply**: BuiltIn job listings typically link out to the employer's own application page/ATS (consistent with typical B2B job-board behavior) — **plausible direct-apply but not individually confirmed** in this session.
- **Volume/focus**: Large, well-known US tech-hub job board (SF, NYC, Chicago, Austin, Boston, Seattle, LA editions) with strong SaaS/startup/scale-up representation — good topical fit for Priority 6–9.
- **Tier: B/C.** No API, ToS ambiguous/likely restrictive on redistribution ("not open-data licensed"), scrape-only. Real volume and topical fit, but legal risk profile similar to a mainstream commercial job board (more corporate/legal-risk-averse than a startup-run aggregator). Recommend **defer** unless CareerOS is willing to accept scrape-based ToS risk comparable to what it already carries for LinkedIn.

## 10. VentureLoop

- Described as a paid-first model: "free job posting plan for qualifying employers" plus a **$99/post paid package** — meaning much of its inventory may be paid-tier employer listings, and it's a smaller/older niche board (predates the current YC/Wellfound-era ecosystem).
- No API/feed found.
- **Tier: C — low volume, unverified freshness, no structured access. Skip.**

## 11. IndieHackers Jobs

- `indiehackers.com/jobs` exists as a jobs section of the IndieHackers community/forum product; separately, individual community "products" like "Front End Remote Jobs" are third-party boards *listed within* IndieHackers, not IndieHackers' own inventory.
- No API found. IndieHackers' own community threads about "how to build a job board" reference generic third-party scraping/backfill APIs (e.g., "Job Data API") as inputs *other people* use to seed job boards — not evidence IndieHackers itself exposes one.
- **Volume**: Low — IndieHackers is primarily a maker/bootstrapper community; job volume is small relative to VC-funded-startup boards, and skews toward small indie/bootstrapped roles rather than funded-startup engineering roles.
- **Tier: C. Low volume, no API. Skip.**

## 12. Product Hunt Jobs

- No dedicated, current `producthunt.com/jobs` structured board confirmed. Product Hunt's job-related presence in 2026 is community/forum-style ("Startup Roles [Month] 2026" discussion threads under a "Career" topic) plus a "Job Boards" *category of products launched on PH* (i.e., PH indexes *other people's* job-board products, it isn't one itself).
- **Tier: C — not a structured vacancy source at all currently. Skip / not applicable.**

## 13. RemoteRocketship

- Aggregates remote job listings from other sources (i.e., itself a downstream aggregator, likely re-publishing jobs CareerOS may already ingest from primary sources) — "aggregating remote job listings from various sources across the internet." No payment from companies to list (good signal for listing being organic/scraped rather than pay-to-post, but also means no direct relationship/API guarantee).
- No public API/feed found.
- **Direct apply**: Unverified — depends entirely on the underlying original source per listing.
- **Duplicate risk**: High — by design it's a secondary aggregator of primary sources, several of which CareerOS may already have.
- **Tier: C. Secondary aggregator, no API, high duplicate risk. Skip.**

## 14. SaaStr Jobs / SaaS-specific boards

- No dedicated, distinct "SaaStr Jobs" structured board found beyond generic mentions; SaaS-focused roles are covered adequately by BuiltIn, Wellfound, and general aggregators already assessed above. No SaaS-specific aggregator with its own API surfaced in this research.
- **Tier: C / not applicable — no distinct product found worth separate evaluation.**

---

## Top Picks Summary (ranked by expected unique-vacancy yield × AI/startup relevance × free-access feasibility)

1. **a16z Speedrun Talent Network** (`speedrun-talent-network.com`) — Tier A (conditional on direct-apply verification). Real, versioned, documented, free, no-auth JSON API; ~15,900 live jobs; salary data; official a16z operation. Single best find in this research. **Action: verify one job's actual apply-click destination before committing engineering time; if it forwards to the employer's ATS, greenlight as a new generic `Provider`.**
2. **YC `api.ycombinator.com/v0.1/companies`** — Tier A as a *discovery* feed (not a vacancy source). Free, live, unauthenticated, 245 pages of YC company metadata with hiring-status flags. **Action: use to auto-seed CompanyWatch / career-page targets for the existing JSON-LD adapter**, not as a jobs `Provider`.
3. **ai-jobs.net / Foorilla** — Tier B, high potential if the historically-documented free JSON API/RSS still exists under the `aijobs.net`/`foorilla.com` rebrand (old URLs now 404; needs a browser-based follow-up check, not just curl). If confirmed live, this would likely jump to Tier A — genuinely AI-focused, explicit republishing permission previously granted.
4. **Getro/Consider-powered VC portfolio boards** (Index Ventures, Sequoia, General Catalyst, Bessemer, Lightspeed, etc.) — Tier B collectively. Not worth per-firm adapters (high duplicate overlap with existing Ashby/Greenhouse/Lever coverage, no free API, JS-rendered), but valuable as a **company/domain discovery layer** feeding the existing generic HTML/JSON-LD scraper.
5. **BuiltIn** — Tier B/C. Real volume and good SaaS/startup/scale-up topical fit, crawlable per robots.txt, but no API and ToS explicitly disclaims open-data licensing — only pursue if CareerOS's risk tolerance for scrape-based ToS ambiguity (as already accepted for LinkedIn) extends here.

**Explicit rejects (Tier C, do not implement):** Wellfound (no API, ToS-risky, inconsistent direct-apply), Otta (dissolved into Welcome to the Jungle, no API, historically platform-mediated apply), Work at a Startup as a *vacancy* source (confirmed non-direct-apply, introduction-only model), Hugging Face (no jobs board exists — false lead), VentureLoop, IndieHackers Jobs, Product Hunt Jobs, RemoteRocketship, SaaStr Jobs, startup.jobs (pending, leaning reject), 500 Global/Antler/Plug and Play/Techstars portfolio boards (unverified, likely same low-yield Getro/Consider pattern as VC boards), Accel/First Round Capital (no aggregated board exists at all).

**Recommendation for the `otta` enum slot in `source-priority.ts`**: given Otta no longer exists as an independent product (merged into Welcome to the Jungle) and never had a public API, recommend removing/repurposing this reserved slot rather than building against it — the original target has changed materially.
