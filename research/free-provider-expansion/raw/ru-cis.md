# RU/CIS Free Vacancy Source Research — Priority 1 (RU-speaking companies) & Priority 2 (CIS product companies)

**Date:** 2026-07-30
**Author:** Research pass, research-only — no source, config, or `.env` files were modified.
**Method:** WebSearch for discovery + claim triangulation; WebFetch for direct verification of robots.txt, API docs, and page structure where the tool could reach the page (some sites block the fetcher outright — noted per-source). Where a claim could not be directly verified, it is marked **unverified**, matching the honesty standard of `docs/reports/telegram-channel-research.md`.

## Prior work this builds on (do not re-litigate)

`research/job-sources-russian-sw/REPORT.md` (2026-07-21) and `CIS-ROADMAP.md` (2026-07-23) already did a first pass covering HH, SuperJob, Habr Career, Telegram, FL.ru, Kwork, Habr Freelance, Trudvsem.ru, CV-Online Baltics, Poslovi Infostud (Serbia), HR.ge, AllJobs/JobMaster (Israel), Avito Rabota (dead-ended — anti-bot), Zarplata.ru/Job.ru (dead-ended — unverified/stale), Careerist.com/VC.ru (dead-ended as of that pass — "content platforms, not job boards"). HH, SuperJob, Habr Career, and Telegram-channel-scraping have since shipped as providers. This report does **not** repeat those verdicts; it goes after the gaps the task brief called out: Djinni, Relocate.me, GeekJob.ru, Ukrainian boards (robota.ua/work.ua/dou.ua), the full HH area-ID picture, RU-specific ATS platforms (Huntflow/Talantix) as a *new adapter class*, Potok.io, Careerist/Talentum re-check, RU tech-media job boards (vc.ru/Tproger), and spot-checks of what ATS/markup sits behind large RU employers' career pages.

---

## 1. Djinni.co

- **Free/paid:** Free to browse; developer accounts are free. No public read API.
- **API type:** None found. A Postman workspace titled "DJINNI | Public APIs" exists (`postman.com/djinni`) but WebFetch on it returned no substantive collection content — **unverified** whether it's an official published API or an empty/placeholder workspace. Third-party scrapers exist on Apify (`djinni-co-scraper`, multiple vendors) confirming no official feed.
- **robots.txt (verified via WebFetch, 2026-07-30):** `Disallow: /jobs2`, `/q`, `/developers`, `/free-jobs`, `/set_lang`. **No disallow on `/jobs/`** (the main listing path) or on any API-like path. Sitemap at `/sitemap.xml`.
- **ToS:** Could not locate an explicit anti-scraping clause via search — **unverified**. Given the exposed sitemap and permissive robots.txt on `/jobs/`, technical risk looks lower than legal-risk-unverified.
- **Rate limits:** Undocumented — unverified.
- **Direct apply:** Djinni is an "anonymous job search" platform — candidates apply *through* Djinni, employers respond inside the platform. This is closer to a contact-reveal/inbox model than a direct external apply link — **flag as a fit concern** for CareerOS's "direct apply" priority (RemoteOK was removed for the same class of problem, though Djinni's model is closer to LinkedIn Easy Apply than a hard paywall).
- **Salary:** Often shown as employer-supplied ranges. **Remote:** Extensive remote/relocate tagging. **Location quality:** Ukraine-centric, broad CIS reach. **Tech tags:** Strong, structured (role, stack, seniority filters).
- **Update frequency:** High — active, one of the largest UA/CIS dev-specific boards.
- **Duplicate risk:** Low-medium against HH/Habr Career/SuperJob (Djinni skews Ukraine/English-speaking-CIS more than those three RU-core boards); some overlap with Telegram channel reposts.
- **Quality/complexity/maintenance:** Vacancy quality expected high (dev-only board). No official API means this is a scrape-only build — Medium complexity (structured HTML, JS-light per Apify scrapers suggesting server-rendered pages), Medium maintenance (HTML-shape risk), effort estimate **5–8 days** for a scrape-based fetcher+mapper+normalizer.
- **Tier: B.** Free, scrapable, decent-legal-signal robots.txt, real unique CIS-dev volume — held back from Tier A only by (a) no official API (build/maintenance risk) and (b) the apply-flow being an internal-inbox model rather than a clean direct-apply link, which needs a product decision before treating it like HH/SuperJob.
- **Recommended shape:** New `Provider` (fetcher/mapper/normalizer) using the existing job-board-scrape pattern, **not** an ATS adapter (Djinni isn't a platform other companies embed) and not CompanyWatch (it's an aggregator, not a single company). Flag the apply-flow question to product before building.

## 2. Relocate.me

- **Free/paid:** Free to browse for candidates; monetizes on the employer side (relocation-focused recruiting service).
- **API type:** None found — no official API, no RSS. **robots.txt (verified via WebFetch, 2026-07-30):** only disallows `/install/`, `/manager/`, `/uploads/` (with two uploads sub-paths explicitly re-allowed); job listing paths are unrestricted. Sitemaps at `/sitemap.xml` and `/blog/sitemap.xml`.
- **ToS:** Unverified — not checked directly.
- **Direct apply:** Relocate.me is explicitly a *relocation service*, not a plain job board — flow typically goes through Relocate.me's own application/coordination process (they broker visa/relocation logistics), not a clean "click through to company ATS" link. **Flag as a fit concern**, similar to Djinni.
- **Salary/remote/tech:** Prior research (`REPORT.md` #34) put volume at 5K–10K listings, "built by Ukrainians, 300K dev community" — that framing is from the earlier pass and re-stated here as **unverified** (not independently re-confirmed this session).
- **Duplicate risk:** Low direct overlap with HH/SuperJob/Habr Career (relocation-to-EU angle is a different segment than RU-domestic hiring), but likely meaningful overlap with Djinni's relocate-tagged listings and We Work Remotely/Himalayas' EU-remote listings.
- **Complexity/maintenance:** No API → scrape-only, Medium effort (~5–7 days), Medium maintenance risk (relocation-focused sites tend to gate detail behind lead-capture forms, which would hurt data completeness — unverified without a deeper crawl).
- **Tier: B**, leaning C given the relocation-broker apply model doesn't cleanly fit "direct apply." Worth a cheap manual spot-check of 10–15 listings' actual apply flow before committing engineering time.
- **Recommended shape:** If pursued, generic `Provider` (scrape-based). Not ATS, not CompanyWatch.

## 3. GeekJob.ru

- **Free/paid:** Free to browse. Site claims 100K+ specialist profiles, 267 open positions visible at time of check (small relative to HH/SuperJob).
- **API type:** No documented public API. **robots.txt (verified via WebFetch, 2026-07-30):** `Allow: /`, but explicitly `Disallow: /json/` and `Disallow: /rest/` — **this is a meaningful signal**: those disallowed paths strongly imply an internal `/json/` or `/rest/` API exists (why else name-block exactly those two paths?) but it is explicitly off-limits per robots.txt. Scraping the rendered HTML pages themselves is not disallowed. Sitemap at `/sitemap.xml`.
- **ToS:** Unverified.
- **Page structure (verified via WebFetch, 2026-07-30):** Listing pages show ~20 vacancies/page, 14 pages total (~267 open roles). Only ~4/20 sampled listings showed salary. Tags include `remote`/`office`/`relocate`. No JSON-LD JobPosting markup detected on the listing page (detail pages not individually checked — unverified there). No visible direct "Apply" button on the listing excerpt; site copy states "65% работодателей ищут кандидатов напрямую" (65% of employers search candidates directly) — suggesting GeekJob leans resume-database/inbound-contact rather than outbound apply, similar caution flag as Djinni/Relocate.me.
- **Duplicate risk:** Likely high overlap with Habr Career and SuperJob (same RU IT-generalist segment) — GeekJob is a smaller, second-tier board in this space.
- **Volume/complexity:** LOW-MEDIUM volume (267 vacancies vs. HH's much larger pool), Medium build effort (~4-6 days, HTML scrape since `/json/` is robots-disallowed and shouldn't be used per that signal), Low-Medium maintenance.
- **Tier: C.** Low unique volume, uncertain apply-flow quality, and the one structured-data path (`/json/`) is explicitly robots-disallowed, forcing HTML-scrape-only. Recommend skip unless a specific quality signal (e.g., dev-only postings CareerOS users specifically want) justifies the effort against the volume.
- **Recommended shape (if revisited):** Generic `Provider`, scrape-based, HTML only (respect the `/json/` and `/rest/` disallow).

## 4. robota.ua

- **Free/paid:** Free to browse.
- **API type:** No official public API confirmed. Search results repeatedly point to *third-party* Apify scrapers (multiple vendors: `solidcode/robota-ua-scraper`, `blackfalcondata/robota-ua-scraper`, `heady_impediment/rabota-ua-job-scraper`) — the existence of several independent commercial scrapers is itself a signal that no sanctioned API exists and that the site is a nontrivial scraping target (otherwise one canonical open-source scraper would suffice).
- **robots.txt:** **WebFetch returned HTTP 403 Forbidden** when attempting to fetch `robota.ua/robots.txt` directly (2026-07-30) — the fetcher itself was blocked before even reaching content. That is a concrete, directly-observed anti-automation signal (either aggressive bot-detection/WAF or geo/UA-blocking), independent of anything found via search.
- **ToS:** Unverified, but the 403 on a *robots.txt* request (normally one of the most permissively-served files on any site) suggests real anti-bot posture in front of the whole domain.
- **Direct apply:** Unverified — standard job-board apply-through-platform model per third-party descriptions.
- **Duplicate risk:** Ukraine's largest general job board — high overlap potential with dou.ua and work.ua for tech roles, low overlap with RU-core sources (HH/SuperJob/Habr).
- **Complexity/maintenance:** The 403-on-robots.txt result alone pushes this to High complexity/High maintenance risk — likely needs residential IPs / anti-bot countermeasures, the same class of problem `docs/hh-api-403-investigation.md` and the CIS-ROADMAP already flagged for Avito. Effort estimate if pursued: **10+ days** plus ongoing anti-bot cat-and-mouse.
- **Tier: C.** Recommend skip/defer — this is exactly the "ToS-prohibited/fragile scraping, high maintenance" profile the rubric calls out, now with a concrete blocked-fetch data point rather than just a hunch.
- **Recommended shape:** N/A (not recommended). If revisited later, generic `Provider` with a hardened/rotating fetch layer — same caution as Avito.

## 5. work.ua

- **Free/paid:** Free to browse. ~102K–104K total jobs (all industries, not just tech).
- **API type:** No official public API found. `apix-drive.com` (a generic no-code integration broker) offers a "Work.ua API" integration product, which is itself evidence there's no first-party developer API — third-party iPaaS tools exist precisely to paper over that gap.
- **robots.txt (verified via WebFetch, 2026-07-30):** Blocks `Linguee` bot entirely (`Disallow: /`); explicitly **allows `ClaudeBot`** with `Crawl-delay: 2`. Disallows personal-account paths, auth flows, resume-file downloads/PDF views, AJAX/print endpoints, and a long list of search-filter query-parameter combinations (employment type, salary, experience, education, location, demographic filters) — likely to prevent facet-crawl explosion, not to block basic listing access. Sitemap at `/sitemap_index.xml`.
- **Notable:** The explicit `ClaudeBot` allow-with-crawl-delay rule is a positive, concrete signal — this site has consciously decided to permit AI-crawler access at a throttled rate rather than blanket-block it, which is a meaningfully better legal/technical posture than robota.ua's outright 403.
- **ToS:** Unverified beyond robots.txt.
- **Direct apply:** Unverified — standard platform-apply model expected (candidates apply through work.ua's own flow, which then forwards to employer).
- **Duplicate risk:** High overlap with robota.ua and dou.ua for the Ukraine tech segment; low overlap with RU-core sources.
- **Complexity/maintenance:** No API → HTML scrape required, but the friendlier robots.txt posture (vs. robota.ua) makes this Medium rather than High complexity. Effort estimate **6-8 days**, respecting the `Crawl-delay: 2` and avoiding the disallowed filter-parameter combinations (a full listing crawl without complex filter params should be fine).
- **Tier: B.** Genuinely the most bot-friendly of the three Ukrainian general boards checked, decent general-tech volume, but still no structured feed — build cost is real and general (non-tech-specific) volume dilutes signal.
- **Recommended shape:** Generic `Provider`, scrape-based, tech-category-filtered listing crawl only.

## 6. dou.ua (jobs.dou.ua) — Ukraine's dev-community job board

- **Free/paid:** Free.
- **API type:** **Confirmed RSS 2.0 feed** at `https://jobs.dou.ua/vacancies/feeds/` (verified via WebFetch, 2026-07-30) — this is the strongest structured-access source found among the Ukrainian boards. Per-item fields: title (position + company + location), link, full HTML description (requirements/responsibilities/benefits), `pubDate`, `guid`. Company-specific RSS feeds also exist (e.g. `jobs.dou.ua/companies/{slug}/vacancies/`), and category-filtered browse pages exist (`?category=Front+End`) — **unverified** whether the feed itself accepts the same `?category=` filter param (not tested; the main feed appeared to return an unfiltered stream).
- **robots.txt (verified via WebFetch, 2026-07-30):** Only blocks tracking/AJAX/comment/login endpoints (`/ajax-impressions-track/`, `/j-lost-password/`, `/ajax-login/`, `/comment-*`), plus (Yandex-specific) search-param'd vacancy URLs. **No blocking of the feeds path or general vacancy pages.** No crawl-delay for any agent.
- **ToS:** Unverified, but an openly-published RSS feed with a permissive robots.txt is about as clean a legal signal as this research found for a non-API-key site.
- **Direct apply:** DOU vacancy pages link through to a "respond" flow on DOU itself (developer-community-curated board, companies post directly) — likely a real apply/contact flow rather than a paywall, but exact mechanics unverified without opening an individual vacancy page.
- **Salary:** Rarely disclosed (RU/UA market norm). **Remote:** Present as a filterable tag on the browse UI (not confirmed present in the RSS item fields specifically). **Tech tags:** Category browsing exists (Front End, DevOps, etc.) suggesting structured categorization exists site-side even if not fully exposed in the base feed.
- **Update frequency:** DOU is one of the most active Ukrainian developer communities (comparable in spirit to Habr for Russia) — expect daily-plus posting volume; exact rate unverified.
- **Duplicate risk:** Some overlap with robota.ua/work.ua for Ukraine-based roles, but DOU is dev-specific (like Habr Career) so signal-to-noise should be much better than the two general boards above. Low overlap with RU-core sources.
- **Complexity/maintenance:** **Low** — RSS parsing is a pattern CareerOS already has precedent for (`rss_feed` is a first-class `VacancySource` already in `source-priority.ts`). Effort estimate **2-4 days** for fetcher+mapper+normalizer following the existing RSS pattern, well below the scrape-only Ukrainian boards.
- **Tier: A.** Best find of the Ukraine-focused research: dev-specific, free, RSS (not scrape), clean robots.txt, low build cost, meaningfully different company set than HH/SuperJob/Habr Career (Ukraine-domiciled and Ukraine-hiring companies + Ukraine-based remote-first teams).
- **Recommended shape:** Generic `Provider` using the RSS ingestion pattern (`rss_feed`-style), same shape as We Work Remotely's existing RSS provider.

## 7. HH regional coverage — what `HH_AREAS` is missing vs. what api.hh.ru actually supports

Current `.env.example` / `packages/shared/src/config.ts` default: `HH_AREAS=113,16,40,97,48,9` (Russia, Belarus, Kazakhstan, Uzbekistan, Kyrgyzstan, Azerbaijan — per the code comment). This is **already wider than the CIS-ROADMAP snapshot** (which flagged only RU as configured) — looks like the Phase 0 config-only recommendation from that earlier audit was already actioned at some point between 2026-07-23 and now.

- **Verified area IDs (WebFetch of `https://api.hh.ru/areas/countries`, 2026-07-30):**
  | Country | Area ID | In current `HH_AREAS`? |
  |---|---|---|
  | Russia | 113 | Yes |
  | Belarus | 16 | Yes |
  | Kazakhstan | 40 | Yes |
  | Uzbekistan | 97 | Yes |
  | Kyrgyzstan | 48 | Yes |
  | Azerbaijan | 9 | Yes |
  | **Georgia** | **28** | **No — missing** |
  | **Armenia** | **13** | **No — missing** |
  | **Tajikistan** | **86** | **No — missing** |
  | **Moldova** | **62** | **No — missing** |
  | Ukraine | 5 | No — see caveat below |

- **Ukraine caveat (unverified, flagged not fixed):** api.hh.ru's taxonomy still lists a Ukraine area ID (5), but hh.ua/HeadHunter's Ukraine operation was sold/rebranded away from the Russian HeadHunter Group years before the 2022 war (per search results: ownership change/rebrand to "GRC" reported in 2019 press coverage) and Ukraine has broadly restricted Russian-platform access since 2022. Whether querying `area=5` against `api.hh.ru` today returns live Ukrainian listings, empty results, or an error is **unverified** — this needs a live API call to confirm before adding it, and given CareerOS already covers Ukraine via other means being researched here (dou.ua, work.ua, robota.ua), it's lower priority regardless.
- **hh.kz / hh.uz as separate domains:** These resolve as regional front-ends but per prior research (`CIS-ROADMAP.md` §1) hh.kz uses "the same HH API" — i.e., not a separate integration, just the `area=40` filter on `api.hh.ru`. Not independently re-verified this session; treating prior finding as still current since api.hh.ru's own area taxonomy is the source of truth and confirms Kazakhstan (40) and Uzbekistan (97) are both queryable through the one existing `hh` provider already.
- **Recommendation:** Cheapest possible win in this whole report — **widen `HH_AREAS` to add `28` (Georgia), `13` (Armenia), `86` (Tajikistan), `62` (Moldova)**, a config-only change (no new code), pending confirmation these areas return real results (a quick live API smoke-test, not a build task). Do **not** add Ukraine (`5`) without first confirming live data — treat as a separate, riskier follow-up.
- **Tier: A** (config change, not a new source, but highest ROI/effort ratio in this entire report by a wide margin — effort is a single env var edit plus verification, not engineering days).

## 8. Habr Freelance (freelance.habr.com)

- Already substantially covered by prior research (`CIS-ROADMAP.md` Tier 2, `REPORT.md` #17) as a scrape target, no API, 3K+ freelance postings, low build effort. Not re-verified this session (no new WebFetch performed) since the task brief's own context note says the existing Habr Career research shouldn't be redone. One addition: this is a **freelance/gig marketplace**, not FTE listings — same product-model caveat the CIS-ROADMAP already raised for FL.ru/Kwork (`ADR-030` currently canonicalizes around FTE roles). No change to prior verdict.
- **Tier: B** (per prior research), gated on the same freelance-vs-FTE product decision as FL.ru/Kwork.

## 9. Huntflow — RU ATS platform (checked as a potential new *ATS adapter*, per task's high-value hypothesis)

- **What it is:** A recruiting CRM/ATS used by many RU companies to manage their own hiring pipeline and to power their own careers-page "apply" widget (`huntflow-js-widget` on GitHub confirms an embeddable per-company widget exists).
- **API type (verified via WebSearch + WebFetch of `huntflow.ru/api` and the public `huntflow/api` GitHub docs, 2026-07-30):** Fully documented REST API — but **it is per-tenant and Bearer-token authenticated**. Every method operates against *one company's own Huntflow account* using that company's own token (obtained via that company's own Huntflow settings panel). There is **no cross-company, public, unauthenticated job-board search endpoint** — i.e., no "list all vacancies across all companies using Huntflow" API the way Greenhouse/Lever expose a public per-token *board* endpoint that CareerOS can already read without being that company.
- **Critical difference vs. Greenhouse/Lever/Ashby (the pattern CareerOS's existing ATS adapters rely on):** Greenhouse/Lever expose a *public, unauthenticated, per-company job-board endpoint* (e.g. `boards-api.greenhouse.io/v1/boards/{token}/jobs`) that any outside consumer can hit once they know the company's token — no relationship with the company needed. Huntflow's API is the opposite shape: it requires the *company itself* to issue you a private Bearer token, meaning CareerOS would need an individual arrangement with **each Huntflow-using employer** to pull their vacancies via this API — that is not a scalable "one adapter unlocks many companies" integration, it is one bespoke integration per employer, which is a fundamentally different (and much higher marginal-cost) shape than the Greenhouse/Lever adapter pattern.
- **Does a Huntflow-powered career page expose public JobPosting JSON-LD instead?** Unverified in general — depends per-company on whether they used Huntflow's hosted career-page product or their own frontend consuming the widget. This is exactly the kind of case the existing generic `CustomHtmlAdapter`/`JsonLdAdapter` infra is built for — worth spot-checking specific companies' career pages for JobPosting JSON-LD rather than building a Huntflow-specific adapter.
- **Tier: C for a dedicated "Huntflow ATS adapter."** The task's hypothesis (RU ATS unlocking many companies at once, like Greenhouse) does **not** hold up — Huntflow's API model is fundamentally per-tenant/authenticated, not a public discoverable board API. Recommend **not** building a Huntflow-specific adapter.
- **Recommended shape:** None as a dedicated adapter. Where a specific high-value RU company uses Huntflow, evaluate that company's actual public career page individually via the existing generic `JsonLdAdapter`/`CustomHtmlAdapter` (CompanyWatch), same as any other company — Huntflow-as-backend is irrelevant to whether the frontend emits JobPosting markup.

## 10. Talantix — RU ATS platform (hh.ru's own recruiting CRM product)

- **What it is:** hh.ru Group's own recruiting CRM/ATS product (per Wikipedia RU and hh.ru's own articles), got a "public API 3.0" in Feb 2024 per search results.
- **API type (verified via WebFetch of `api.talantix.ru/docs/`, 2026-07-30):** **GraphQL API, authenticated-only.** The docs describe authorization flows and guides for "работа с API" (working with the API) aimed at integrating a company's *own* career landing pages, referral pages, and chatbot flows with *their own* Talantix CRM instance. No indication of a public, cross-company vacancy-search surface — same per-tenant shape as Huntflow, and for the same reason (it's a CRM product sold to individual employers, not a job board).
- **Tier: C**, same reasoning as Huntflow — per-tenant authenticated API, not a discoverable public job-board API. Given Talantix is hh.ru Group's own product, there's also a strong duplicate-risk argument: any vacancy visible through a company's Talantix-powered career page is highly likely to *also* already be posted on hh.ru itself (hh.ru is Talantix's own parent distribution channel), making a hypothetical Talantix integration low marginal value even if the API shape were public.
- **Recommended shape:** None. Skip.

## 11. Potok.io

- **What it is:** RU HR-automation/ATS platform (per `en.wikipedia.org/wiki/Potok_(company)` and its own site) — same category as Huntflow/Talantix, and the entity RU Telegram job channels are reported (in the task brief's own framing) to repost from.
- **API type (verified via WebSearch of Potok's own help-center docs, 2026-07-30):** Potok's API is described as enabling *a company's own career website* to publish vacancies and collect responses into that company's Potok account — same per-tenant CRM-integration shape as Huntflow/Talantix. Notably, Potok's help docs explicitly describe **paid** integration for auto-collecting HH/SuperJob responses ("Automatic collection of responses from HeadHunter works only with a paid API integration") — reinforcing this is a recruiter-facing product, not a public feed.
- **No RSS, no public job-board search API found.**
- **Tier: C.** Same verdict class as Huntflow/Talantix — per-tenant ATS, not a public aggregatable source. The "Telegram channels repost from Potok" detail in the task brief likely just means individual companies' Potok-hosted career pages are the *origin* of postings that then get manually/semi-automatically reposted into Telegram channels by those companies or recruiters — CareerOS already captures that content via the Telegram provider once it's reposted, so there's no incremental value in chasing Potok itself.
- **Recommended shape:** None. Skip. (If a specific company's Potok-hosted career page emits JobPosting JSON-LD, that's a CompanyWatch case, unrelated to Potok as a platform.)

## 12. Careerist.ru / "Talentum"

- **Careerist.ru:** Confirmed to exist as a Moscow-based general job board ("150,000+ direct employers," IT section at `careerist.ru/jobs-it-spetsialist/`). This re-confirms, rather than overturns, the prior research's dead-end verdict (`CIS-ROADMAP.md` listed "Careerist.com" — note the `.com` vs `.ru` — as a dead end, described as a "content platform, not job board"; the `.ru` site found this session is in fact a real job board, so the prior dead-end note may have been checking a different/wrong domain). No API found, no RSS found, no robots.txt checked this session (time-boxed). **Unverified** on ToS/scraping-friendliness/volume/direct-apply.
- **"Talentum":** No distinct CIS-specific platform by this name was found in search results — the query returned nothing matching a "Talentum" job board. **Likely a naming red herring or too-generic a term to disambiguate via search; unverified/not found.**
- **Tier: C** for Careerist.ru pending a real robots.txt + apply-flow check (flagging the domain confusion with prior research as worth a developer's own quick look, since the earlier dead-end verdict may have been checking the wrong TLD). Talentum: no finding, nothing to tier.
- **Recommended shape:** Not recommended without further verification.

## 13. RU tech-media job boards: vc.ru and Tproger

- **vc.ru:** Has recurring "вакансии" (vacancies) editorial content and tag pages, but this reads as **content/curation** (roundup articles, "where to post IT vacancies" guides) rather than a structured job board with its own listings API — consistent with the prior research's "content platform, not job board" dead-end characterization for this class of site. No API/RSS found. **Tier: C — skip**, same as prior research's verdict on this class of source.
- **Tproger:** Does run an actual jobs section at `tproger.ru/jobs` (and `jobs.tproger.ru`) distinct from its content/community arm — this is a genuine job-board product, not just curation, contradicting a naive read of it as "just a media outlet." However: **no public API or RSS documentation was found** for it, and Tproger's own community-channel description (found via search) states vacancies are posted "periodically for a fee," implying employer-paid listings — which doesn't preclude scraping the public listing pages, but does suggest the volume may be lower/more curated (paid gate on the supply side) rather than a firehose. Unverified: actual listing count, robots.txt, apply-flow.
- **Tier: C** for both, pending — Tproger specifically is worth a cheap 30-minute manual check (robots.txt + listing count) before fully writing it off, since it's a real distinct job board, not just editorial content like vc.ru.
- **Recommended shape:** Not recommended without further verification; if Tproger checks out, generic `Provider`.

## 14. Large RU tech employers — ATS/markup spot-check (per task's framing: is this a JsonLdAdapter case, a known-ATS case, or neither?)

Spot-checked via WebFetch/WebSearch on 2026-07-30 (not exhaustive — time-boxed to the companies the task named):

| Company | Career page | Finding |
|---|---|---|
| **JetBrains** | jobs.jetbrains.com / job-boards.eu.greenhouse.io/jetbrains | **Confirmed on Greenhouse** — already a supported ATS adapter. No new work needed; just add JetBrains as a configured Greenhouse board token if not already present. |
| **Yandex** | yandex.com/jobs/vacancies | No JobPosting JSON-LD detected; no recognizable third-party ATS signature (script domains are Yandex's own `yastatic.net`/`avatars.mds.yandex.net`). Reads as a **custom in-house careers platform**. Not a JsonLdAdapter candidate as-is; would need a bespoke `CustomHtmlAdapter` mapping if pursued (CompanyWatch case). |
| **Sber** (rabota.sber.ru) | rabota.sber.ru/search/ | Page fetched was a navigation shell, not a listing page — **inconclusive**, no ATS signature or JSON-LD found in what was fetched, but the actual listing content wasn't reached (likely client-side rendered/JS-driven search). Needs a deeper check (e.g. fetch the actual results page with query params) before concluding either way. |
| **Ozon** | ozon.tech/job/vacancy_1 | **WebFetch failed — "too many redirects"** (>10). Notable failure mode in its own right: suggests a JS-app/redirect-heavy frontend, which typically means no static JobPosting JSON-LD reachable by a simple fetcher either. Unverified beyond that. |
| **Kaspersky** | careers.kaspersky.com/vacancies | No ATS signature or JSON-LD found in what was fetched; page reads as custom-built. Inconclusive without deeper (rendered) inspection. |
| **VK** | attempted `vk.company/ru/careers/` | **404** — wrong URL guessed; VK's actual careers domain wasn't found this session. Unverified. |
| **Avito, Wildberries, Tinkoff/T-Bank** | — | Not independently fetched this session (time-boxed); WebSearch returned no clear ATS/platform signal for any of the three. Unverified. |

- **Takeaway for this section:** None of the large RU employers checked showed a clean, ready-to-ingest JobPosting JSON-LD signal or a recognized international ATS (JetBrains being the sole exception, and it's already covered). This mostly confirms the task brief's own framing — big RU tech employers mostly run custom in-house careers platforms, not Greenhouse/Lever/Workday and not schema.org-markup-emitting pages. Unlocking them would require individual `CustomHtmlAdapter` mappings per company (CompanyWatch, not a shared adapter), and even that needs deeper per-company inspection (rendered DOM, not just raw HTML fetch) than this pass had budget for.
- **Recommendation:** Treat as a **CompanyWatch backlog**, not a new Provider/ATS-adapter project. Highest-value next step (out of scope for this report) would be a rendered-browser check (not a plain HTTP fetch) of Yandex/Sber/Ozon/Avito/Wildberries/Tinkoff career pages specifically for JSON-LD, since several of these (Ozon's redirect loop, Sber's JS shell) look like SPA frontends that a plain-HTTP WebFetch cannot see through.

## 15. `wellfound` / `otta` (noted per instructions, not deep-researched)

Both already have reserved `VacancySource`/priority slots in `source-priority.ts` (both at priority 70, `JOB_BOARD` type) but no implementation. Per task scope, flagging their existence only — this is explicitly someone else's research lane.

---

## Top picks — ranked by expected unique-vacancy yield × RU/CIS-developer value, adjusted for effort

1. **Widen `HH_AREAS`** to add Georgia (28), Armenia (13), Tajikistan (86), Moldova (62) — not a new source, but the single highest ROI action in this report: a config edit against an already-live, already-trusted, highest-priority source, pending a live-data smoke test.
2. **dou.ua RSS feed** — the standout genuinely-new source: official-shaped RSS (not scrape-only), clean robots.txt, dev-specific (low noise), meaningfully different company set (Ukraine-based/hiring companies) than anything CareerOS has today. Tier A, ~2-4 days.
3. **Djinni.co** — largest genuinely-new unique-volume opportunity (major UA/CIS dev-specific board), permissive robots.txt on the listing path, but no API (scrape-only, Tier B) and an apply-flow model that needs a product-team look before committing engineering time.
4. **work.ua** — bot-friendly (explicit `ClaudeBot` allow + crawl-delay, unlike robota.ua's outright block), large general Ukraine market; Tier B, worth it mainly for Ukraine-tech-category volume, dilute-check needed against dou.ua/robota.ua overlap.
5. **JetBrains via existing Greenhouse adapter** — zero new engineering, just a config/board-token addition; not a "new source" but the cheapest concrete win among the individual-employer checks.

**Explicitly not recommended (Tier C, skip/defer):** robota.ua (directly observed 403 on `robots.txt` fetch — real anti-bot posture, same risk class as Avito), GeekJob.ru (low unique volume, `/json/` API explicitly robots-blocked, dubious apply-flow), Huntflow/Talantix/Potok.io as dedicated ATS adapters (all three are per-tenant authenticated CRM APIs, not public discoverable job-board APIs — the task's "unlocks many companies at once" hypothesis does not hold for any of them), vc.ru (content platform, not a job board), Careerist.ru and Tproger (real boards but no verified API/RSS/robots-friendliness this session — worth a cheap follow-up check, not a build commitment yet), Relocate.me (relocation-broker apply flow, not clean direct-apply).
