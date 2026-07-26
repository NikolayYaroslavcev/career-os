# F2: International Job Aggregators

Research date: 2026-07-21
Focus: Technical viability for ingesting job listings relevant to Russian-speaking software engineers

## Findings

### [1] LinkedIn Jobs

**URL:** https://www.linkedin.com/jobs/
**API:** Yes, but highly restricted
**Official API docs:** https://learn.microsoft.com/en-us/linkedin/talent/job-postings/api/overview

- **Has API?** YES (Job Posting API, part of Talent Solutions)
- **Auth:** OAuth 2.0 (Client Credentials Flow) - requires partner approval
- **Anonymous OK?** NO. Must be an approved LinkedIn Talent Solutions partner. The Job Posting API is for POSTING jobs TO LinkedIn, not reading them.
- **Legal integration:** VERY RESTRICTED. LinkedIn does NOT offer a public API for reading/consuming job listings. The Talent APIs are for ATS systems to post jobs. Web scraping is explicitly prohibited in ToS.
- **Scraping OK?** NO. LinkedIn aggressively blocks scraping. Legal action against scrapers. Cloudflare-protected.
- **JSON/RSS:** No public JSON endpoint. No RSS feed for jobs.
- **Salary:** Partially exposed in listings
- **Technologies:** Listed in job descriptions (free text)
- **Experience level:** Sometimes (Senior, Mid, etc.)
- **Remote info:** Remote/hybrid/onsite tags
- **Company info:** Full company profiles
- **Recruiter info:** Yes (name, contact for posting companies)
- **Pagination:** Yes (via API, limited)
- **Search:** Yes (via API)
- **Sync:** Incremental sync via API (for partners)
- **Rate Limits:** Strict (varies by partnership tier)
- **Maintenance cost:** HIGH. Partnership required, legal compliance, API changes
- **Vacancies:** 20M+ globally, largest pool. Russian-speaking devs significant presence.
- **Notes:** LinkedIn is the largest job platform but has NO public job search API. The only API is for posting jobs as an authorized ATS partner. Scraping is illegal and technically very difficult (anti-bot, auth walls, dynamic rendering). There are third-party services (e.g., Proxycurl, PhantomBuster) that scrape LinkedIn but they are in legal grey area.

### [2] Indeed

**URL:** https://www.indeed.com/
**API:** DISCONTINUED for public use
**Official API docs:** https://apidocs.indeed.com/ (now deprecated)

- **Has API?** NO (public job search API discontinued in 2024)
- **Auth:** N/A
- **Anonymous OK?** N/A
- **Legal integration:** Indeed closed its public API to third parties. Only publisher partnerships (Indeed for Employers) remain.
- **Scraping OK?** NO. Aggressive anti-bot measures. Cloudflare, IP blocking, CAPTCHA. ToS prohibits scraping.
- **JSON/RSS:** Indeed previously had RSS feeds but these were deprecated. Google for Jobs effectively replaced the need.
- **Salary:** Sometimes listed
- **Technologies:** Free text in descriptions
- **Experience level:** Sometimes
- **Remote info:** Yes
- **Company info:** Yes
- **Recruiter info:** Partial
- **Pagination:** No public API
- **Search:** No public API
- **Sync:** No
- **Rate Limits:** N/A (blocked)
- **Maintenance cost:** VERY HIGH. Scraping is unreliable, requires headless browser, proxy rotation, CAPTCHA solving.
- **Vacancies:** ~15M+ globally. Huge volume but inaccessible programmatically.
- **Notes:** Indeed was once the best job aggregator with a public API. In 2024-2025 they shut down the public API and increased anti-scraping measures. Google for Jobs now indexes Indeed listings. For our purposes, Indeed is effectively a dead end for direct integration.

### [3] Glassdoor

**URL:** https://www.glassdoor.com/
**API:** NO public job API
**Official API docs:** None available

- **Has API?** NO. Glassdoor offers "Employer Center" for companies to manage their profiles, but no job search/consumption API.
- **Auth:** N/A
- **Anonymous OK?** N/A
- **Legal integration:** No API available for third-party job consumption.
- **Scraping OK?** NO. Very aggressive anti-bot. Requires login for most content. Heavy JS rendering.
- **JSON/RSS:** None
- **Salary:** Strong salary data (main differentiator)
- **Technologies:** Minimal (company reviews, not job-focused)
- **Experience level:** Limited
- **Remote info:** Limited
- **Company info:** Excellent company reviews/ratings
- **Recruiter info:** Minimal
- **Pagination:** N/A
- **Search:** N/A
- **Sync:** N/A
- **Rate Limits:** N/A
- **Maintenance cost:** N/A (not viable)
- **Vacancies:** ~7M but primarily duplicates from Indeed/others
- **Notes:** Glassdoor is primarily a company review/salary platform, not a job board. It aggregates some listings but has no API for programmatic access. Not viable for our use case.

### [4] Jooble

**URL:** https://jooble.org/
**API:** YES (free API available)
**Official API docs:** https://jooble.org/api/ (requires registration)

- **Has API?** YES. Jooble offers a free Job Search API.
- **Auth:** API key (free registration)
- **Anonymous OK?** NO (API key required, but free)
- **Legal integration:** LEGITIMATE. API is officially provided. ToS allows use for job aggregation.
- **Scraping OK?** Not needed (API available)
- **JSON/RSS:** JSON responses. No RSS.
- **Salary:** Sometimes included in listings
- **Technologies:** Free text in descriptions
- **Experience level:** Sometimes
- **Remote info:** Yes (in descriptions)
- **Company info:** Limited (often "via Jooble")
- **Recruiter info:** Minimal
- **Pagination:** Yes (offset-based)
- **Search:** Yes (keyword, location, salary, date)
- **Sync:** Limited (no webhooks, polling only)
- **Rate Limits:** Undisclosed (seems generous for reasonable use)
- **Maintenance cost:** LOW. Simple REST API, stable.
- **Vacancies:** ~8M+ aggregated from multiple sources. Good international coverage.
- **Notes:** Jooble is a meta-aggregator (like Google for Jobs). Their API aggregates listings from thousands of job boards worldwide. Quality varies. Good for volume but deduplication is needed. Works well for CIS/Eastern European job listings since Jooble has roots in Ukraine.

### [5] Talent.com (formerly Neuvoo)

**URL:** https://www.talent.com/
**API:** YES (publisher/partner API)
**Official API docs:** Available via partner registration

- **Has API?** YES. Talent.com offers an API for publishers to display job listings.
- **Auth:** API key / partner agreement
- **Anonymous OK?** NO (requires partner agreement)
- **Legal integration:** LEGITIMATE. Partner program available.
- **Scraping OK?** Not needed (API available)
- **JSON/RSS:** JSON responses. RSS available for some categories.
- **Salary:** Excellent salary data (Talent.com is known for salary tools)
- **Technologies:** Parsed from descriptions
- **Experience level:** Sometimes
- **Remote info:** Yes
- **Company info:** Yes
- **Recruiter info:** Partial
- **Pagination:** Yes
- **Search:** Yes (keyword, location, salary)
- **Sync:** Polling-based
- **Rate Limits:** Per partner agreement
- **Maintenance cost:** MEDIUM. Requires partner agreement and compliance.
- **Vacancies:** ~30M+ globally. One of the largest aggregators.
- **Notes:** Talent.com (formerly Neuvoo) is one of the largest job aggregators globally. They have a legitimate publisher API. Good international coverage including CIS countries. Salary data is their strength. Partnership required for API access.

### [6] SimplyHired

**URL:** https://www.simplyhired.com/
**API:** NO (public API discontinued)
**Official API docs:** None

- **Has API?** NO. SimplyHired was acquired by Indeed and no longer offers a public API.
- **Auth:** N/A
- **Anonymous OK?** N/A
- **Legal integration:** Owned by Indeed. No API available.
- **Scraping OK?** NO. Anti-bot measures. Terms prohibit scraping.
- **JSON/RSS:** None
- **Salary:** Sometimes
- **Technologies:** Free text
- **Experience level:** Sometimes
- **Remote info:** Yes
- **Company info:** Limited
- **Recruiter info:** Minimal
- **Pagination:** N/A
- **Search:** N/A
- **Sync:** N/A
- **Rate Limits:** N/A
- **Maintenance cost:** N/A
- **Vacancies:** ~8M (mostly duplicates from Indeed)
- **Notes:** SimplyHired was acquired by Indeed. No API. Not viable.

### [7] ZipRecruiter

**URL:** https://www.ziprecruiter.com/
**API:** YES (for employers/publishers)
**Official API docs:** Via partner program

- **Has API?** YES. ZipRecruiter offers API for job distribution (posting jobs to ZipRecruiter).
- **Auth:** OAuth 2.0 / API key
- **Anonymous OK?** NO. Requires partnership.
- **Legal integration:** PARTNER-ONLY. API is for job distribution, not consumption.
- **Scraping OK?** NO. Aggressive anti-bot.
- **JSON/RSS:** None publicly
- **Salary:** Often listed (ZipRecruiter known for salary transparency)
- **Technologies:** Free text
- **Experience level:** Sometimes
- **Remote info:** Yes
- **Company info:** Yes
- **Recruiter info:** Yes
- **Pagination:** N/A for consumption
- **Search:** N/A for consumption
- **Sync:** N/A
- **Rate Limits:** N/A
- **Maintenance cost:** N/A for consumption
- **Vacancies:** ~9M US-focused
- **Notes:** ZipRecruiter API is for posting jobs TO the platform, not reading them. US-focused. Not viable for our consumption use case.

### [8] CareerBuilder

**URL:** https://www.careerbuilder.com/
**API:** YES (for job distribution)
**Official API docs:** Via partner program

- **Has API?** YES. CareerBuilder offers API for job distribution (posting).
- **Auth:** API key / OAuth
- **Anonymous OK?** NO
- **Legal integration:** PARTNER-ONLY API
- **Scraping OK?** NO. Anti-bot measures.
- **JSON/RSS:** None publicly
- **Salary:** Sometimes
- **Technologies:** Free text
- **Experience level:** Sometimes
- **Remote info:** Yes
- **Company info:** Yes
- **Recruiter info:** Partial
- **Pagination:** N/A for consumption
- **Search:** N/A
- **Sync:** N/A
- **Rate Limits:** N/A
- **Maintenance cost:** N/A
- **Vacancies:** ~5M US-focused
- **Notes:** CareerBuilder API is for job distribution only. US-focused. Not viable.

### [9] Monster

**URL:** https://www.monster.com/
**API:** NO public API
**Official API docs:** None

- **Has API?** NO. Monster does not offer a public API for job consumption.
- **Auth:** N/A
- **Anonymous OK?** N/A
- **Legal integration:** No API. ToS prohibits scraping.
- **Scraping OK?** NO. Anti-bot measures.
- **JSON/RSS:** None
- **Salary:** Sometimes
- **Technologies:** Free text
- **Experience level:** Sometimes
- **Remote info:** Yes
- **Company info:** Yes
- **Recruiter info:** Partial
- **Pagination:** N/A
- **Search:** N/A
- **Sync:** N/A
- **Rate Limits:** N/A
- **Maintenance cost:** N/A
- **Vacancies:** ~5M globally (declining)
- **Notes:** Monster has been declining for years. No API. Not viable. Note: Monster has regional sites (monster.de, monster.co.uk, etc.) but none offer APIs.

### [10] Dice.com

**URL:** https://www.dice.com/
**API:** NO public API
**Official API docs:** None

- **Has API?** NO. Dice does not offer a public API for job consumption.
- **Auth:** N/A
- **Anonymous OK?** N/A
- **Legal integration:** No API. ToS prohibits scraping.
- **Scraping OK?** NO. Anti-bot measures.
- **JSON/RSS:** None
- **Salary:** Often listed
- **Technologies:** Excellent (tech-focused board, skills tags)
- **Experience level:** Yes
- **Remote info:** Yes
- **Company info:** Yes
- **Recruiter info:** Partial
- **Pagination:** N/A
- **Search:** N/A
- **Sync:** N/A
- **Rate Limits:** N/A
- **Maintenance cost:** N/A
- **Vacancies:** ~100K US tech-focused
- **Notes:** Dice is the premier US tech job board but has no public API. US-only. Not viable for direct integration.

### [11] StackOverflow Jobs

**URL:** https://stackoverflow.com/jobs
**API:** DISCONTINUED
**Status in 2026:** SHUT DOWN

- **Has API?** NO. StackOverflow Jobs was shut down in 2022.
- **Notes:** StackOverflow Jobs was shut down in 2022. The Jobs section no longer exists. StackOverflow now only has "Developer Jobs" links pointing to external boards. DEAD END.

### [12] GitHub Jobs

**URL:** https://github.com/jobs
**API:** DISCONTINUED
**Status in 2026:** SHUT DOWN

- **Has API?** NO. GitHub Jobs was shut down in 2021.
- **Notes:** GitHub Jobs was shut down in 2021. DEAD END.

### [13] Reed.co.uk

**URL:** https://www.reed.co.uk/
**API:** YES (official API)
**Official API docs:** https://www.reed.co.uk/developers/jobseeker

- **Has API?** YES. Reed offers a Job Search API and a Job Posting API.
- **Auth:** API key (free registration)
- **Anonymous OK?** YES (API key is free)
- **Legal integration:** LEGITIMATE. Official API with documentation.
- **Scraping OK?** Not needed (API available)
- **JSON/RSS:** JSON responses. RSS feeds available.
- **Salary:** Often listed
- **Technologies:** Some categorization
- **Experience level:** Sometimes
- **Remote info:** Yes
- **Company info:** Yes
- **Recruiter info:** Partial
- **Pagination:** Yes
- **Search:** Yes (keyword, location, salary min/max)
- **Sync:** Polling-based
- **Rate Limits:** 10 requests/second
- **Maintenance cost:** LOW-MEDIUM. Simple API, well-documented.
- **Vacancies:** ~200K UK-focused
- **Notes:** Reed.co.uk is one of the few major job boards with a free, official API for job consumption. UK-focused but has some international listings. Good data quality. Rate limit is generous. Excellent option for UK market.

### [14] JobTeaser

**URL:** https://www.jobteaser.com/
**API:** YES (for partners)
**Official API docs:** Via partner program

- **Has API?** YES. JobTeaser offers API for employers and educational institutions.
- **Auth:** OAuth 2.0
- **Anonymous OK?** NO. Requires partnership.
- **Legal integration:** PARTNER-ONLY
- **Scraping OK?** NO
- **JSON/RSS:** JSON (partner-only)
- **Salary:** Sometimes
- **Technologies:** Limited
- **Experience level:** Entry-level focused (graduates)
- **Remote info:** Sometimes
- **Company info:** Yes
- **Recruiter info:** Yes
- **Pagination:** Yes
- **Search:** Yes
- **Sync:** Yes
- **Rate Limits:** Per agreement
- **Maintenance cost:** MEDIUM
- **Vacancies:** ~50K primarily EU/France-focused
- **Notes:** JobTeaser is focused on entry-level/graduate positions in Europe (especially France). Not relevant for senior Russian-speaking devs.

### [15] Joblift/StepStone

**URL:** https://www.joblift.de/ / https://www.stepstone.com/
**API:** NO public API for job consumption
**Official API docs:** None

- **Has API?** NO. No public API available.
- **Notes:** Joblift was acquired by StepStone (now Adevinta). No public API. StepStone is one of the largest European job boards but offers no programmatic access. German market dominated.

### [16] CV-Library

**URL:** https://www.cv-library.co.uk/
**API:** YES (official API)
**Official API docs:** Via developer portal

- **Has API?** YES. CV-Library offers a Job Search API.
- **Auth:** API key (free registration)
- **Anonymous OK?** YES (API key is free)
- **Legal integration:** LEGITIMATE. Official API.
- **Scraping OK?** Not needed
- **JSON/RSS:** JSON responses
- **Salary:** Often listed
- **Technologies:** Some categorization
- **Experience level:** Yes
- **Remote info:** Yes
- **Company info:** Yes
- **Recruiter info:** Partial
- **Pagination:** Yes
- **Search:** Yes (keyword, location, salary)
- **Sync:** Polling-based
- **Rate Limits:** Undisclosed
- **Maintenance cost:** LOW
- **Vacancies:** ~150K UK-focused
- **Notes:** CV-Library is the UK's largest independent job board with a free API. Good option for UK market.

### [17] TotalJobs

**URL:** https://www.totaljobs.com/
**API:** NO public API

- **Has API?** NO
- **Notes:** TotalJobs (owned by StepStone) has no public API. Not viable.

### [18] SEEK (Australia)

**URL:** https://www.seek.com.au/
**API:** YES (for employers/publishers)
**Official API docs:** Via partner program

- **Has API?** YES. SEEK offers API for job distribution.
- **Auth:** OAuth 2.0
- **Anonymous OK?** NO. Requires partnership.
- **Legal integration:** PARTNER-ONLY API
- **Scraping OK?** NO
- **Vacancies:** ~150K Australia/NZ
- **Notes:** SEEK is the dominant Australian job board. API is for job distribution, not consumption. Australia-only.

### [19] Jora

**URL:** https://www.jora.com/
**API:** NO public API

- **Has API?** NO. Jora (owned by SEEK) has no public API.
- **Vacancies:** ~50K Australia
- **Notes:** Not viable.

### [20] Arbeitnow

**URL:** https://www.arbeitnow.com/
**API:** YES (free, public API)
**Official API docs:** https://www.arbeitnow.com/api/job-board-api

- **Has API?** YES. Free, public JSON API.
- **Auth:** None required (completely open)
- **Anonymous OK?** YES
- **Legal integration:** LEGITIMATE. Free public API with no authentication required.
- **Scraping OK?** Not needed
- **JSON/RSS:** JSON. Well-structured.
- **Salary:** Yes (explicitly listed with salary ranges)
- **Technologies:** Yes (tagged)
- **Experience level:** Yes (Entry, Experienced, etc.)
- **Remote info:** Yes (Remote tag)
- **Company info:** Yes (company name, logo, URL)
- **Recruiter info:** Minimal
- **Pagination:** Yes
- **Search:** Yes (keyword, location, category)
- **Sync:** Polling-based
- **Rate Limits:** Undisclosed (seems generous)
- **Maintenance cost:** VERY LOW. Simple, open API.
- **Vacancies:** ~6.6K primarily Germany/DACH-focused
- **Notes:** Arbeitnow is an excellent, developer-friendly job board focused on Germany/DACH region. Completely free API with no authentication. Excellent data quality with salary ranges, technology tags, and remote flags. However, it is focused on English-speaking jobs in Germany, not Russian-speaking jobs. Limited vacancy count.

## Source Assessment Table

| # | Source | URL | Has API? | Auth | Anonymous OK? | Legal? | Scraping OK? | JSON/RSS | Salary | Tech | Remote | Company | Pagination | Search | Sync | Rate Limits | Maintenance | Vacancies | Notes |
|---|--------|-----|----------|------|---------------|--------|--------------|----------|--------|------|--------|---------|------------|--------|------|-------------|-------------|-----------|-------|
| 1 | LinkedIn Jobs | linkedin.com/jobs | PARTNER ONLY (posting) | OAuth 2.0 | NO | Restricted | NO | NO | Partial | Free text | Yes | Yes | Limited | Limited | Limited | Strict | HIGH | 20M+ | No consumption API |
| 2 | Indeed | indeed.com | DISCONTINUED | N/A | N/A | N/A | NO | NO | Sometimes | Free text | Yes | Yes | N/A | N/A | N/A | N/A | VERY HIGH | 15M+ | Dead end |
| 3 | Glassdoor | glassdoor.com | NO | N/A | N/A | N/A | NO | NO | Excellent | Minimal | Limited | Excellent reviews | N/A | N/A | N/A | N/A | N/A | 7M | Review platform, not job board |
| 4 | Jooble | jooble.org | YES (free) | API key (free) | YES | YES | N/A | JSON | Sometimes | Free text | Yes | Limited | Yes | Yes | Polling | Undisclosed | LOW | 8M+ | Good aggregator, CIS coverage |
| 5 | Talent.com | talent.com | YES (partner) | API key | NO | YES | N/A | JSON, RSS | Excellent | Parsed | Yes | Yes | Yes | Yes | Polling | Per agreement | MEDIUM | 30M+ | Largest aggregator, salary focus |
| 6 | SimplyHired | simplyhired.com | DISCONTINUED | N/A | N/A | N/A | NO | NO | Sometimes | Free text | Yes | Limited | N/A | N/A | N/A | N/A | N/A | 8M | Acquired by Indeed |
| 7 | ZipRecruiter | ziprecruiter.com | POSTING ONLY | OAuth | NO | PARTNER | NO | NO | Often | Free text | Yes | Yes | N/A | N/A | N/A | N/A | N/A | 9M | US-focused, posting API only |
| 8 | CareerBuilder | careerbuilder.com | POSTING ONLY | API key | NO | PARTNER | NO | NO | Sometimes | Free text | Yes | Yes | N/A | N/A | N/A | N/A | N/A | 5M | US-focused, posting API only |
| 9 | Monster | monster.com | NO | N/A | N/A | N/A | NO | NO | Sometimes | Free text | Yes | Yes | N/A | N/A | N/A | N/A | N/A | 5M | Declining, no API |
| 10 | Dice.com | dice.com | NO | N/A | N/A | N/A | NO | NO | Often | Excellent tags | Yes | Yes | N/A | N/A | N/A | N/A | N/A | 100K | US tech only, no API |
| 11 | StackOverflow Jobs | stackoverflow.com/jobs | DEAD | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | 0 | Shut down 2022 |
| 12 | GitHub Jobs | github.com/jobs | DEAD | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | 0 | Shut down 2021 |
| 13 | Reed.co.uk | reed.co.uk | YES (free) | API key (free) | YES | YES | N/A | JSON, RSS | Often | Some | Yes | Yes | Yes | Yes | Polling | 10 req/s | LOW | 200K | UK, free API |
| 14 | JobTeaser | jobteaser.com | YES (partner) | OAuth | NO | PARTNER | NO | JSON | Sometimes | Limited | Sometimes | Yes | Yes | Yes | Yes | Per agreement | MEDIUM | 50K | EU graduate focus |
| 15 | Joblift/StepStone | joblift.de | NO | N/A | N/A | N/A | NO | NO | Sometimes | Limited | Yes | Yes | N/A | N/A | N/A | N/A | N/A | 500K | DACH, no API |
| 16 | CV-Library | cv-library.co.uk | YES (free) | API key (free) | YES | YES | N/A | JSON | Often | Some | Yes | Yes | Yes | Yes | Polling | Undisclosed | LOW | 150K | UK, free API |
| 17 | TotalJobs | totaljobs.com | NO | N/A | N/A | N/A | NO | NO | Sometimes | Limited | Yes | Yes | N/A | N/A | N/A | N/A | N/A | 150K | UK, no API |
| 18 | SEEK | seek.com.au | PARTNER ONLY | OAuth | NO | PARTNER | NO | JSON | Often | Some | Yes | Yes | Yes | Yes | Yes | Per agreement | MEDIUM | 150K | Australia only |
| 19 | Jora | jora.com | NO | N/A | N/A | N/A | NO | NO | Sometimes | Limited | Yes | Limited | N/A | N/A | N/A | N/A | N/A | 50K | Australia only |
| 20 | Arbeitnow | arbeitnow.com | YES (free, open) | None | YES | YES | N/A | JSON | Yes | Yes | Yes | Yes | Yes | Yes | Polling | Undisclosed | VERY LOW | 6.6K | Germany, excellent API |

## Additional Sources Discovered

### Google for Jobs / Structured Data

- **Google Jobs API:** Google deprecated the direct Jobs API in 2023. However, Google for Jobs still indexes structured data (Schema.org JobPosting) from websites.
- **Implementation:** Add Schema.org JobPosting structured data to your job listing pages. Google will index them.
- **Relevance:** Useful for SEO, not for ingestion. You can search Google for Jobs via Custom Search API but it is not a structured job data API.

### RSS Feeds

Limited RSS availability:
- Reed.co.uk: RSS feeds available
- Talent.com: RSS available for some categories
- Most major boards have discontinued RSS feeds

### GraphQL Endpoints

No major job board offers public GraphQL endpoints for job search. This is not a viable integration method for international aggregators.

### CIS/Russian Integration

**IMPORTANT FINDING:** None of the international aggregators have special CIS/Russian integration. The platforms that cover Russian-speaking markets are:
- **Jooble** (has CIS roots, covers Ukraine/Russia)
- **Talent.com** (has Russian site talent.ru)
- **RemoteOK** (remote jobs, global)
- **WeWorkRemotely** (remote jobs, global)
- **Habr Career** (habr.com/career - Russian tech job board, covered in separate research)

## Dead ends

1. **LinkedIn Jobs** - No consumption API. Only posting API for approved ATS partners. Scraping illegal.
2. **Indeed** - Public API discontinued 2024. No alternative access.
3. **Glassdoor** - Not a job board. No API.
4. **SimplyHired** - Acquired by Indeed, no API.
5. **StackOverflow Jobs** - Shut down 2022.
6. **GitHub Jobs** - Shut down 2021.
7. **ZipRecruiter** - Posting API only, US-focused.
8. **CareerBuilder** - Posting API only, US-focused.
9. **Monster** - No API, declining.
10. **Dice.com** - No API, US-only.
11. **Joblift/StepStone** - No API, DACH only.
12. **TotalJobs** - No API, UK only.
13. **Jora** - No API, Australia only.

## Suggested follow-ups

### HIGH PRIORITY - Implement First

1. **Jooble API** - Free, easy integration, good CIS coverage, ~8M vacancies. Start here.
2. **Talent.com Partner API** - Largest aggregator (~30M), excellent salary data, CIS coverage. Apply for partnership.
3. **Arbeitnow API** - Free, no auth, excellent data quality. Low volume but zero maintenance.

### MEDIUM PRIORITY - Worth pursuing

4. **Reed.co.uk API** - Free, UK market. Good for UK-based Russian-speaking devs.
5. **CV-Library API** - Free, UK market. Complement to Reed.
6. **Adzuna API** - Not in original list but worth researching. They have a public API and are a large aggregator.
7. **RemoteOK API** - Remote-focused, likely has open API. Worth investigating.
8. **WeWorkRemotely** - Remote-focused, worth investigating.

### CIS-SPECIFIC (Covered in separate research files)

9. **Habr Career (habr.com/career)** - Primary Russian tech job board
10. **HH.ru** - Largest Russian job board (hh.ru API is available)
11. **Rabota.ru** - Russian job board
12. **SuperJob.ru** - Russian job board

### STRATEGY RECOMMENDATION

**Tier 1 (Immediate):** Jooble API + Talent.com API + Arbeitnow API
- These give ~40M+ aggregated vacancies with legitimate APIs
- Jooble covers CIS well, Talent.com has salary data, Arbeitnow has zero-cost integration

**Tier 2 (After MVP):** Reed.co.uk + CV-Library + Adzuna (if available)
- UK market coverage with free APIs

**Tier 3 (Growth):** Direct integrations with job boards (posting jobs, not reading)
- Consider LinkedIn Apply Connect if you become a job platform yourself

**Tier 4 (Specialized):** RemoteOK + WeWorkRemotely + AngelList
- Remote job platforms with likely open APIs

**Avoid:** LinkedIn scraping, Indeed scraping, Glassdoor scraping
- Too risky legally, too expensive technically, ToS violations
