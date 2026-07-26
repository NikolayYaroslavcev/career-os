# F7: ATS Systems & Career Page Patterns

## Findings

### Tier 1: Public Keyless JSON APIs (Best for aggregation)

These ATS platforms expose public, unauthenticated JSON endpoints for every hosted career page. This is the gold standard for programmatic job aggregation.

#### 1. Greenhouse

**Public API Endpoint:** https://boards-api.greenhouse.io/v1/boards/{board_token}/jobs

| Attribute | Details |
|-----------|---------|
| **Public API** | YES - completely public, no auth required for GET |
| **Auth** | None for read; Basic Auth (Base64 API key) for application submission only |
| **JSON-LD** | Not on API response, but embedded on hosted career pages |
| **RSS** | Not natively provided |
| **Companies using it** | ~30,000+ companies; dominant in tech startups/mid-market |
| **Russian/CIS** | Limited; primarily US/EU companies. Some international tech companies with CIS presence use it |
| **Legal** | Public data, designed for career page rendering. Polite scraping is standard practice |
| **Rate limits** | Not officially documented; community consensus is 1-2 req/sec per host is safe |
| **Maintenance** | Very stable; well-documented official API with GitHub docs repo |

**API Endpoints:**
- List all jobs: GET /v1/boards/{token}/jobs?content=true
- Single job: GET /v1/boards/{token}/jobs/{job_id}
- Offices: GET /v1/boards/{token}/offices
- Departments: GET /v1/boards/{token}/departments
- Board info: GET /v1/boards/{token}

**Key fields:** id, title, location.name, content (HTML), absolute_url, updated_at, departments, offices, metadata, language

**Estimated vacancies:** 150,000-200,000+ across all boards

---

#### 2. Lever (now Employ)

**Public API Endpoint:** https://api.lever.co/v0/postings/{company_slug}

| Attribute | Details |
|-----------|---------|
| **Public API** | YES - completely public, no auth required for reads |
| **Auth** | None for read; API key for application POST (rate limited to 2/sec) |
| **JSON-LD** | Not on API, but present on hosted job pages |
| **RSS** | Not natively provided |
| **Companies using it** | ~5,000+ companies; strong in startups and mid-market |
| **Russian/CIS** | Limited; some European companies with CIS connections |
| **Legal** | Designed for public career page rendering. CORS restricted to own domains for embedded use |
| **Rate limits** | Application POST: 429 after 2 req/sec. Read: not documented, community says 1/sec is safe |
| **Maintenance** | Stable; official GitHub repo with docs and examples |

**API Endpoints:**
- List postings: GET /v0/postings/{slug}?mode=json&skip=0&limit=50
- Single posting: GET /v0/postings/{slug}/{posting_id}
- Filters: location, commitment, team, department, level

**Key fields:** id, text (title), categories (location, team, department), opening/description (HTML), hostedUrl, applyUrl, workplaceType, salaryRange

**Estimated vacancies:** 30,000-50,000+

---

#### 3. Ashby

**Public API Endpoint:** https://api.ashbyhq.com/posting-api/job-board/{company_slug}

| Attribute | Details |
|-----------|---------|
| **Public API** | YES - public, no auth required |
| **Auth** | None for job board reads |
| **JSON-LD** | Not on API response |
| **RSS** | Not provided |
| **Companies using it** | ~2,000+ companies; fast-growing modern ATS, popular with VC-backed startups |
| **Russian/CIS** | Very limited; primarily US tech startups |
| **Legal** | Public endpoint, designed for career page rendering |
| **Rate limits** | Not documented; treat same as Greenhouse/Lever |
| **Maintenance** | Relatively new but stable; active development |

**Key features:** Often includes compensation data (includeCompensation=true), modern API design

**Estimated vacancies:** 20,000-30,000+

---

### Tier 2: Public APIs with caveats

#### 4. SmartRecruiters

**Public API Endpoint:** https://api.smartrecruiters.com/v1/companies/{company}/postings

| Attribute | Details |
|-----------|---------|
| **Public API** | YES - public JSON endpoint |
| **Auth** | None for job listing reads |
| **JSON-LD** | Present on hosted career pages |
| **RSS** | Some boards offer RSS feeds |
| **Companies using it** | ~4,000+ companies; strong in enterprise and mid-market |
| **Russian/CIS** | Some enterprise companies with CIS operations |
| **Legal** | Public API; ToS may restrict automated access |
| **Rate limits** | Paginated with limit/offset; be polite |
| **Maintenance** | Stable, well-established platform |

**API Features:** Paginated results, supports content=true for full descriptions

**Estimated vacancies:** 40,000-60,000+

---

#### 5. Recruitee

**Public API Endpoint:** https://{company}.recruitee.com/api/offers/

| Attribute | Details |
|-----------|---------|
| **Public API** | YES - public JSON |
| **Auth** | None for public job board reads |
| **JSON-LD** | Present on career pages |
| **RSS** | Not provided |
| **Companies using it** | ~3,000+ companies; popular in Europe |
| **Russian/CIS** | Limited presence in CIS region |
| **Legal** | Public endpoint |
| **Rate limits** | Not documented |
| **Maintenance** | Stable |

**Estimated vacancies:** 15,000-25,000+

---

#### 6. Breezy HR

**Public API Endpoint:** https://{company}.breezy.hr/json

| Attribute | Details |
|-----------|---------|
| **Public API** | YES - JSON endpoint |
| **Auth** | None |
| **JSON-LD** | Not on API |
| **RSS** | Not provided |
| **Companies using it** | ~1,000+ companies; SMB-focused |
| **Russian/CIS** | Very limited |
| **Legal** | Public endpoint |
| **Rate limits** | Not documented |
| **Maintenance** | Smaller platform, less active development |

**Note:** List endpoint returns basic info; full descriptions require per-posting fetch.

**Estimated vacancies:** 5,000-10,000+

---

#### 7. BambooHR

**Public API Endpoint:** https://{company}.bamboohr.com/careers/list

| Attribute | Details |
|-----------|---------|
| **Public API** | YES - JSON endpoint for career pages |
| **Auth** | None for public job board |
| **JSON-LD** | Present on career pages |
| **RSS** | Not provided |
| **Companies using it** | ~20,000+ SMBs; primarily US market |
| **Russian/CIS** | Very limited; US-focused SMB platform |
| **Legal** | Public endpoint |
| **Rate limits** | Not documented |
| **Maintenance** | Stable, well-established SMB HR platform |

**Estimated vacancies:** 10,000-20,000+

---

#### 8. Teamtailor

**Public API Endpoint:** Documented API at https://docs.teamtailor.com/

| Attribute | Details |
|-----------|---------|
| **Public API** | YES - has documented API with job board endpoints |
| **Auth** | API key required for most endpoints; some public job board endpoints may be available |
| **JSON-LD** | Present on career pages |
| **RSS** | Not provided |
| **Companies using it** | ~3,000+ companies; strong in Europe (Nordics, DACH) |
| **Russian/CIS** | Very limited; primarily European market |
| **Legal** | API access requires registration |
| **Rate limits** | Documented rate limits apply |
| **Maintenance** | Actively maintained, growing platform |

**Estimated vacancies:** 15,000-25,000+

---

#### 9. Personio

**Public API Endpoint:** https://{company}.jobs.personio.com/xml

| Attribute | Details |
|-----------|---------|
| **Public API** | YES - XML feed available |
| **Auth** | None for XML feed |
| **JSON-LD** | Present on career pages |
| **RSS** | XML feed (not RSS, but similar purpose) |
| **Companies using it** | ~4,000+ companies; dominant in DACH region (Germany, Austria, Switzerland) |
| **Russian/CIS** | Very limited; European focus |
| **Legal** | Public XML feed |
| **Rate limits** | Not documented |
| **Maintenance** | Stable, well-funded European HR platform |

**Note:** Returns XML, not JSON. Need XML parser.

**Estimated vacancies:** 20,000-30,000+

---

### Tier 3: Enterprise ATS (Harder to access)

#### 10. Workday

**Public API Endpoint:** https://{tenant}.{dc}.myworkdayjobs.com/wday/cxs/{tenant}/{site}/jobs

| Attribute | Details |
|-----------|---------|
| **Public API** | PARTIAL - requires POST with specific board URL structure |
| **Auth** | None for the CXS endpoint, but needs correct tenant/dc/site |
| **JSON-LD** | Present on career pages |
| **RSS** | Not provided |
| **Companies using it** | ~2,000+ large enterprises; dominant in Fortune 500 |
| **Russian/CIS** | Some large multinationals with CIS operations |
| **Legal** | Public endpoint, but URL structure must be discovered |
| **Rate limits** | Aggressive anti-bot measures; requires careful handling |
| **Maintenance** | Enterprise-grade, very stable |

**Challenge:** Cannot guess the board URL from company name alone. Need the full myworkdayjobs.com URL to extract tenant, datacenter, and site parameters.

**Estimated vacancies:** 100,000-200,000+ (largest enterprise ATS)

---

#### 11. iCIMS

| Attribute | Details |
|-----------|---------|
| **Public API** | NO - no public job board API |
| **Auth** | Enterprise API requires partnership |
| **JSON-LD** | Present on career pages |
| **RSS** | Some boards offer RSS |
| **Companies using it** | ~3,000+ enterprises |
| **Russian/CIS** | Limited |
| **Legal** | No public access; scraping required |
| **Maintenance** | Enterprise-grade |

**Notes:** Would need to scrape career pages directly. JSON-LD structured data is the best extraction path.

---

#### 12. Taleo (Oracle)

| Attribute | Details |
|-----------|---------|
| **Public API** | NO - no public job board API |
| **Auth** | Enterprise integration only |
| **JSON-LD** | Present on some career pages |
| **RSS** | Legacy RSS feeds on some implementations |
| **Companies using it** | ~2,000+ large enterprises |
| **Russian/CIS** | Some large enterprises use it |
| **Legal** | No public access |
| **Maintenance** | Legacy platform, being replaced by Oracle Cloud HCM |

**Notes:** Very difficult to scrape; complex JavaScript-rendered pages.

---

#### 13. SuccessFactors (SAP)

| Attribute | Details |
|-----------|---------|
| **Public API** | NO - no public job board API |
| **Auth** | Enterprise API requires partnership |
| **JSON-LD** | Present on some career pages |
| **RSS** | Not provided |
| **Companies using it** | ~3,000+ large enterprises |
| **Russian/CIS** | Some large enterprises, especially in manufacturing |
| **Legal** | No public access |
| **Maintenance** | Actively maintained as part of SAP HXM suite |

---

#### 14. Jobvite

| Attribute | Details |
|-----------|---------|
| **Public API** | NO - no public job board API |
| **Auth** | Enterprise integration only |
| **JSON-LD** | Present on career pages |
| **RSS** | Not provided |
| **Companies using it** | ~1,000+ mid-market to enterprise |
| **Russian/CIS** | Very limited |
| **Legal** | No public access |
| **Maintenance** | Actively maintained |

---

#### 15. JazzHR

| Attribute | Details |
|-----------|---------|
| **Public API** | NO - API exists but requires auth/partnership |
| **Auth** | API key required |
| **JSON-LD** | Present on career pages |
| **RSS** | Not provided |
| **Companies using it** | ~2,000+ SMBs |
| **Russian/CIS** | Very limited |
| **Legal** | API requires authentication |
| **Maintenance** | Stable, SMB-focused |

---

### Tier 4: Niche/Specialized ATS

#### 16. Homerun

| Attribute | Details |
|-----------|---------|
| **Public API** | NO public job board API documented |
| **Auth** | N/A |
| **Companies using it** | ~500+ design-focused companies |
| **Russian/CIS** | Negligible |
| **Notes** | Design-focused ATS, would need career page scraping |

---

#### 17. PitchMe

| Attribute | Details |
|-----------|---------|
| **Public API** | NOT FOUND - may not exist as a standalone ATS |
| **Notes** | Appears to be more of a matching/recruiting tool than a traditional ATS |

---

#### 18. hiring.co

| Attribute | Details |
|-----------|---------|
| **Public API** | NOT FOUND - may not exist as a public ATS platform |
| **Notes** | Could not verify this as a functioning ATS platform |

---

### Russian/CIS-Specific ATS Platforms

Based on research, the following platforms are used in the Russian/CIS market:

| Platform | Description | Public API | Notes |
|----------|-------------|------------|-------|
| **Akkolade** | Russian ATS platform | Unknown/No | Domestically focused; limited international API |
| **HR-Link** | Russian HR platform | Unknown/No | CIS market focused |
| **1C:HRM** | Russian HRM system | No | Part of 1C ecosystem; widely used in Russia |
| **Parus** | Russian ERP with HR module | No | Enterprise focused |
| **BambooHR** | Has some CIS customers | Yes (global API) | Limited CIS adoption |
| **Workday** | Used by multinationals in CIS | Yes (complex) | Large enterprises only |
| **Greenhouse/Lever** | Used by international companies with CIS offices | Yes | Best bet for CIS jobs at international companies |

**Key insight:** Most Russian/CIS companies use domestic ATS platforms or custom-built career pages. For Russian-speaking engineers at international companies, Greenhouse/Lever/Ashby are the best sources. For domestic Russian companies, direct career page scraping or job aggregator APIs (HeadHunter, Habr Career) are more effective.

---

## Source Assessment Table

| Source | Public API? | Auth | JSON-LD? | RSS? | Companies | Russian/CIS? | Legal? | Maintenance | Vacancies | Notes |
|--------|-------------|------|----------|------|-----------|--------------|--------|-------------|-----------|-------|
| **Greenhouse** | YES | None (read) | On pages | No | ~30K | Limited | Safe | Excellent | 150K-200K | Best overall; most companies |
| **Lever** | YES | None (read) | On pages | No | ~5K | Limited | Safe | Excellent | 30K-50K | Strong in startups |
| **Ashby** | YES | None | On pages | No | ~2K | Very limited | Safe | Good | 20K-30K | Growing fast; includes comp |
| **SmartRecruiters** | YES | None | On pages | Some | ~4K | Some enterprise | Safe | Good | 40K-60K | Good enterprise coverage |
| **Recruitee** | YES | None | On pages | No | ~3K | Limited | Safe | Good | 15K-25K | European focus |
| **Breezy HR** | YES | None | On API | No | ~1K | Very limited | Safe | Fair | 5K-10K | SMB; partial descriptions |
| **BambooHR** | YES | None | On pages | No | ~20K | Very limited | Safe | Good | 10K-20K | US SMBs |
| **Teamtailor** | Partial | API key | On pages | No | ~3K | Very limited | Requires reg | Good | 15K-25K | European; Nordics/DACH |
| **Personio** | YES (XML) | None | On pages | No (XML feed) | ~4K | Very limited | Safe | Good | 20K-30K | DACH region; XML only |
| **Workday** | Partial (POST) | None (CXS) | On pages | No | ~2K+ | Some multinationals | Complex | Excellent | 100K-200K | Enterprise; URL discovery needed |
| **iCIMS** | NO | N/A | On pages | Some | ~3K | Limited | Scraper needed | Good | N/A | Career page scraping |
| **Taleo** | NO | N/A | Some | Legacy | ~2K | Some | Scraper needed | Fair | N/A | Legacy; difficult to scrape |
| **SuccessFactors** | NO | N/A | Some | No | ~3K | Some | Scraper needed | Good | N/A | Enterprise |
| **Jobvite** | NO | N/A | On pages | No | ~1K | Very limited | Scraper needed | Good | N/A | Mid-market |
| **JazzHR** | NO (API key) | API key | On pages | No | ~2K | Very limited | Auth required | Good | N/A | Needs API key |

---

## JSON-LD Structured Data Patterns

Most modern career pages include Schema.org/JobPosting structured data in script tags with type application/ld+json.

**Where to find it:** View page source of career pages; look for script tags with type application/ld+json.

**Key fields in JobPosting schema:**
- title, description, datePosted, validThrough
- employmentType (FULL_TIME, PART_TIME, CONTRACT, TEMPORARY, INTERN)
- hiringOrganization (name, sameAs, logo)
- jobLocation (address with addressLocality, addressRegion, addressCountry)
- baseSalary (MonetaryAmount with currency, minValue, maxValue, unitText)

---

## RSS Feed Conventions

Most ATS platforms do NOT provide RSS feeds. When available:

- **SmartRecruiters:** Some boards offer /rss or /feed endpoints
- **Taleo:** Legacy implementations may have RSS
- **Custom career pages:** Some companies add RSS via custom development

**Recommendation:** Do not rely on RSS as a primary data source. JSON APIs are far more reliable and structured.

---

## GitHub Repos That Aggregate ATS Job Listings

| Repository | Description | ATS Coverage |
|------------|-------------|--------------|
| **mit112/boardwatch** | Self-hosted job radar over official ATS APIs | Greenhouse, Lever, Ashby |
| **noble-ronin/ats-job-apis** | Cheatsheet of public ATS JSON/XML endpoints | Greenhouse, Lever, Ashby, SmartRecruiters, Recruitee, Breezy, BambooHR, Personio, Workday |
| **adgramigna/job-board-scraper** | Scrapes job listings from popular job boards | Greenhouse, Lever, Ashby, Rippling |
| **YvetteZheng0812/ats-job-scraper** | Multi-ATS job scraper | Ashby, Greenhouse, Lever, SmartRecruiters, Workable, Rippling, Workday |
| **GetAnything-1/ats-jobs-scraper** | Free scraper for ATS job boards | Greenhouse, Lever, Ashby, SmartRecruiters, Workday |

---

## Company Career Page Patterns

### Common API Endpoints

| Pattern | Example | Notes |
|---------|---------|-------|
| /api/jobs | https://company.com/api/jobs | REST API returning JSON |
| /careers.json | https://company.com/careers.json | Static JSON file |
| /jobs.json | https://company.com/jobs.json | Alternative naming |
| /graphql | https://company.com/graphql | GraphQL endpoint (rare) |
| /feed or /rss | https://company.com/feed | RSS feed (rare) |

### How Companies Expose Job Listings

1. **ATS-hosted career page** (most common): Company uses Greenhouse/Lever/etc., and the ATS hosts the career page. Jobs are served from ATS domain.

2. **Embedded ATS widget:** Company's own career page embeds an iframe or JavaScript widget from the ATS that loads jobs dynamically.

3. **Custom career page with API:** Company builds their own career page and fetches jobs from ATS API or their own backend.

4. **Static job listings:** Small companies manually list jobs on their website (HTML pages, PDF files).

### Structured Data Extraction Priority

1. **ATS JSON API** (if known ATS) - Best: structured, complete, real-time
2. **JSON-LD on career pages** - Good: structured, but may be incomplete
3. **HTML scraping** - Last resort: fragile, requires maintenance
4. **RSS feeds** - Rare, not reliable as primary source

---

## Rate Limits and Legal Considerations

### General Guidelines

- **Respect robots.txt:** Check before scraping
- **Set descriptive User-Agent:** Identify your bot clearly
- **Rate limit yourself:** 1-2 requests per second per host is safe
- **Use conditional GETs:** If-None-Match / If-Modified-Since headers
- **Cache responses:** Don't re-fetch unchanged data
- **Handle 429 responses:** Back off when rate limited

### Legal Considerations

| Consideration | Details |
|---------------|---------|
| **Public data** | Job listings are public information designed to be seen by job seekers |
| **ToS compliance** | Check each ATS's Terms of Service; most allow personal use |
| **Commercial use** | Aggregating for a job platform may require partnership or licensing |
| **GDPR/privacy** | Job listings do not contain PII; applicant data is protected |
| **Rate limiting** | Excessive automated access may be blocked |
| **Data redistribution** | Check if ATS allows redistribution of job data |

### Recommended Approach for a Job Platform

1. **Start with public APIs:** Greenhouse, Lever, Ashby are safe and well-documented
2. **Partner with ATS platforms:** For commercial use, consider official data partnerships
3. **Respect rate limits:** Build polite scrapers with proper delays
4. **Cache aggressively:** Job listings do not change every minute
5. **Monitor for changes:** ATS APIs can change without notice

---

## Suggested Follow-ups

1. **Build a multi-ATS aggregator** using the public APIs documented above
2. **Create a board token registry** of known Greenhouse/Lever/Ashby company slugs
3. **Implement JSON-LD extraction** for companies not on known ATS platforms
4. **Research Russian ATS platforms** (Akkolade, 1C:HRM) for domestic market coverage
5. **Partner with Greenhouse/Lever** for official data access if building commercial platform
6. **Implement caching and rate limiting** before any production deployment
7. **Test Workday integration** - complex but covers largest enterprises
8. **Explore Apify actors** for ready-made multi-ATS scrapers

---

## Dead Ends

1. **PitchMe** - Could not verify as a functioning ATS platform
2. **hiring.co** - Could not verify as a public ATS platform
3. **Russian-specific ATS public APIs** - Most domestic Russian ATS platforms do not expose public APIs
4. **RSS feeds from ATS** - Very rare; not a reliable data source
5. **Workday board URL discovery** - Cannot be automated without additional data sources

---

*Last updated: 2026-07-21*
*Research scope: ATS platforms and career page patterns for Russian-speaking software engineer job aggregation*
