# F3: Remote-First Job Boards

## Research Date: 2026-07-21

## Findings

This document evaluates 20 remote-first job boards and platforms for technical integration feasibility.

### Summary of Key Findings

**Tier 1 - Ready to integrate (official API):**
1. RemoteOK - Best API, JSON, full data, no auth
2. Remotive - Public API with RSS, good data
3. Himalayas - Excellent API with search, pagination, salary
4. We Work Remotely - RSS feeds, structured data

**Tier 2 - Integratable with effort:**
5. Working Nomads - API available
6. DailyRemote - Large volume, scraping needed
7. RemoteLeads - Curated leads, paid service

**Tier 3 - Closed marketplaces:**
8-20. Various closed platforms (Toptal, Turing, Arc.dev, Braintrust, etc.)

---

## Source Assessment Table

### 1. RemoteOK (remoteok.com)

| Attribute | Value |
|-----------|-------|
| URL | https://remoteok.com |
| Has API? | **YES** - https://remoteok.com/api |
| Auth | None required |
| Anonymous? | Yes, fully anonymous |
| Legal? | Requires attribution/link-back per ToS |
| Scraping? | API makes scraping unnecessary |
| JSON/RSS | **JSON** (full array of job objects) |
| Salary | Yes (when provided by employer) |
| Tech/Tags | Yes (tags array) |
| Remote Info | Yes (all jobs are remote) |
| Company | Yes (company name + logo) |
| Pagination | No pagination - returns all jobs |
| Search | No server-side search (client filters) |
| Sync | Incremental by epoch timestamp |
| Rate Limits | Not documented; be respectful |
| Maintenance | Very Low - stable API |
| Vacancies | ~500-1000 active software jobs |
| Russian/CIS? | No specific filtering; worldwide jobs |

**Data Fields Returned:**
- id, slug, epoch, date, company, company_logo, position, tags, description (HTML), location, salary, apply link

**Notes:**
- Best free job API available. No authentication required.
- Requires attribution: link back to Remote OK and mention Remote OK as a source
- Jobs are not delayed - real-time data
- Tags help filter for software engineering roles

---

### 2. We Work Remotely (weworkremotely.com)

| Attribute | Value |
|-----------|-------|
| URL | https://weworkremotely.com |
| Has API? | No official REST API |
| Auth | None for RSS |
| Anonymous? | Yes |
| Legal? | RSS is public; ToS should be checked |
| Scraping? | RSS preferred over scraping |
| JSON/RSS | **RSS/XML** feeds available |
| Salary | Rare (not structured) |
| Tech/Skills | Yes (skills field in RSS) |
| Remote Info | Yes (region, country fields) |
| Company | Yes (company name) |
| Pagination | RSS shows recent ~30 items per category |
| Search | RSS by category only |
| Sync | RSS pubDate for incremental |
| Rate Limits | Not documented for RSS |
| Maintenance | Low - RSS is stable |
| Vacancies | ~200-400 active software jobs |
| Russian/CIS? | Some European jobs include CIS countries |

**RSS Endpoints:**
- Back-end: https://weworkremotely.com/categories/remote-back-end-programming-jobs.rss
- Front-end: https://weworkremotely.com/categories/remote-front-end-programming-jobs.rss
- Full-stack: https://weworkremotely.com/categories/remote-full-stack-programming-jobs.rss
- All: https://weworkremotely.com/remote-jobs.rss

**Notes:**
- RSS fields: title, region, country, state, skills, category, type, description, pubDate, guid, link
- Country field includes specific countries - some list Ukraine, Belarus, Armenia, etc.
- Jobs are curated and high quality
- No salary data in RSS (need to scrape individual pages)

---

### 3. Himalayas (himalayas.app)

| Attribute | Value |
|-----------|-------|
| URL | https://himalayas.app |
| Has API? | **YES** - Full JSON API |
| Auth | None required |
| Anonymous? | Yes |
| Legal? | Requires attribution/link-back |
| Scraping? | API makes scraping unnecessary |
| JSON/RSS | **JSON** + RSS + MCP server |
| Salary | **Yes** (minSalary, maxSalary, currency, salaryPeriod) |
| Tech | Via category/parentCategories |
| Remote Info | Yes (locationRestrictions, timezoneRestriction) |
| Company | Yes (companyName, companySlug, companyLogo) |
| Pagination | **Yes** (offset/limit or page-based) |
| Search | **Yes** - keyword, country, seniority, employment type, timezone |
| Sync | pubDate, expiryDate for incremental |
| Rate Limits | Rate limited (429 errors); 20 jobs per request max |
| Maintenance | Low |
| Vacancies | ~2000-5000+ active remote jobs |
| Russian/CIS? | Country filter supports all countries |

**API Endpoints:**
- Browse: https://himalayas.app/jobs/api?limit=20&offset=0
- Search: https://himalayas.app/jobs/api/search?q=react&seniority=Senior
- OpenAPI spec: https://himalayas.app/docs/openapi.json
- RSS: https://himalayas.app/rss
- MCP Server available

**Data Fields:**
- title, excerpt, companyName, companySlug, companyLogo
- employmentType, locationRestrictions, timezoneRestriction
- category[], minSalary, maxSalary, salaryPeriod, currency
- description (HTML), pubDate, expiryDate, applicationLink, guid

**Notes:**
- Best structured salary data among free APIs
- 20 jobs per request limit (as of March 2025)
- Search supports seniority filtering (Entry-level to Executive)
- Also offers embeddable widget
- MCP server for AI-native integration

---

### 4. Remote.com Jobs (remote.com/jobs)

| Attribute | Value |
|-----------|-------|
| URL | https://remote.com/jobs |
| Has API? | **No public API** |
| Auth | N/A |
| Anonymous? | Website is public, no API |
| Legal? | ToS likely restricts scraping |
| Scraping? | Possible but heavy JS rendering |
| JSON/RSS | No public structured feeds |
| Salary | Sometimes in listings |
| Tech | No structured data |
| Remote Info | Yes (all remote by definition) |
| Company | Yes |
| Pagination | HTML pagination |
| Search | Search on website |
| Sync | No structured sync mechanism |
| Rate Limits | N/A |
| Maintenance | High (scraping) |
| Vacancies | ~500-1000 |
| Russian/CIS? | Remote.com hires globally but may restrict some countries |

**Notes:**
- Remote.com is an EOR company, not primarily a job board
- Their job listings are mostly for their own company or EOR clients
- Heavy JS SPA - requires headless browser for scraping
- Not a good candidate for API integration

---

### 5. Arc.dev (arc.dev)

| Attribute | Value |
|-----------|-------|
| URL | https://arc.dev |
| Has API? | **No public API** |
| Auth | Employer/talent login only |
| Anonymous? | Job listings visible, no API |
| Legal? | Closed marketplace |
| Scraping? | Possible but complex SPA |
| JSON/RSS | No |
| Salary | Salary explorer available (not per job) |
| Tech | Via developer categories |
| Remote Info | Yes |
| Company | Yes |
| N/A | N/A |
| Russian/CIS? | Talent from 190 countries including CIS |

**Notes:**
- Primarily a talent marketplace (supply-side), not a traditional job board
- Companies post needs, Arc matches vetted developers
- No public API; would require partnership or scraping

---

### 6. Turing (turing.com)

| Attribute | Value |
|-----------|-------|
| URL | https://turing.com |
| Has API? | **No public API** |
| Anonymous? | No - vetted marketplace |
| Legal? | Closed marketplace |
| JSON/RSS | No |
| N/A | N/A |
| Russian/CIS? | Claims 3M+ developers including CIS |

**Notes:**
- AI-powered talent matching platform, not a job board
- No public job listings to scrape or consume via API
- Not suitable for job aggregation

---

### 7. Toptal (toptal.com)

| Attribute | Value |
|-----------|-------|
| URL | https://toptal.com |
| Has API? | **No public API** |
| Anonymous? | No - exclusive network |
| Legal? | Closed, private network |
| JSON/RSS | No |
| N/A | N/A |
| Russian/CIS? | Claims top 3% talent globally |

**Notes:**
- Private talent network (top 3% claim)
- No job listings visible publicly
- Not suitable for job aggregation

---

### 8. Braintrust (usebraintrust.com)

| Attribute | Value |
|-----------|-------|
| URL | https://usebraintrust.com |
| Has API? | **No public job API** |
| Anonymous? | Job listings visible on /jobs |
| Legal? | Decentralized network, terms unclear |
| JSON/RSS | No |
| N/A | N/A |
| Russian/CIS? | Global network, includes CIS |

**Notes:**
- Blockchain-based talent network (BTRST token)
- Enterprise-focused (NASA, Google, Goldman Sachs logos)
- No public API for job data

---

### 9. Lemon.io (lemon.io)

| Attribute | Value |
|-----------|-------|
| URL | https://lemon.io |
| Has API? | **No public API** |
| Anonymous? | No - vetted marketplace |
| Legal? | Closed marketplace |
| JSON/RSS | No |
| N/A | N/A |
| Russian/CIS? | **YES - specifically targets Eastern European devs** |

**Notes:**
- **HIGHLY RELEVANT FOR CIS DEVELOPERS**
- Originally Ukrainian-founded company
- Actively recruits from Ukraine, Poland, Romania, Bulgaria, Moldova, Georgia
- 1,500+ manually vetted developers
- Shows developers from UA, PL, BG, RO, MD flags
- No public API - closed matching platform
- Could be a source for understanding CIS developer market

---

### 10. Remotive (remotive.com)

| Attribute | Value |
|-----------|-------|
| URL | https://remotive.com |
| Has API? | **YES** - https://remotive.com/api/remote-jobs |
| Auth | None required |
| Anonymous? | Yes |
| Legal? | Requires attribution; jobs delayed 24h |
| Scraping? | API makes scraping unnecessary |
| JSON/RSS | **JSON** + RSS feeds |
| Salary | Yes (salary string, not structured) |
| Tech | Via category |
| Remote Info | candidate_required_location field |
| Company | Yes (company_name, company_logo) |
| Pagination | No pagination (returns all active) |
| Search | querystring: search, category, company_name, limit |
| Sync | publication_date for incremental |
| Rate Limits | Max 2x per minute; recommend 4x/day |
| Maintenance | Very Low |
| Vacancies | ~1000-2000 active remote jobs |
| Russian/CIS? | No specific filtering |

**API Documentation:**
- Endpoint: GET https://remotive.com/api/remote-jobs
- Parameters: category, company_name, search, limit
- Categories: https://remotive.com/api/remote-jobs/categories
- GitHub docs: https://github.com/remotive-com/remote-jobs-api

**Data Fields:**
- id, url, title, company_name, company_logo
- category, job_type, publication_date
- candidate_required_location, salary
- description (HTML)

**Notes:**
- Jobs are delayed by 24 hours for attribution
- Public API is free but rate-limited
- Paid private API available (hello@remotive.com)
- RSS feeds also available

---

### 11. RemoteLeads (remoteleads.io)

| Attribute | Value |
|-----------|-------|
| URL | https://remoteleads.io |
| Has API? | **No public API** |
| Auth | Paid subscription required |
| Anonymous? | Partial - some leads visible |
| Legal? | Curated leads, paid service |
| Scraping? | Paid service, not for scraping |
| JSON/RSS | No |
| N/A | N/A |
| Russian/CIS? | No specific focus |

**Notes:**
- Curated freelance leads service, not a traditional job board
- Pricing: /mo (freelancer), /mo (agency), /mo (business)
- Not suitable for bulk API integration

---

### 12. Somewhere (somewhere.com)

| Attribute | Value |
|-----------|-------|
| URL | https://somewhere.com |
| Has API? | **No public API** |
| Anonymous? | No - recruitment service |
| Legal? | Recruitment agency model |
| JSON/RSS | No |
| N/A | N/A |
| Russian/CIS? | Hires in 18+ countries; Eastern Europe mentioned |

**Notes:**
- Recruitment agency (formerly Support Shepherd)
- Focuses on Philippines, LATAM, South Africa
- Eastern Europe mentioned but not primary focus
- Not a job board - employer pays to find candidates

---

### 13. FlexJobs (flexjobs.com)

| Attribute | Value |
|-----------|-------|
| URL | https://www.flexjobs.com |
| Has API? | **No public API** |
| Auth | Paid subscription required to view |
| Anonymous? | No - paywall |
| Legal? | Curated, verified jobs |
| Scraping? | Paywall makes difficult |
| JSON/RSS | No |
| N/A | N/A |
| Russian/CIS? | No specific focus |

**Notes:**
- Premium job board (.95/month)
- All jobs are screened/verified
- Heavy paywall - no free data access
- Not suitable for API integration

---

### 14. Working Nomads (workingnomads.com)

| Attribute | Value |
|-----------|-------|
| URL | https://workingnomads.com |
| Has API? | **YES** - https://workingnomads.com/api/exposed_jobs/ |
| Auth | None required |
| Anonymous? | Yes |
| Legal? | Check ToS for API usage |
| Scraping? | API available |
| JSON/RSS | **JSON API** + RSS |
| N/A | N/A |
| Russian/CIS? | Europe category exists |

**Notes:**
- API endpoint exists at /api/exposed_jobs/
- 30K+ jobs curated from around the web
- Good for aggregating remote dev jobs

---

### 15. DailyRemote (dailyremote.com)

| Attribute | Value |
|-----------|-------|
| URL | https://dailyremote.com |
| Has API? | **No documented public API** |
| Auth | Premium for full access |
| Anonymous? | Partial - some jobs visible |
| Legal? | Aggregator - check ToS |
| Scraping? | Possible but heavy JS |
| JSON/RSS | No |
| N/A | N/A |
| Russian/CIS? | Shows jobs for Russia (114), Ukraine (1691), Belarus (63) |

**Notes:**
- Massive volume - 227K+ remote jobs
- Countries page shows CIS job counts
- Heavy JavaScript SPA - scraping requires headless browser
- Premium subscription for full features

---

### 16. Hired (hired.com)

| Attribute | Value |
|-----------|-------|
| URL | https://hired.com |
| Has API? | **No** - site redirects to LHH |
| N/A | N/A |

**Notes:**
- **DEAD END** - hired.com now redirects to LHH (Lee Hecht Harrison)
- Hired as a tech job marketplace no longer exists

---

### 17. Pesto (pesto.tech)

| Attribute | Value |
|-----------|-------|
| URL | https://pesto.tech |
| Has API? | **No public API** |
| Anonymous? | No - vetted marketplace |
| Legal? | Closed marketplace |
| JSON/RSS | No |
| N/A | N/A |
| Russian/CIS? | **Primarily India-focused** |

**Notes:**
- India-focused remote developer platform
- AI-powered vetting and matching
- Not suitable for CIS developer aggregation

---

### 18. Remote Talent Japan

| Attribute | Value |
|-----------|-------|
| URL | N/A |
| Notes | **Does not exist as standalone platform** |

---

### 19. RemoteOK Alternatives

#### remotly.dev
- **DNS resolution failed** - site does not exist or is down
- Dead end

---

### 20. CIS-Focused Remote Boards

#### No dedicated CIS-focused remote job boards with public APIs found

**CIS-Relevant Platforms Identified:**

| Platform | CIS Focus? | API? | Notes |
|----------|-----------|------|-------|
| Lemon.io | **YES** (Eastern Europe) | No | Ukrainian-founded, actively recruits from UA/PL/RO/BG |
| RemoteOK | Indirect | Yes | Some CIS jobs appear |
| Himalayas | Indirect | Yes | Country filter supports all |
| DailyRemote | Indirect | No | Shows Russia/Ukraine/Belarus job counts |

**Potential CIS Sources (manual research needed):**
- dou.ua (Ukraine) - Largest Ukrainian tech community/job board
- hh.ru (Russia) - HeadHunter, largest Russian job board
- habr.com/career (Russia) - Habr Career, tech-focused

---

## Dead Ends

1. Hired.com - Redirects to LHH recruitment company. Marketplace defunct.
2. remotly.dev - DNS resolution failed. Site does not exist.
3. Remote Talent Japan - No standalone platform exists with this name.
4. Toptal - Private network, no public data access.
5. Turing - AI matching platform, no job listings.
6. FlexJobs - Paywall prevents data access.

---

## Suggested Follow-ups

### Priority 1: API Integration (Ready Now)
1. RemoteOK - Integrate /api endpoint, filter by tags for software roles
2. Himalayas - Integrate /jobs/api and /jobs/api/search endpoints
3. Remotive - Integrate /api/remote-jobs with 24h delay consideration
4. We Work Remotely - Parse RSS feeds for multiple categories

### Priority 2: Investigate Further
5. Working Nomads - Test /api/exposed_jobs/ endpoint
6. DailyRemote - Investigate if API exists or scraping is feasible
7. Lemon.io - Research CIS developer market data

### Priority 3: CIS-Specific Research (New Scope)
8. Research dou.ua API/scraping feasibility
9. Research hh.ru (HeadHunter) API
10. Research habr.com/career API

---

## Appendix: API Quick Reference

### RemoteOK
curl https://remoteok.com/api
# Returns JSON array of all jobs, filter by tags for software roles

### Remotive
curl https://remotive.com/api/remote-jobs?category=software-dev&limit=100
# Categories: https://remotive.com/api/remote-jobs/categories
# Rate limit: 2x/minute, recommend 4x/day

### Himalayas
curl https://himalayas.app/jobs/api?limit=20&offset=0
curl https://himalayas.app/jobs/api/search?q=react&seniority=Senior
# Max 20 per request, OpenAPI spec: https://himalayas.app/docs/openapi.json

### We Work Remotely
curl https://weworkremotely.com/categories/remote-back-end-programming-jobs.rss
# RSS XML format with multiple category feeds

### Working Nomads
curl https://workingnomads.com/api/exposed_jobs/
# JSON API for job data
