# Free Vacancy Source Research — OSS Companies, Engineering Companies, Community/Niche Sources

Scope: Priority 12 (OSS companies), Priority 13 (Engineering companies), community sources (GitHub orgs, Open Collective, CNCF, Linux Foundation, Discord, Reddit, IndieHackers-adjacent), plus Workable ATS verification (user-requested top priority) and niche engineering job boards.

Research method: WebSearch + WebFetch verification against live endpoints/robots.txt where feasible, July 2026. Anything not directly verified is marked **unverified**.

---

## 1. Workable ATS — TOP PRIORITY FINDING

**Verdict: YES, Workable has a usable free, unauthenticated per-company job-board endpoint — directly analogous to how CareerOS already consumes Greenhouse/Lever board APIs. Recommend as a new ATS adapter.**

### What was verified
- Public widget endpoint: `GET https://apply.workable.com/api/v1/widget/accounts/{account_slug}?details=true`
  - Confirmed live and unauthenticated by direct fetch. Tested against `gitlab` (empty — GitLab does not use Workable) and `huggingface` (returned 8 live job postings).
  - Response shape: `{ name, description, jobs: [...] }`. Each job object includes: `title`, `shortcode`, `employment_type`, `telecommuting` (remote flag), `department`, `url`, `application_url`, `published_on`, `created_at`, `country`/`city`/`state`, `education`, `experience`, `function`, `industry`, `locations[]`, full HTML `description`.
  - **No salary field.** No pagination metadata (no total count/page numbers) — but Workable accounts are typically small enough this doesn't matter (returns full current list).
  - `apply.workable.com/robots.txt` allows unrestricted crawling for all bots (`Disallow:` empty), and sets `Content-Signal: search=yes, ai-input=yes, ai-train=no` — no crawl restriction on this data.
- This same endpoint powers Workable's own embeddable "job widget" that Workable explicitly designs for customers to put on their own sites — i.e., it's meant to be publicly embedded/read, even though Workable does not brand it as a public third-party developer API.
- There is **no cross-tenant/aggregation key** — Workable's authenticated REST API (SPI v3, bearer token) is scoped per-customer-account for HR/ATS operations (candidates, applications, scheduling), not for discovering "all Workable customers." This matches Greenhouse/Lever/Ashby's model exactly: CareerOS already handles this pattern (per-company slug discovery + per-company unauthenticated board fetch).
- Separate discovery surface: `jobs.workable.com` is Workable's own opt-in job marketplace aggregating postings from Workable customers who enabled it; it publishes `https://jobs.workable.com/sitemap.xml`, which is a scalable way to discover which companies use Workable and are marketplace-opted-in (robots.txt disallows only `/search`, `/profile*`, and the unauthorized-login path — sitemap and job pages are crawlable).
- ToS: no explicit "no scraping/no aggregation" clause was found in search results specifically prohibiting the widget endpoint; **unverified** whether Workable's full legal ToS (not just robots.txt) has language against third-party aggregation — recommend a human legal skim of workable.com's terms page before shipping, but robots.txt signals and the intentional public-embed design of the endpoint are a positive signal.

### Recommended integration shape
**New ATS adapter**, same pattern class as existing Greenhouse/Lever/Ashby adapters: `WorkableAdapter` keyed by discovered `account_slug`. Slug discovery via (a) `jobs.workable.com/sitemap.xml` crawl, (b) manual curation list, (c) opportunistic discovery when CompanyWatch's JobPosting JSON-LD scraper hits a page whose canonical/apply link resolves to `apply.workable.com/{slug}`.

- Free/paid: Free, no auth.
- API type: REST/JSON (undocumented-but-stable widget endpoint) + sitemap.xml for discovery.
- Direct apply: Yes (`application_url`).
- Salary: No.
- Remote flag: Yes (`telecommuting`).
- Rate limits: Unpublished/unverified — 100hires.com and jobspipe.dev sources mention an "unpublished rate limit" on the widget endpoint; be conservative (similar throttling posture to Greenhouse's board API).
- Duplicate risk: Low-medium — Workable skews SMB/mid-market, meaningfully different company population from existing ATS coverage.
- Effort estimate: **S** (2-3 days) — same code shape as existing Greenhouse/Lever adapter, main work is slug-discovery pipeline via sitemap + JSON-LD cross-reference.
- **Tier A.**

---

## 2. CNCF (Cloud Native Computing Foundation) member companies

**Verdict: structured data exists but is not freely reusable at the "member directory" level — Tier B, CompanyWatch-only, curated batch.**

- `landscape.cncf.io` / `github.com/cncf/landscape` (and successor `landscape2`) provide a machine-readable `landscape.yml` covering CNCF projects/products/members with company/org metadata (GitHub stats, HQ location, funding).
- **Licensing caveat (verified via repo README):** the generated landscape embeds Crunchbase-sourced data, and the README states this Crunchbase-derived data "is not licensed pursuant to the Apache License" and is "only permitted to be used with Linux Foundation landscape projects." The landscape.yml structural data itself is Apache-2.0/CC-BY-4.0, but blended Crunchbase fields are restricted — means bulk redistribution/reuse of the enriched dataset is legally murky; **treat as unverified for commercial reuse**, safe path is to use it only as a human curation source (a list of company *names* to manually onboard via CompanyWatch), not as a redistributed dataset.
- CNCF's own `cncf.io/about/members/` page is a member directory but was not resolvable to structured data via fetch (page renders member grid client-side; no CSV/API link found in the fetched content). **Unverified** whether an API exists — no evidence found.
- Practical value: CNCF has 700+ members (per cncf.io). Most notable ones (GitLab, HashiCorp, Grafana Labs, Elastic, Confluent, etc., per user's own framing) already run on Greenhouse/Lever/Ashby/JSON-LD, which CareerOS already supports — so the real work is a **manual/semi-automated curation pass**: pull company names from the landscape.yml (as a discovery list only, not redistributed), then run each through the existing CompanyWatch adapter-detection logic to see which ATS/JSON-LD each already emits.
- Recommendation: **CompanyWatch-only, curated batch.** Not a new adapter/provider — it's a source of company *names* to feed into existing infrastructure. Effort: **S** (1-2 days to script a one-time curation list from landscape.yml + manual QA of top ~100 by relevance).
- **Tier B** (free, but manual curation at scale, and reuse-rights ambiguity around the bundled dataset).

---

## 3. Linux Foundation member companies

**Verdict: similar to CNCF — a member list exists on-site but no structured/downloadable API was found. Tier B/C, low priority.**

- `linuxfoundation.org/membership/members` renders a members page but the fetched content did not expose a structured table, CSV, or API — likely client-side rendered directory. **Unverified** whether a hidden JSON endpoint backs the page (would require browser-level inspection, out of scope for this research pass).
- 1,000+ corporate members reported (per search aggregators, **unverified** against LF's own current count).
- High overlap risk with CNCF list (LF is CNCF's parent foundation; many CNCF members are also plain LF members) — duplicate-heavy relative to source #2.
- Recommendation: **Skip as a distinct source.** Not worth separate engineering effort beyond what CNCF curation already covers; if pursued at all, treat as an extension of the CNCF CompanyWatch curation batch, not a new pipeline.
- **Tier C** (low incremental value, no structured feed, high duplicate overlap with CNCF).

---

## 4. GitHub organizations with public careers pages

**Verdict: purely manual curation — no scalable discovery API exists. Confirms the framing in the task.**

- GitHub's own native "GitHub Jobs" product was deprecated in 2021 (confirmed via HN post and GitHub community discussion) — there is no `jobs.github.com` API anymore, and GitHub itself now runs its own careers site (`github.careers`, appears to be a Workday-family ATS, **unverified** exact vendor).
- No GitHub API exists for "orgs with a careers page" — GitHub Topics like `github.com/topics/careers` and `github.com/topics/career-pages` surface community-curated *awesome-lists* of company career pages, which is itself just crowdsourced manual curation, not a queryable structured API.
- Recommendation: **CompanyWatch-only, manual/curated batch**, sourced by scraping existing "awesome career-pages" GitHub-topic repos as a seed list, then running each through the existing `CustomHtmlAdapter`/`JsonLdAdapter` detection. No new provider/adapter needed — this is 100% a curation exercise feeding existing infra.
- Effort: **S** (1 day to build seed list from 2-3 awesome-lists + dedupe against existing companies).
- **Tier B** (free, valuable, but manual/curation-heavy, no automation multiplier).

---

## 5. Open Collective

**Verdict: not a jobs source. No job board or jobs API exists on the platform. Skip.**

- Verified via direct fetch: Open Collective is a financial-transparency/fiscal-hosting platform for open-source/community projects (expense tracking, fundraising) — "the website makes no mention of employment or recruitment functionality."
- No job board, no JobPosting schema, no jobs API found anywhere in search or fetch.
- **Tier C — reject.** Not a vacancy source at all; do not pursue further.

---

## 6. Reddit (r/forhire, r/remotejs, r/cscareerquestions, r/ExperiencedDevs, r/webdev)

**Verdict: technically feasible via OAuth API, but current (Nov 2025) policy change makes this high-friction and likely not worth pursuing now. Tier C, defer.**

- Official Reddit API: free tier exists at **100 queries/minute with OAuth**, 10 queries/minute unauthenticated (per aggregator sources; **unverified** directly against Reddit's own current dev docs, could not fetch reddit.com directly — WebFetch tool errored fetching both `www.reddit.com` and `old.reddit.com` in this session).
- **Critical recent change (per multiple aggregator sources, treat as reasonably well-corroborated but not primary-source-verified):** Reddit's **November 2025 "Responsible Builder Policy"** extended pre-approval requirements to *all* developers, not just commercial users — meaning even non-commercial/personal-project API usage now requires explicit approval before granted access. This is a material escalation from the 2023 pricing-only changes.
- Commercial/aggregator-scale use requires a negotiated enterprise contract (2024 policy: "commercial access now requires a contract"); publicly cited base commercial rate ~$0.24/1,000 calls, but real usage requires sales engagement — **not a self-serve free path for a product like CareerOS that would redistribute/display Reddit-sourced job posts to end users.**
- `reddit.com/robots.txt` was updated in mid-2024 to broadly block crawlers/scrapers (confirmed via search sources, HN discussion) as part of an anti-AI-training stance, with cloaked exceptions for paying partners (e.g., Google's $60M deal) — **strong signal that unauthenticated scraping of subreddit JSON endpoints (`/r/x.json`) is now explicitly against Reddit's stated wishes**, even though those endpoints are technically still reachable by some clients.
- Content quality concern (independent of legal/API status): r/forhire, r/cscareerquestions hiring threads, r/webdev are informal, high-noise, low-structure (free text posts, not structured JobPosting data) — would need significant NLP/parsing work to extract company/title/location/comp, with high false-positive risk (self-promotion, freelance gigs, non-jobs).
- Recommendation: **Do not pursue.** Combination of (a) Nov 2025 policy requiring pre-approval even for non-commercial use, (b) commercial contract requirement for any redistribution use case, (c) robots.txt now hostile to scraping, and (d) inherently unstructured content, makes this weak relative to effort.
- **Tier C.**

---

## 7. Discord (public job-focused servers)

**Verdict: not technically or legally viable at the message-content level. Discord's own "Server Widget" API only exposes member/channel counts and invite links — not message content. Tier C, reject.**

- Discord's public **Server Widget API** (`GET https://discord.com/api/guilds/{id}/widget.json`) is real, unauthenticated, and read-only — but only when a server admin explicitly opts in (Server Settings → Widget), and it returns only coarse metadata (online member count, channel list, invite URL) — **it does not expose message content**, so it cannot be used to extract job postings even from consenting servers.
- To actually read job-posting messages inside a Discord server requires a **bot joined to that specific server with message-read permission**, granted per-server by an admin — this is inherently a manual, one-server-at-a-time integration, not a scalable aggregation source.
- Discord's ToS explicitly prohibits scraping and self-botting; enforcement is active (2024 bans of Spy Pet-linked scraping accounts, cited in search results). Using a bot to read and republish messages without per-user/per-server consent carries real ToS and (per some cited legal commentary) GDPR exposure.
- Fit against CareerOS's `SocialMessageTransport`: theoretically a `PULL`/`API`-capable bot-based transport *could* be built per-server, similar in shape to how Telegram's public `t.me/s/<channel>` PULL transport works — but Discord has no equivalent of Telegram's public web-preview pages for arbitrary servers; the Discord equivalent would require bot invitation + explicit per-community partnership, which is an operational/BD problem, not an engineering one.
- Recommendation: **Reject as a general source.** Could be revisited only as a hand-curated, opt-in partnership with specific named tech Discord communities (e.g., a specific language/framework Discord that explicitly wants to be aggregated) — not a scalable pipeline.
- **Tier C.**

---

## 8. IndieHackers job board

**Verdict: no public API found. Content and discussion suggests IndieHackers' own community has *asked* for a jobs API but none currently ships. Tier C/manual-only.**

- `indiehackers.com/jobs` is an active jobs section (startup/remote-leaning), but no API/RSS documentation was found.
- Search results surfaced community posts (IndieHackers forum threads) *discussing the idea* of building a jobs API for curators to pull from — confirms **no such API exists today** (aspirational, not shipped).
- Would require scrape-only ingestion (HTML scraping of the jobs listing page), with attendant ToS-ambiguity and fragility risk typical of scrape-only sources.
- **Tier C** — low volume, no structured feed, scrape-only; skip unless volume is later shown to justify it.

---

## 9. Stack Overflow / Stack Exchange jobs

**Verdict: dead. Stack Overflow Jobs was fully shut down March 31, 2022 (confirmed via multiple sources including Stack Overflow's own announcement coverage and HN discussion). No remaining API surface.**

- No successor jobs product or API exists on Stack Exchange properties.
- **Tier C — reject, non-viable, confirmed dead product.**

---

## 10. Dev.to / Forem "Listings" (jobs-adjacent)

**Verdict: real but low-value — "Listings" are a general classifieds feature (jobs + conference announcements + mentorships + events), not a dedicated structured jobs feed.**

- Forem (the open-source platform powering dev.to) has a documented public API: `developers.forem.com/api/v0`, with a `/listings` endpoint returning published classified-ad-style listings (paginated, 30/page default, ordered by freshness).
- Listings mix job posts with non-job content (events, mentorship offers) — would need category/tag filtering (Forem listings do support categories) and likely still noisy/low-volume for pure software engineering jobs specifically.
- Free, documented, no auth required for public read (**unverified exact auth requirement for the /listings endpoint specifically** — Forem's API docs indicate some endpoints are public-read).
- Recommendation: **Generic `Provider`, low priority.** Worth a quick spike given it's a real documented API, but expect low signal-to-noise and modest volume.
- Effort: **S** (1-2 days) if pursued.
- **Tier B** (free, structured, low friction, but likely low unique volume/quality for the SWE-jobs use case specifically).

---

## 11. Console.dev jobs

**Verdict: no dedicated job board exists. Console.dev is purely a devtools newsletter/review publication; "jobs" only appears as a blog tag on posts discussing job-market topics, not an actual listings product.**

- **Tier C — reject, not a vacancy source.**

---

## 12. Changelog.com jobs

**Verdict: no active jobs board found. `changelog.com/jobs` returns 404; the site's navigation (Podcasts, News, Beats, Community, Merch) has no jobs/careers entry.**

- **Unverified** whether Changelog ever ran a jobs board historically (some cached/old references exist in search results but nothing live) — current state as of this research: no jobs product.
- **Tier C — reject.**

---

## 13. Niche language/framework job boards

| Source | Status | Feed | Notes | Tier |
|---|---|---|---|---|
| **PyJobs.com** (Python) | Active, verified live | **RSS confirmed working** (`pyjobs.com/rss`, valid RSS 2.0, title/link/description/pubDate per job) | ~185 active listings observed at fetch time, updates within hours, filters by location/contract/salary/experience. Salary field present in UI but showed "$0 to $0" in the RSS description sample — **unverified** whether salary is reliably populated across listings. | **A** — free, structured RSS, low effort, active/high-frequency, niche Python audience not covered by existing sources. Effort: S (1-2 days). |
| **Django Jobs** (`djangoproject.com/community/jobs/`) | Active, verified live | RSS confirmed present (page explicitly links RSS feeds for both constituent sources) | Aggregates two sub-sources: "Django Job Board" (formerly Django News Jobs) and "Built with Django Jobs." 27+ listings visible, pagination present, postings dated through July 2026 (current). | **A** — free, RSS-backed, active, niche Django audience. Effort: S (1-2 days). |
| **Golang Cafe** (golang.cafe) | **Could not verify** — WebFetch returned HTTP 429 (rate-limited) on two attempts | Unknown — **unverified** | Known in the ecosystem as a paid-first job board (employers pay to post) with a public browsable listing; historically had won some free/RSS access in the past per third-party mentions, but this session could not confirm current API/RSS status due to rate-limiting. | **Unverified — recommend a follow-up direct check before deciding tier.** Provisionally Tier B pending verification. |
| **RustJobs.dev / rust-jobs.com / rustjobs.com** | Multiple competing sites found, none deeply verified this session | **Unverified** | Fragmented niche-Rust-jobs landscape (at least 3-4 competing small sites: rustjobs.dev, rust-jobs.com, rustjobs.com, jobs.letsgetrusty.com). None confirmed to have a public API/RSS in this pass. Community post from a rustjobs.dev founder mentions cross-posting to a companion subreddit r/findrustjobs (inherits all Reddit-source caveats above). | **Tier B/C, unverified** — low individual volume, fragmented across competing sites, worth at most a single scrape-only spike on whichever has the most listings, not urgent. |
| **This Week in Rust / This Week in React / This Week in Go newsletters' job sections** | Not directly checked | **Unverified** | Not fetched this session due to time; these are newsletter-embedded job sections (manually curated by newsletter editors), realistically scrape-only against newsletter archive pages, likely low volume. | **Tier C, unverified** — low expected ROI, defer. |

---

## 14. Sitemap/RSS/Common-Crawl-based bulk discovery of JobPosting JSON-LD sites

**Verdict: a real, proven technique exists (Web Data Commons) but it's a research dataset, not a live feed — useful for one-time seed-list generation, not ongoing ingestion.**

- **Web Data Commons** (`webdatacommons.org/structureddata/schemaorg/`) has extracted schema.org structured data (including `JobPosting`) from Common Crawl snapshots annually since 2013, publishing versioned downloadable datasets (N-Quads format) with per-page source URLs. A cited analysis (skeptric.com) notes JobPosting-class adoption grew from ~7K to ~50K sites over five years within Common Crawl snapshots.
- This is **not a live/real-time feed** — Common Crawl snapshots run on their own schedule (monthly-ish), and Web Data Commons' own derived releases lag further behind. Useful strictly as a **one-time (or periodic, e.g. quarterly) batch job**: download the JobPosting subset, extract the set of distinct domains emitting JobPosting JSON-LD, cross-reference against CareerOS's existing company list, and feed the *new* domains into the existing `JsonLdAdapter`/CompanyWatch pipeline as a curated onboarding batch — exactly the kind of "bulk discovery for the generic JSON-LD infra" the task asks about.
- Practical engineering shape: not a new `Provider`/adapter at all — it's a **discovery/curation tool** that feeds the *existing* CompanyWatch + `JsonLdAdapter` infrastructure with a much larger and more automatable candidate list than manual company-by-company curation.
- Effort: **M** (3-5 days) — needs a one-off pipeline to download a Web Data Commons JobPosting subset (files can be large, N-Quads parsing needed), extract domains, dedupe against existing sources, and produce a ranked candidate list (e.g. by posting frequency/site authority) for CompanyWatch onboarding.
- **Tier A** for the *technique* (free, real, meaningfully scales the existing generic-scraper strategy well beyond manual curation) — but it is infrastructure/tooling work rather than a new "source" in the usual sense, and its output quality depends on Common Crawl's coverage/freshness (**unverified** how current the latest available WDC release is relative to July 2026 — likely lags by many months to a year given historical cadence).

---

## Sources cited (non-exhaustive, per search results)

- [Workable Jobs API: a developer's reference - JobsPipe](https://jobspipe.dev/guides/workable-jobs-api)
- [Workable API Guide: Rate Limits, Scopes, Endpoints - 100hires](https://100hires.com/workable-api.html)
- [6 ATS Platforms with Public Job Posting APIs - Cavuno](https://cavuno.com/blog/ats-platforms-public-job-posting-apis)
- [Using the Workable API to create a careers page – Workable Help](https://help.workable.com/hc/en-us/articles/115012771647-Using-the-Workable-API-to-create-a-careers-page)
- [How to embed jobs on your website (job widget) – Workable Help](https://help.workable.com/hc/en-us/articles/115012801727-How-to-embed-jobs-on-your-website-job-widget)
- [github.com/rwojsznis/workable](https://github.com/rwojsznis/workable)
- [CNCF Landscape](https://landscape.cncf.io/)
- [github.com/cncf/landscape](https://github.com/cncf/landscape)
- [Linux Foundation Members](https://www.linuxfoundation.org/about/members)
- [Reddit API Pricing 2026 - Prowlo](https://prowlo.com/blog/reddit-api-pricing)
- [Reddit API in 2026 - SocialCrawl](https://www.socialcrawl.dev/blog/reddit-data-api-2026)
- [Reddit OAuth2 - GitHub wiki](https://github.com/reddit-archive/reddit/wiki/oauth2)
- [Reddit has updated its robots.txt to block all web crawlers - HN](https://news.ycombinator.com/item?id=40873781)
- [Investigating Reddit's robots.txt Cloaking Strategy - MERJ](https://merj.com/blog/investigating-reddits-robots-txt-cloaking-strategy)
- [Discord message-scraping service claims access to 1.8 billion messages - Cybernews](https://cybernews.com/security/discord-messages-scraping-privacy-breach/)
- [Add Server Widget JSON API Support - discord.py issue #33](https://github.com/Rapptz/discord.py/issues/33)
- [GitHub Jobs are deprecated - community discussion #9879](https://github.com/orgs/community/discussions/9879)
- [Deprecation notice: GitHub Jobs site - HN](https://news.ycombinator.com/item?id=26864423)
- [Stack Overflow Jobs and Developer Stories Ending by March 2022 - Dice.com](https://www.dice.com/career-advice/stack-overflow-jobs-and-developer-stories-ending-by-march-2022)
- [DEV API (beta) - Forem Docs](https://developers.forem.com/api/v0)
- [skeptric - Schemas for JobPostings in Practice](https://skeptric.com/schema-jobposting/)
- [skeptric - Extracting Job Ads from Common Crawl](https://skeptric.com/common-crawl-job-ads/)
- [The Web Data Commons Schema.org data set series](https://webdatacommons.org/structureddata/schemaorg/)
- [Rust jobs have not been easy to find online... - users.rust-lang.org](https://users.rust-lang.org/t/rust-jobs-have-not-been-easy-to-find-online-so-i-created-rustjobs-dev-and-r-findrustjobs/53472)

---

## Top picks summary

### Tier A (recommend pursuing)
1. **Workable ATS (new adapter)** — free, unauthenticated, live-verified per-company JSON endpoint (`apply.workable.com/api/v1/widget/accounts/{slug}`), same shape as existing Greenhouse/Lever adapters, plus a sitemap-based discovery path via `jobs.workable.com`. Effort S. **This was the user's top-priority ask and it checks out.**
2. **PyJobs.com** — verified live RSS feed, active Python-specific job board, S effort.
3. **Django Jobs (djangoproject.com/community/jobs)** — verified live, RSS-backed, aggregates two sub-sources, S effort.
4. **Web Data Commons / Common Crawl JobPosting bulk discovery** — a genuinely scalable technique to feed the existing CompanyWatch/JsonLdAdapter with new companies far beyond manual curation; M effort, one-time/periodic batch tooling rather than a live source.
5. **Dev.to/Forem Listings API** — real documented public API, free, low effort, but expect modest SWE-specific volume/quality (borderline A/B — included here as the 5th pick given it's the only other *fully documented, authenticated-free* API found in this batch beyond Workable).

### Tier B (curated/manual, worth doing but not automatable)
- CNCF member list → CompanyWatch curation batch (reuse-rights caveat on bundled Crunchbase data — use as a name list, don't redistribute the dataset)
- GitHub-topic "awesome career-pages" lists → CompanyWatch curation batch
- Golang Cafe (unverified this session, rate-limited — needs follow-up check)

### Tier C (reject / defer)
- Linux Foundation members (redundant with CNCF, no structured feed)
- Open Collective (not a jobs source at all)
- Reddit (r/forhire, r/cscareerquestions, etc.) — Nov 2025 pre-approval policy + commercial-contract requirement + hostile robots.txt + unstructured content
- Discord — widget API exposes no message content; per-server bot integration is a BD problem, not scalable engineering
- IndieHackers jobs — no API, scrape-only, low volume
- Stack Overflow Jobs — confirmed dead since March 2022
- Console.dev — no jobs product exists
- Changelog.com — no jobs product exists currently
- RustJobs.dev/rust-jobs.com and language-newsletter job sections — fragmented, low volume, unverified feeds, low ROI
