# Job Sources for Russian-Speaking Software Engineers

> Generated 2026-07-21 · depth: deep · 8 research angles · ~80 sources investigated · workspace: research/job-sources-russian-sw/

> **2026-07-23 audit note (documentation-consistency pass):** As of two days
> after this report, three sources it lists as unbuilt are now implemented
> in `packages/providers/src/providers/`: **Habr Career** (#14 below),
> **SuperJob** (#12 below), and a **Telegram channel-scraping provider**
> (#11, "Telegram Inflow Network" — status line below still reads "NOT YET
> IMPLEMENTED"; not confirmed whether the shipped provider covers the exact
> channel list this report names, but the scraping capability is built).
> See `research/job-sources-russian-sw/CIS-ROADMAP.md`'s audit note for
> more detail. Rest of this report left as-written as a historical
> snapshot.

## Executive Summary

Across 8 research angles covering 80+ sources, we identified **35+ technically viable job sources** for Russian-speaking software engineers. The research found:

- **11 sources with official, free APIs** ready for immediate integration
- **14 sources requiring moderate effort** (scraping, partner API, or internal API reverse-engineering)
- **10+ additional niche sources** for later phases
- **12+ dead ends** (shut down, no API, paywalled, or defunct)

**Critical discoveries:**
1. **HeadHunter (hh.ru)** is the single most valuable source — full REST API, multi-country coverage (RU, KZ, BY, GE), anonymous access
2. **Telegram Inflow Network** operates 10+ coordinated Russian IT job channels with 49K+ subscribers, accessible via public t.me/s/ pages
3. **Alma Career partner API** could unlock 60K+ jobs across Czech Republic, Slovakia, Lithuania, Latvia, Estonia with one integration
4. **Polish boards** (JustJoin.it, NoFluffJobs) have internal JSON APIs and explicit Russian language filters

## Background & Scope

CareerOS is an AI-powered career platform. The AI platform implementation (EPIC-LinkedIn) is complete with 17 providers. The objective is to maximize relevant vacancies for Russian-speaking software engineers across: Russian-speaking companies, CIS companies, international companies hiring Russian speakers, and remote-first companies with Russian-speaking teams.

Countries investigated: Belarus, Kazakhstan, Georgia, Armenia, Serbia, Cyprus, UAE, Poland, Germany, Portugal, Spain, Netherlands, Czech Republic, Lithuania, Latvia, Estonia, Israel, Worldwide Remote.

---

## Tier S — Must Implement Immediately

Sources with official APIs, high volume, and strong relevance. Low integration complexity.

### 1. HeadHunter (hh.ru)
- **URL**: https://hh.ru | **API**: https://api.hh.ru/openapi/redoc
- **API**: REST, OpenAPI spec, OAuth 2.0 + anonymous access for vacancy search
- **Volume**: HIGH — largest Russian job board
- **Countries**: Russia, Kazakhstan, Belarus, Georgia, Uzbekistan, Azerbaijan, Kyrgyzstan (all via same API)
- **Data**: salary, technologies, experience level, remote info, company info, recruiter info, pagination, search, incremental sync (webhooks)
- **Rate Limits**: 200 req/10min (anonymous), higher with token
- **Maintenance**: LOW
- **CIS Relevance**: ★★★★★ — primary source for Russian-speaking developers
- **Already implemented**: YES (in SDK)

### 2. RemoteOK
- **URL**: https://remoteok.com | **API**: https://remoteok.com/api
- **API**: Free JSON, no auth, real-time data
- **Volume**: 500-1000 active software jobs
- **Data**: salary, tags, company, location, apply link, incremental sync by epoch
- **Rate Limits**: Undocumented, be respectful
- **Maintenance**: VERY LOW
- **CIS Relevance**: ★★★ — worldwide remote, some CIS jobs appear
- **Already implemented**: YES

### 3. Himalayas
- **URL**: https://himalayas.app | **API**: /jobs/api + /jobs/api/search + OpenAPI spec
- **API**: Free JSON, no auth, pagination, search by keyword/seniority/country
- **Volume**: 2000-5000+ active remote jobs
- **Data**: salary (min/max/currency/period), seniority, employment type, timezone restrictions, company info
- **Rate Limits**: 20 jobs per request, 429 errors on excess
- **Maintenance**: LOW
- **CIS Relevance**: ★★★ — country filter supports all
- **Already implemented**: YES

### 4. Remotive
- **URL**: https://remotive.com | **API**: /api/remote-jobs
- **API**: Free JSON + RSS, no auth, 24h delay on public feed
- **Volume**: 1000-2000 active remote jobs
- **Data**: salary, category, company, candidate_required_location
- **Rate Limits**: 2x/min, recommend 4x/day
- **Maintenance**: VERY LOW
- **CIS Relevance**: ★★★ — worldwide
- **Already implemented**: YES

### 5. We Work Remotely
- **URL**: https://weworkremotely.com | **RSS**: category-based feeds
- **API**: RSS/XML (no REST API)
- **Volume**: 200-400 active software jobs
- **Data**: region, country, skills, category, pubDate
- **Rate Limits**: Not documented for RSS
- **Maintenance**: LOW
- **CIS Relevance**: ★★★ — some jobs list Ukraine, Belarus, Armenia
- **Already implemented**: YES

### 6. Startup.jobs
- **URL**: https://startup.jobs | **API**: Full REST + RSS + MCP server
- **API**: Free API key, OpenAPI spec, cursor-based pagination, search by q/role/country/workplace_type
- **Volume**: Thousands of startup jobs
- **Data**: structured salary_data, role tags, company object, posted_after for incremental sync
- **Rate Limits**: 20 req/min free, 300 with full access
- **Maintenance**: LOW
- **CIS Relevance**: ★★★ — some YC/startup companies hire remotely including CIS
- **Status**: NOT YET IMPLEMENTED

### 7. Hacker News Who's Hiring
- **URL**: news.ycombinator.com | **API**: Firebase + Algolia
- **API**: Official, no auth, no rate limits
- **Volume**: 100-200 jobs per monthly thread
- **Data**: In HTML text (requires parsing), some salary/company/location info
- **Rate Limits**: None
- **Maintenance**: LOW-MEDIUM (text parsing needed)
- **CIS Relevance**: ★★★ — some CIS companies post monthly
- **Status**: NOT YET IMPLEMENTED

### 8. Jooble
- **URL**: https://jooble.org | **API**: Free API key
- **API**: REST JSON, keyword/location/salary/date search
- **Volume**: ~8M+ aggregated from multiple sources
- **Data**: salary (sometimes), technologies (free text), remote info
- **Rate Limits**: Undocumented
- **Maintenance**: LOW
- **CIS Relevance**: ★★★★ — Ukrainian roots, good CIS coverage
- **Status**: NOT YET IMPLEMENTED

### 9. Greenhouse
- **URL**: https://boards-api.greenhouse.io/v1/boards/{token}/jobs
- **API**: Completely public, no auth for reads
- **Volume**: ~30K+ companies, 150K-200K+ vacancies
- **Data**: title, location, content (HTML), departments, offices, metadata
- **Rate Limits**: 1-2 req/sec per host (community consensus)
- **Maintenance**: VERY LOW
- **CIS Relevance**: ★★ — some international companies with CIS presence
- **Status**: NOT YET IMPLEMENTED

### 10. Lever
- **URL**: https://api.lever.co/v0/postings/{slug}?mode=json
- **API**: Completely public, no auth for reads
- **Volume**: ~5K+ companies, 30K-50K+ vacancies
- **Data**: title, location, team, department, description, workplaceType, salaryRange
- **Rate Limits**: 1 req/sec safe
- **Maintenance**: VERY LOW
- **CIS Relevance**: ★★ — some European companies with CIS connections
- **Status**: NOT YET IMPLEMENTED

### 11. Telegram Inflow Network (t.me/s/ scraping)
- **URL**: https://t.me/s/remoteIT (+ 10 sub-channels)
- **API**: Public preview pages, no auth, pagination via ?before={message_id}
- **Volume**: 20-30 IT jobs daily across all channels, 49K+ subscribers on main
- **Data**: ROLE | LOCATION | COMPANY [#tags], links to teletype.in for full descriptions
- **Rate Limits**: 1 req/sec recommended
- **Maintenance**: LOW
- **CIS Relevance**: ★★★★★ — primary Russian IT job aggregation on Telegram
- **Status**: NOT YET IMPLEMENTED

---

## Tier A — Highly Valuable

Sources requiring moderate integration effort (scraping, partner API, or internal API).

### CIS-Specific (High Priority)

| # | Source | API | Volume | CIS | Effort | Notes |
|---|--------|-----|--------|-----|--------|-------|
| 12 | **SuperJob** (superjob.ru) | REST API (free key) | HIGH | ★★★★★ | Low | Major Russian board, good API |
| 13 | **FL.ru** | None (scraping) | 1500+ orders/day | ★★★★★ | Low | Largest Russian freelance platform, easy scraping |
| 14 | **Habr Career** (career.habr.com) | None (scraping) | HIGH | ★★★★★ | Medium | High-quality developer vacancies, headless browser needed |
| 15 | **Djinni** (djinni.co) | None (scraping) | MEDIUM | ★★★★★ | Medium | CIS developer job board, reverse-engineering repos exist |
| 16 | **Kwork** (kwork.ru) | None (scraping) | 5K+ | ★★★★★ | Low | Fixed-price Russian marketplace |
| 17 | **Habr Freelance** (freelance.habr.com) | None (scraping) | 3K+ | ★★★★★ | Low | High-quality tech community jobs |
| 18 | **Trudvsem.ru** | Open Data API (XML) | MEDIUM | ★★★★ | Low | Government portal, open data |

### Regional European (Medium-High Priority)

| # | Source | API | Volume | CIS | Effort | Notes |
|---|--------|-----|--------|-----|--------|-------|
| 19 | **JustJoin.it** (Poland) | Internal JSON | ~20,000 | ★★★★ | Medium | Tech-only, Russian language filter available |
| 20 | **Pracuj.pl** (Poland) | Internal JSON | ~19,000 | ★★★★ | Medium | Largest Polish board, excellent salary data |
| 21 | **NoFluffJobs** (Poland) | Internal JSON | ~5,000 | ★★★ | Medium | Mandatory salary transparency |
| 22 | **Alma Career Network** | Partner API (OAuth2) | 60K+ across 5 countries | ★★★ | Medium-High | Jobs.cz, Prace.cz, CV-Online (LT/LV/EE), Profesia.sk |
| 23 | **Poslovi Infostud** (Serbia) | RSS | 13,385+ | ★★★★ | Low | Strong Russia ties, RSS available |
| 24 | **AllJobs** (Israel) | None (scraping) | 35,403 | ★★★★ | Medium | ~1M Russian-speaking immigrants, Hebrew RTL |
| 25 | **HR.ge** (Georgia) | None (scraping) | 3,653 | ★★★★ | Low | Significant Russian-speaking population |

### International (Medium Priority)

| # | Source | API | Volume | CIS | Effort | Notes |
|---|--------|-----|--------|-----|--------|-------|
| 26 | **Talent.com** | Partner API | ~30M+ | ★★★ | Medium | Largest aggregator, excellent salary data |
| 27 | **Arbeitnow** | Free JSON API | ~6.6K | ★★ | Very Low | Germany/DACH, zero auth, excellent data |
| 28 | **Reed.co.uk** | Free API key | ~200K | ★★ | Low | UK market, 10 req/s |
| 29 | **CV-Library** | Free API key | ~150K | ★★ | Low | UK market |
| 30 | **Working Nomads** | Free JSON API | 30K+ curated | ★★ | Low | Remote job aggregator |
| 31 | **Web3.career** | Free API | 40,073 | ★★ | Very Low | Blockchain/Web3 jobs |
| 32 | **Dev.to** | Public API | 10-20/day | ★ | Very Low | Developer community jobs |
| 33 | **VanHack** | None (scraping) | 500K+ candidates | ★★★★ | Medium-High | Built for CIS/international dev relocation |
| 34 | **Relocate.me** | None (scraping) | 5K-10K | ★★★★ | Medium-High | Built by Ukrainians, 300K dev community |

---

## Tier B — Implement Later

Niche, smaller scale, higher effort, or lower CIS relevance.

| # | Source | API | Volume | CIS | Effort | Notes |
|---|--------|-----|--------|-----|--------|-------|
| 35 | **Freelancer.com** | Official REST API | 50K+ | ★★ | Low | Good API but low CIS focus |
| 36 | **Upwork** | Official OAuth API | 100K+ | ★ | Medium | Requires app approval |
| 37 | **BambooHR** | Public JSON | 10K-20K | ★ | Low | US SMBs |
| 38 | **SmartRecruiters** | Public JSON | 40K-60K | ★★ | Low | Enterprise ATS |
| 39 | **Recruitee** | Public JSON | 15K-25K | ★ | Low | European ATS |
| 40 | **CVBankas.lt** | None (scraping) | 8,574 | ★★★ | Medium | Lithuanian market leader |
| 41 | **Tecnoempleo** (Spain) | Internal JSON | ~2,500 | ★ | Medium | Tech-focused Spanish board |
| 42 | **Landing.jobs** (Portugal) | None (scraping) | ~2,000 | ★★ | Medium-High | Tech-focused, international |
| 43 | **CryptoJobsList** | RSS | ~5K-10K | ★★ | Low | Crypto/Web3 jobs |
| 44 | **HelloWorld.rs** (Serbia) | None (scraping) | ~500 | ★★★ | Low | Serbian tech community |
| 45 | **Personio** (DACH) | XML feed | 20K-30K | ★ | Medium | DACH region, XML only |
| 46 | **Workday** | Partial (POST) | 100K-200K | ★★ | High | Enterprise, URL discovery needed |
| 47 | **Breezy HR** | Public JSON | 5K-10K | ★ | Low | SMB-focused |
| 48 | **Reddit** (r/forhire) | Free API | LOW | ★ | Low | Low CIS relevance |
| 49 | **Teamtailor** | API key | 15K-25K | ★ | Medium | European, Nordics/DACH |

---

## Dead Ends

| Source | Status | Reason |
|--------|--------|--------|
| LinkedIn Jobs | No consumption API | Only posting API for ATS partners; scraping illegal |
| Indeed | API discontinued (2024) | Aggressive anti-bot; no public access |
| Glassdoor | Not a job board | Review/salary platform, no job API |
| StackOverflow Jobs | Shut down 2022 | No longer exists |
| GitHub Jobs | Shut down 2021 | No longer exists |
| Toptal | Private network | Invite-only, no public listings |
| Turing | AI matching | No job board, matching platform |
| Arc.dev | Talent marketplace | Supply-side, no job board |
| Braintrust | Blockchain network | Enterprise, no public API |
| Lemon.io | Invite-only | Closed marketplace |
| FlexJobs | Paywall | $24.95/mo subscription |
| Hired.com | Defunct | Redirects to LHH |
| Crunchbase Jobs | Does not exist | 403 error |
| Product Hunt Jobs | Does not exist | 404 error |
| Joblist.am (Armenia) | DNS failed | Possibly defunct |
| Teamly.am (Armenia) | DNS failed | Possibly defunct |

---

## Company Watch — New Source Type

User requested a separate source type called "Company Watch" — distinct from job board scrapers. This would track specific companies' career pages for new openings, using:

- ATS JSON APIs (Greenhouse, Lever, Ashby) for companies known to use these platforms
- JSON-LD structured data extraction from career pages
- RSS feeds where available
- Periodic scraping of career page HTML

**Implementation approach**: Maintain a registry of company career page URLs and their ATS type. Periodically poll each company's career endpoint for new listings. This is complementary to job board aggregation — it catches listings that aggregators miss.

---

## Comparison Table: Top 15 Integration Targets

| Source | API Type | Auth | Volume | CIS | Salary | Tech | Remote | Maintenance | Priority |
|--------|----------|------|--------|-----|--------|------|--------|-------------|----------|
| HeadHunter | REST | OAuth/Anon | HIGH | ★★★★★ | Yes | Yes | Yes | Low | S (done) |
| RemoteOK | REST JSON | None | 500-1K | ★★★ | Yes | Tags | Yes | Very Low | S (done) |
| Himalayas | REST JSON | None | 2-5K | ★★★ | Yes | Yes | Yes | Low | S (done) |
| Remotive | REST JSON | None | 1-2K | ★★★ | Yes | Category | Yes | Very Low | S (done) |
| We Work Remotely | RSS | None | 200-400 | ★★★ | No | Skills | Yes | Low | S (done) |
| Startup.jobs | REST+RSS | API Key | Thousands | ★★★ | Yes | Tags | Yes | Low | S |
| HN Who's Hiring | Firebase | None | 100-200/mo | ★★★ | In text | In text | In text | Low-Med | S |
| Jooble | REST | API Key | 8M+ | ★★★★ | Sometimes | Free text | Yes | Low | S |
| Greenhouse | REST | None | 150K-200K | ★★ | No | Deps | Yes | Very Low | S |
| Lever | REST | None | 30K-50K | ★★ | Range | Team | Yes | Very Low | S |
| Telegram Inflow | t.me/s/ | None | 20-30/day | ★★★★★ | In text | Tags | Yes | Low | S |
| SuperJob | REST | API Key | HIGH | ★★★★★ | Yes | Yes | Yes | Low | A |
| FL.ru | Scraping | None | 1500+/day | ★★★★★ | Yes | Yes | Yes | Low | A |
| JustJoin.it | Internal JSON | None | ~20K | ★★★★ | Yes | Excellent | Yes | Medium | A |
| Pracuj.pl | Internal JSON | None | ~19K | ★★★★ | Yes | Strong | Yes | Medium | A |

---

## Open Questions

1. **Alma Career partner API access**: What are the terms and costs for integrating with the Alma Career network (Jobs.cz, Prace.cz, CV-Online Baltics)?
2. **HeadHunter API completeness**: Does the anonymous API return all fields needed, or is OAuth required for full data?
3. **Telegram scraping stability**: How often does t.me/s/ page structure change? Long-term maintenance cost?
4. **Company Watch scope**: Which companies should be in the initial registry? How frequently should career pages be polled?
5. **Polish board internal APIs**: Are the internal JSON endpoints stable, or do they change with frontend updates?

---

## Sources

[1] HeadHunter API — https://api.hh.ru/openapi/redoc (accessed 2026-07-21)
[2] RemoteOK API — https://remoteok.com/api (accessed 2026-07-21)
[3] Himalayas API — https://himalayas.app/jobs/api (accessed 2026-07-21)
[4] Remotive API — https://remotive.com/api/remote-jobs (accessed 2026-07-21)
[5] We Work Remotely RSS — https://weworkremotely.com/categories/remote-back-end-programming-jobs.rss (accessed 2026-07-21)
[6] Startup.jobs API — https://startup.jobs (accessed 2026-07-21)
[7] Hacker News Firebase API — https://hacker-news.firebaseio.com (accessed 2026-07-21)
[8] Jooble API — https://jooble.org/api/ (accessed 2026-07-21)
[9] Greenhouse Boards API — https://boards-api.greenhouse.io (accessed 2026-07-21)
[10] Lever API — https://api.lever.co (accessed 2026-07-21)
[11] Telegram Inflow Network — https://t.me/s/remoteIT (accessed 2026-07-21)
[12] SuperJob API — https://api.superjob.ru (accessed 2026-07-21)
[13] FL.ru — https://fl.ru (accessed 2026-07-21)
[14] JustJoin.it — https://justjoin.it (accessed 2026-07-21)
[15] Pracuj.pl — https://pracuj.pl (accessed 2026-07-21)
[16] NoFluffJobs — https://nofluffjobs.com (accessed 2026-07-21)
[17] Jooble — https://jooble.org (accessed 2026-07-21)
[18] Talent.com — https://talent.com (accessed 2026-07-21)
[19] Arbeitnow API — https://arbeitnow.com/api/job-board-api (accessed 2026-07-21)
[20] Reed.co.uk API — https://reed.co.uk/developers/jobseeker (accessed 2026-07-21)
[21] CV-Library API — https://cv-library.co.uk (accessed 2026-07-21)
[22] Working Nomads API — https://workingnomads.com/api/exposed_jobs/ (accessed 2026-07-21)
[23] Web3.career API — https://web3.career (accessed 2026-07-21)
[24] Dev.to API — https://dev.to/api (accessed 2026-07-21)
[25] VanHack — https://vanhack.com (accessed 2026-07-21)
[26] Relocate.me — https://relocate.me (accessed 2026-07-21)
[27] Habr Career — https://career.habr.com (accessed 2026-07-21)
[28] Djinni — https://djinni.co (accessed 2026-07-21)
[29] Trudvsem.ru Open Data — https://opendata.trudvsem.ru (accessed 2026-07-21)
[30] Poslovi Infostud — https://poslovi.infostud.com (accessed 2026-07-21)
[31] AllJobs — https://alljobs.co.il (accessed 2026-07-21)
[32] HR.ge — https://hr.ge (accessed 2026-07-21)
[33] Kwork — https://kwork.ru (accessed 2026-07-21)
[34] Habr Freelance — https://freelance.habr.com (accessed 2026-07-21)
[35] Alma Career — cvonline.lt/lv/ee, jobs.cz, prace.cz (accessed 2026-07-21)
[36] CryptoJobsList — https://cryptojobslist.com (accessed 2026-07-21)
[37] SmartRecruiters API — https://api.smartrecruiters.com (accessed 2026-07-21)
[38] Recruitee API — https://recruitee.com/api (accessed 2026-07-21)
[39] BambooHR Careers — https://bamboohr.com/careers (accessed 2026-07-21)
[40] CVBankas.lt — https://cvbankas.lt (accessed 2026-07-21)
[41] Tecnoempleo — https://tecnoempleo.com (accessed 2026-07-21)
[42] Landing.jobs — https://landing.jobs (accessed 2026-07-21)
[43] HelloWorld.rs — https://helloworld.rs (accessed 2026-07-21)
[44] Personio — https://personio.com (accessed 2026-07-21)
[45] Workday — https://myworkdayjobs.com (accessed 2026-07-21)
[46] Reddit API — https://www.reddit.com/dev/api (accessed 2026-07-21)
[47] GitHub API — https://api.github.com (accessed 2026-07-21)
[48] Kimeta.de — https://kimeta.de (accessed 2026-07-21)
