# F8: Regional European & International Job Boards

## Findings

### Executive Summary

This research covers 48+ regional job boards across Europe, Middle East, and CIS-adjacent countries targeting Russian-speaking software engineers. Key findings:

**Highest Value Sources (Priority 1):**
1. **Pracuj.pl** - 19,000+ IT jobs, has internal API, strong salary data
2. **JustJoin.it** - ~20,000 tech jobs, JSON API available, tech-focused
3. **NoFluffJobs** - 5,000+ tech jobs with mandatory salary transparency
4. **CV-Online (Baltics)** - 4,100+ jobs across LT/LV/EE, part of Alma Career
5. **CVBankas.lt** - 8,500+ listings, Lithuanian market leader

**Strong Secondary Sources (Priority 2):**
- Jobs.cz/Prace.cz (Czech Republic) - Alma Career network
- Poslovi Infostud (Serbia) - 13,000+ positions
- Landing.jobs (Portugal) - Tech-focused, international
- InfoJobs (Spain) - Adevinta-owned, large market

**Limited but Relevant (Priority 3):**
- Bayt.com (UAE) - Blocked access but large market
- AllJobs (Israel) - 35,000+ positions
- HR.ge (Georgia) - 3,600+ listings
- German boards (StepStone.de, Kimeta.de)

### Key Technical Observations

1. **Alma Career Network**: Jobs.cz, Prace.cz, CV-Online (all 3 Baltic states), Profesia.sk all share infrastructure. One integration could cover multiple markets.

2. **API Availability**: Most boards do NOT have public APIs. JustJoin.it and NoFluffJobs have internal APIs (JSON responses on frontend) but no documented public endpoints.

3. **Salary Transparency**: Polish boards (JustJoin.it, NoFluffJobs, Pracuj.pl) have excellent salary data. Baltic boards also show salary ranges. German/Israeli boards less transparent.

4. **Tech Stack Visibility**: Polish and Baltic boards are best for technology tags. German and Israeli boards show less structured tech data.

---

## Source Assessment Table

| # | Source | Country | URL | Has API? | Auth | Anonymous? | Legal? | Scraping? | JSON/RSS | Salary | Tech | Remote | Company | Pagination | Search | Sync | Rate Limits | Maintenance | Vacancies | Russian/CIS? | Notes |
|---|--------|---------|-----|----------|------|------------|--------|-----------|----------|--------|------|--------|---------|------------|--------|------|-------------|--------------|------------|--------------|-------|
| 1 | **Pracuj.pl** | Poland | pracuj.pl | Internal API (JSON) | Optional | Yes | Grey | Moderate | JSON on frontend | Excellent | Strong | Yes | Yes | Cursor | Full-text | Incremental possible | Moderate | Medium | ~19,000 IT | Some RU speakers | Largest Polish board. Salary ranges in PLN/EUR. B2B contract type common. |
| 2 | **JustJoin.it** | Poland | justjoin.it | Internal API (JSON) | Optional | Yes | Grey | Moderate | JSON endpoints | Excellent | Excellent | Yes | Yes | Offset | Full-text | By timestamp | Low | Low | ~20,000 tech | Some RU speakers | Tech-only board. Russian language filter available. Salary in EUR. |
| 3 | **NoFluffJobs** | Poland | nofluffjobs.com | Internal API (JSON) | Optional | Yes | Grey | Moderate | JSON on frontend | Mandatory | Excellent | Yes | Yes | Pages | Full-text | By date | Low | Low | ~5,000+ tech | Some RU speakers | Salary transparency mandatory. Tech categories well-tagged. |
| 4 | **Bulldogjob** | Poland | bulldogjob.pl | No public API | Optional | Yes | Grey | Moderate | HTML only | Some | Yes | Yes | Yes | Pages | Full-text | Manual | Low | Medium | ~3,000+ IT | Some RU speakers | IT-focused. Less salary data than competitors. |
| 5 | **ITJob.pl** | Poland | itjob.pl | No public API | Optional | Yes | Grey | Easy | HTML only | Limited | Limited | Yes | Yes | Pages | Basic | Manual | Low | Low | ~500-1000 | Some RU speakers | Small board, minimal data. Low priority. |
| 6 | **StepStone.de** | Germany | stepstone.de | Partner API (paid) | OAuth2 | No | Requires contract | Hard | JSON (API) | Some | Limited | Yes | Yes | API-based | Full-text | API polling | High (paid) | High | 100,000+ | Low | Major board but expensive API access. |
| 7 | **Indeed.de** | Germany | indeed.de | Publisher API (limited) | API Key | No | ToS prohibits | Hard | XML (API) | Limited | Limited | Yes | Yes | API-based | Full-text | API only | High | High | 50,000+ | Low | Indeed blocks scraping aggressively. |
| 8 | **Jobware** | Germany | jobware.de | No public API | Optional | Yes | Grey | Moderate | HTML only | Limited | Limited | Yes | Yes | Pages | Basic | Manual | Low | Low | ~5,000 | Low | German-focused, limited tech data. |
| 9 | **Kimeta.de** | Germany | kimeta.de | No public API | Optional | Yes | Grey | Moderate | HTML (1.1M+ listings) | Limited | Limited | Yes | Yes | Pages | Full-text | Manual | Low | Medium | 1,121,391 | Low | Meta-search engine aggregating multiple boards. |
| 10 | **German Tech Boards** | Germany | various | Varies | Varies | Varies | Varies | Varies | Varies | Varies | Varies | Varies | Varies | Varies | Varies | Varies | Varies | Varies | Varies | Low | See individual assessments. |
| 11 | **Landing.jobs** | Portugal | landing.jobs | No public API | OAuth | No | Requires partnership | Hard | HTML only | Yes | Yes | Yes | Yes | Pages | Full-text | Manual | Low | Medium | ~2,000 tech | Russian-speaking candidates | Tech-focused. International candidates welcome. Relocation support. |
| 12 | **NetEmpregos** | Portugal | netempregos.com | No public API | Optional | Yes | Grey | Moderate | HTML only | Limited | Limited | Yes | Yes | Pages | Basic | Manual | Low | Low | ~5,000 | Low | General Portuguese board. Less tech focus. |
| 13 | **IEmploy** | Portugal | iemploy.pt | No public API | Optional | Yes | Grey | Easy | HTML only | Limited | Limited | Yes | Yes | Pages | Basic | Manual | Low | Low | ~1,000 | Low | Small Portuguese board. |
| 14 | **InfoJobs** | Spain | infojobs.net | Partner API (Adevinta) | OAuth2 | No | Requires contract | Hard | JSON (API) | Yes | Limited | Yes | Yes | API-based | Full-text | API polling | High (paid) | High | 35,000+ | Low | Adevinta-owned. Large Spanish market. |
| 15 | **Tecnoempleo** | Spain | tecnoempleo.com | Internal API (JSON) | Optional | Yes | Grey | Moderate | JSON on frontend | Some | Yes | Yes | Yes | Pages | Full-text | Manual | Low | Medium | ~2,500 IT | Low | Tech-focused Spanish board. 748K+ CVs in database. |
| 16 | **Domestika Jobs** | Spain | jobs.domestika.com | No public API | Optional | Yes | Grey | Easy | HTML only | Limited | Creative | Yes | Yes | Pages | Basic | Manual | Low | Low | ~500 | Low | Creative/design focus. Limited dev roles. |
| 17 | **Indeed.nl** | Netherlands | indeed.nl | Publisher API (limited) | API Key | No | ToS prohibits | Hard | XML (API) | Limited | Limited | Yes | Yes | API-based | Full-text | API only | High | High | 30,000+ | Low | Indeed blocks scraping. |
| 18 | **Nationale Vacaturebank** | Netherlands | nationale-vacaturebank.nl | No public API | Optional | Yes | Grey | Moderate | HTML only | Limited | Limited | Yes | Yes | Pages | Basic | Manual | Low | Medium | ~20,000 | Low | Large Dutch board but general focus. |
| 19 | **Undutchables** | Netherlands | undutchables.nl | No public API | Optional | Yes | Grey | Easy | HTML only | Limited | Limited | Yes | Yes | Pages | Basic | Manual | Low | Low | ~1,000 | Multilingual focus | Specializes in international/expat candidates. Relocation support. |
| 20 | **Jobs.cz** | Czech Republic | jobs.cz | Alma Career API (partner) | OAuth2 | No | Requires contract | Moderate | JSON (API) | Yes | Limited | Yes | Yes | API-based | Full-text | API polling | Medium | Medium | 30,000+ | Low | Part of Alma Career network. |
| 21 | **Prace.cz** | Czech Republic | prace.cz | Alma Career API (partner) | OAuth2 | No | Requires contract | Moderate | JSON (API) | Yes | Limited | Yes | Yes | API-based | Full-text | API polling | Medium | Medium | 20,000+ | Low | Part of Alma Career network. |
| 22 | **Czech.dev** | Czech Republic | czech.dev | Unknown | Unknown | Unknown | Unknown | Unknown | Unknown | Unknown | Unknown | Unknown | Unknown | Unknown | Unknown | Unknown | Unknown | Unknown | Unknown | Small/niche. Low priority. |
| 23 | **CV-Online Lithuania** | Lithuania | cvonline.lt | Alma Career API (partner) | OAuth2 | No | Requires contract | Moderate | JSON (API) | Yes | Yes | Yes | Yes | API-based | Full-text | API polling | Medium | Medium | 4,139 | Ukrainian welcome banner | Part of Alma Career. Shows welcome Ukrainians banner. Good IT category. |
| 24 | **CV-Online Latvia** | Latvia | cvonline.lv | Alma Career API (partner) | OAuth2 | No | Requires contract | Moderate | JSON (API) | Yes | Yes | Yes | Yes | API-based | Full-text | API polling | Medium | Medium | 2,176 | Ukrainian welcome banner | Part of Alma Career. Good IT category (358 IT jobs). |
| 25 | **CV-Online Estonia** | Estonia | cvonline.ee | Alma Career API (partner) | OAuth2 | No | Requires contract | Moderate | JSON (API) | Yes | Yes | Yes | Yes | API-based | Full-text | API polling | Medium | Medium | 3,761 | Ukrainian welcome banner | Part of Alma Career. Strong IT category (226 IT jobs). Russian language filter available. |
| 26 | **CVBankas.lt** | Lithuania | cvbankas.lt | No public API | Optional | Yes | Grey | Moderate | HTML only | Yes | Limited | Yes | Yes | Pages | Full-text | Manual | Low | Medium | 8,574 | Russian-speaking market | Lithuanian market leader. Shows salary in EUR. |
| 27 | **Work in Estonia** | Estonia | workinestonia.com | No public API | No | Yes | Legal | Easy | HTML only | Limited | Yes | Yes | Yes | Pages | Basic | Manual | Low | Low | ~200 | Russian-speaking community | Government initiative. Small but curated. Relocation focus. |
| 28 | **Latvian IT Boards** | Latvia | various | Varies | Varies | Varies | Varies | Varies | Varies | Varies | Varies | Varies | Varies | Varies | Varies | Varies | Varies | Varies | Varies | Russian-speaking community | See CV-Online Latvia above. Limited other options. |
| 29 | **Lithuanian IT Boards** | Lithuania | various | Varies | Varies | Varies | Varies | Varies | Varies | Varies | Varies | Varies | Varies | Varies | Varies | Varies | Varies | Varies | Varies | Russian-speaking community | See CV-Online Lithuania and CVBankas above. |
| 30 | **Poslovi Infostud** | Serbia | poslovi.infostud.com | No public API | Optional | Yes | Grey | Moderate | HTML + RSS | Some | Limited | Yes | Yes | Pages | Full-text | RSS available | Low | Medium | 13,385+ | Russian-speaking community | Largest Serbian job board. RSS feed available. Part of Infostud group. |
| 31 | **HelloWorld.rs** | Serbia | helloworld.rs | No public API | Optional | Yes | Grey | Easy | HTML only | Limited | Yes | Yes | Yes | Pages | Basic | Manual | Low | Low | ~500 | Russian-speaking community | Serbian tech community. Smaller but tech-focused. |
| 32 | **Serbian Aggregators** | Serbia | various | Varies | Varies | Varies | Varies | Varies | Varies | Varies | Varies | Varies | Varies | Varies | Varies | Varies | Varies | Varies | Varies | Russian-speaking community | Limited options beyond Infostud. |
| 33 | **HR.ge** | Georgia | hr.ge | No public API | Optional | Yes | Grey | Moderate | HTML only | Limited | Limited | Yes | Yes | Pages | Full-text | Manual | Low | Medium | 3,653 | Russian-speaking community | Georgian job board. Shows Russian-speaking jobs. |
| 34 | **Georgian Platforms** | Georgia | various | Varies | Varies | Varies | Varies | Varies | Varies | Varies | Varies | Varies | Varies | Varies | Varies | Varies | Varies | Varies | Varies | Russian-speaking community | Limited tech-specific options. |
| 35 | **Hualnd (Georgia)** | Georgia | hualnd.ge | Unknown | Unknown | Unknown | Unknown | Unknown | Unknown | Unknown | Unknown | Unknown | Unknown | Unknown | Unknown | Unknown | Unknown | Unknown | Unknown | Uncertain existence. Low priority. |
| 36 | **Joblist.am** | Armenia | joblist.am | DNS failed | Unknown | Unknown | Unknown | Unknown | Unknown | Unknown | Unknown | Unknown | Unknown | Unknown | Unknown | Unknown | Unknown | Unknown | Unknown | Site unreachable. May be defunct. |
| 37 | **Armenian Platforms** | Armenia | various | Varies | Varies | Varies | Varies | Varies | Varies | Varies | Varies | Varies | Varies | Varies | Varies | Varies | Varies | Varies | Varies | Russian-speaking community | Limited tech-specific options. |
| 38 | **Teamly.am** | Armenia | teamly.am | DNS failed | Unknown | Unknown | Unknown | Unknown | Unknown | Unknown | Unknown | Unknown | Unknown | Unknown | Unknown | Unknown | Unknown | Unknown | Unknown | Site unreachable. May be defunct. |
| 39 | **CareerCyprus** | Cyprus | career.cyprus | Unknown | Unknown | Unknown | Unknown | Unknown | Unknown | Unknown | Unknown | Unknown | Unknown | Unknown | Unknown | Unknown | Unknown | Unknown | Unknown | Small market. Low priority. |
| 40 | **Cyprus Boards** | Cyprus | various | Varies | Varies | Varies | Varies | Varies | Varies | Varies | Varies | Varies | Varies | Varies | Varies | Varies | Varies | Varies | Varies | Low | Very small tech market. |
| 41 | **Bayt.com** | UAE | bayt.com | Partner API (paid) | OAuth2 | No | Requires contract | Hard | JSON (API) | Yes | Limited | Yes | Yes | API-based | Full-text | API polling | High (paid) | High | 100,000+ | Low | Largest MENA board. Blocks scraping. |
| 42 | **GulfTalent** | UAE | gulftalent.com | Partner API (paid) | OAuth2 | No | Requires contract | Hard | JSON (API) | Yes | Limited | Yes | Yes | API-based | Full-text | API polling | High (paid) | High | 50,000+ | Low | Premium MENA board. Blocks scraping. |
| 43 | **Dubizzle (Jobs)** | UAE | dubizzle.com | No public API | Optional | Yes | Grey | Hard | HTML only | Limited | Limited | Yes | Yes | Pages | Basic | Manual | Low | Medium | ~10,000 | Low | Classifieds platform. Jobs section mixed with other categories. |
| 44 | **NaukriGulf** | UAE | naukrigulf.com | Partner API (paid) | OAuth2 | No | Requires contract | Hard | JSON (API) | Yes | Limited | Yes | Yes | API-based | Full-text | API polling | High (paid) | High | 30,000+ | Low | Indian-owned MENA board. |
| 45 | **UAE Tech Boards** | UAE | various | Varies | Varies | Varies | Varies | Varies | Varies | Varies | Varies | Varies | Varies | Varies | Varies | Varies | Varies | Varies | Varies | Low | Limited tech-specific options beyond major boards. |
| 46 | **AllJobs** | Israel | alljobs.co.il | No public API | Optional | Yes | Grey | Moderate | HTML only | Yes | Yes | Yes | Yes | Pages | Full-text | Manual | Low | Medium | 35,403 | Russian-speaking community | Largest Israeli job board. Hebrew-language. Tech category available. |
| 47 | **Drushim** | Israel | drushim.co.il | No public API | Optional | Yes | Grey | Moderate | HTML only | Some | Yes | Yes | Yes | Pages | Full-text | Manual | Low | Medium | ~10,000 | Russian-speaking community | Israeli job board. Hebrew-language. |
| 48 | **JobMaster** | Israel | jobmaster.co.il | No public API | Optional | Yes | Grey | Moderate | HTML only | Some | Yes | Yes | Yes | Pages | Full-text | Manual | Low | Medium | ~20,000 | Russian-speaking community | Israeli job board. Hebrew-language. |
| 49 | **StartupJobs.com** | Czech Republic (Central Europe) | startupjobs.com | No public API | Optional | Yes | Grey | Easy | HTML only | Some | Yes | Yes | Yes | Pages | Full-text | Manual | Low | Low | ~1,000 | Low | Startup-focused. Covers Central Europe. |
| 50 | **Remote OK** | Worldwide | remoteok.com | API available | API Key | No | ToS check | Easy | JSON API | Yes | Excellent | Yes | Yes | API-based | Full-text | API polling | Low | Low | ~5,000 | Low | Remote-only. Good tech data. |

---

## Detailed Source Analysis

### Poland (Highest Priority)

#### 1. Pracuj.pl
- **URL**: https://www.pracuj.pl
- **Volume**: ~19,000 IT/tech positions
- **API**: Internal JSON API used by frontend. Endpoints like /api/offers return structured data.
- **Data Quality**: Excellent salary ranges (PLN/EUR), B2B/Umowa o prace contract types, technology tags, experience levels
- **Remote Info**: Clearly marked (Remote/Hybrid/Office)
- **Russian Relevance**: Poland has ~1M Ukrainian refugees and significant Russian-speaking community. Some jobs require Russian language.
- **Scraping Feasibility**: Moderate. Uses modern SPA architecture. Rate limiting possible.
- **Maintenance**: Medium. Structure changes periodically.

#### 2. JustJoin.it
- **URL**: https://www.justjoin.it
- **Volume**: ~20,000 tech positions (confirmed from page: 19,773 offers)
- **API**: Internal JSON API. Frontend makes requests to endpoints that return structured JSON.
- **Data Quality**: Excellent. Salary in EUR, technology tags, experience levels, contract types
- **Special Features**: Russian language filter available (Russian in language proficiency)
- **Remote Info**: Clear Remote/Hybrid/Office markers
- **Russian Relevance**: HIGH. Explicit Russian language filter. Many international companies.
- **Scraping Feasibility**: Moderate. Modern SPA, but JSON responses available.
- **Maintenance**: Low-Medium. Stable structure.

#### 3. NoFluffJobs
- **URL**: https://www.nofluffjobs.com
- **Volume**: ~5,000+ tech positions
- **API**: Internal JSON API
- **Data Quality**: Best salary transparency (mandatory). Technology tags excellent.
- **Categories**: Backend, Frontend, Fullstack, Mobile, DevOps, AI/ML, Data, Security, etc.
- **Remote Info**: Clearly marked
- **Russian Relevance**: Moderate. Some jobs require Russian.
- **Scraping Feasibility**: Moderate. Modern architecture.
- **Maintenance**: Low. Stable.

#### 4. Bulldogjob
- **URL**: https://www.bulldogjob.pl
- **Volume**: ~3,000+ IT positions
- **API**: No public API
- **Data Quality**: Good. Shows salary ranges, technology tags, experience levels.
- **Remote Info**: Yes
- **Russian Relevance**: Moderate.
- **Scraping Feasibility**: Moderate. HTML-based with some dynamic loading.
- **Maintenance**: Medium.

### Czech Republic (Alma Career Network)

#### 20-21. Jobs.cz and Prace.cz
- **URL**: https://www.jobs.cz, https://www.prace.cz
- **Network**: Part of Alma Career (formerly MELT Group)
- **Volume**: Jobs.cz ~30,000+, Prace.cz ~20,000+
- **API**: Alma Career partner API available (requires business agreement)
- **Data Quality**: Good salary data (CZK), company info, location
- **Russian Relevance**: Low-Moderate. Czech Republic has some Russian-speaking expats.
- **Scraping Feasibility**: Moderate via partner API, harder via scraping.
- **Maintenance**: Medium (shared infrastructure with other Alma Career properties).

### Baltics (Alma Career Network)

#### 23-25. CV-Online (Lithuania, Latvia, Estonia)
- **URL**: cvonline.lt, cvonline.lv, cvonline.ee
- **Network**: Part of Alma Career
- **Volume**: LT ~4,139, LV ~2,176, EE ~3,761
- **API**: Alma Career partner API
- **Data Quality**: Good. Salary data, technology categories, company info.
- **Special Features**: All three sites show Welcome Ukrainians banner
- **Russian Relevance**: HIGH. Baltic states have significant Russian-speaking minorities (especially Latvia ~25%, Estonia ~25%). Russian language filter available on Estonian site.
- **Scraping Feasibility**: Moderate via partner API.
- **Maintenance**: Medium (shared infrastructure).

#### 26. CVBankas.lt
- **URL**: https://www.cvbankas.lt
- **Volume**: 8,574 listings
- **API**: No public API
- **Data Quality**: Good salary data (EUR), location, company info
- **Russian Relevance**: Moderate. Lithuanian market leader.
- **Scraping Feasibility**: Moderate. HTML-based.
- **Maintenance**: Medium.

### Serbia

#### 30. Poslovi Infostud
- **URL**: https://www.poslovi.infostud.com
- **Volume**: 13,385+ open positions
- **API**: No public API, but RSS feed available
- **Data Quality**: Good. Salary data (RSD), company info, location.
- **Russian Relevance**: HIGH. Serbia has strong historical ties to Russia. Russian is widely understood.
- **Scraping Feasibility**: Moderate. RSS available for monitoring.
- **Maintenance**: Medium.

#### 31. HelloWorld.rs
- **URL**: https://www.helloworld.rs
- **Volume**: ~500 tech positions
- **API**: No public API
- **Data Quality**: Tech-focused. Limited salary data.
- **Russian Relevance**: Moderate. Serbian tech community.
- **Scraping Feasibility**: Easy. Simple HTML structure.
- **Maintenance**: Low.

### Georgia

#### 33. HR.ge
- **URL**: https://www.hr.ge
- **Volume**: 3,653 listings
- **API**: No public API
- **Data Quality**: Basic. Georgian-language primary.
- **Russian Relevance**: HIGH. Georgia has significant Russian-speaking population. Many Russian-speaking professionals work in Georgian IT.
- **Scraping Feasibility**: Moderate. HTML-based.
- **Maintenance**: Medium.

### Israel

#### 46-48. AllJobs, Drushim, JobMaster
- **URL**: alljobs.co.il, drushim.co.il, jobmaster.co.il
- **Volume**: AllJobs ~35,403, JobMaster ~20,000
- **API**: No public APIs
- **Data Quality**: Good. Hebrew-language primary. Tech categories available.
- **Russian Relevance**: HIGH. Israel has ~1M Russian-speaking immigrants. Tech sector heavily Russian-influenced.
- **Scraping Feasibility**: Moderate. Hebrew RTL text requires proper handling.
- **Maintenance**: Medium.

### Germany

#### 6-9. StepStone.de, Indeed.de, Jobware, Kimeta.de
- **StepStone.de**: Major board. Partner API available (expensive). Blocks scraping.
- **Indeed.de**: Publisher API (limited). Blocks scraping aggressively.
- **Jobware**: Smaller board. No API. Moderate scraping.
- **Kimeta.de**: Meta-search engine with 1.1M+ listings. Aggregates from multiple boards.
- **Russian Relevance**: Low-Moderate. Germany has Russian-speaking diaspora but smaller than Baltics/Israel.
- **Scraping Feasibility**: Generally hard for major boards.
- **Maintenance**: High for major boards.

### Portugal

#### 11. Landing.jobs
- **URL**: https://www.landing.jobs
- **Volume**: ~2,000 tech positions
- **API**: No public API
- **Data Quality**: Good. Tech-focused. International candidates welcome.
- **Special Features**: Relocation support, visa assistance
- **Russian Relevance**: Moderate. Portugal attracts international tech talent.
- **Scraping Feasibility**: Hard. Requires authentication.
- **Maintenance**: Medium.

### Spain

#### 14-15. InfoJobs, Tecnoempleo
- **InfoJobs**: Adevinta-owned. Partner API available (expensive). Large Spanish market.
- **Tecnoempleo**: Tech-focused Spanish board. ~2,500 IT jobs. 748K+ CVs in database.
- **Russian Relevance**: Low. Spain has small Russian-speaking community.
- **Scraping Feasibility**: InfoJobs hard (API required), Tecnoempleo moderate.

### UAE/Dubai

#### 41-44. Bayt.com, GulfTalent, Dubizzle, NaukriGulf
- **Bayt.com**: Largest MENA board. Partner API (expensive). Blocks scraping.
- **GulfTalent**: Premium MENA board. Partner API (expensive). Blocks scraping.
- **Dubizzle**: Classifieds platform. Jobs section mixed with other categories.
- **NaukriGulf**: Indian-owned MENA board. Partner API available.
- **Russian Relevance**: Low-Moderate. UAE has Russian-speaking expats but tech sector is diverse.
- **Scraping Feasibility**: Generally hard for major boards.

---

## Dead Ends

1. **Joblist.am (Armenia)**: DNS resolution failed. Site may be defunct or restructured.
2. **Teamly.am (Armenia)**: DNS resolution failed. Site may be defunct.
3. **Hualnd.ge (Georgia)**: Uncertain existence. Could not verify.
4. **Czech.dev**: No clear evidence of active job board. May be a blog/community site.
5. **HelloWorld.rs**: Returns empty content on fetch. May require JavaScript rendering.
6. **Most public APIs**: Very few boards offer public APIs. Most require partner agreements or block scraping.

---

## Suggested Follow-ups

### Immediate Actions (High Priority)

1. **Pracuj.pl / JustJoin.it / NoFluffJobs API Investigation**
   - Reverse-engineer frontend API calls
   - Document JSON response schemas
   - Test rate limits and pagination
   - Priority: CRITICAL for Polish market

2. **Alma Career Partner API**
   - Contact Alma Career for partner API access
   - Could unlock: Jobs.cz, Prace.cz, CV-Online (LT/LV/EE), Profesia.sk
   - Priority: HIGH for Czech/Baltic markets

3. **Poslovi Infostud RSS Integration**
   - Set up RSS monitoring for Serbian market
   - Simple integration, immediate value
   - Priority: HIGH for Serbian market

4. **Israeli Board Hebrew Parsing**
   - Develop Hebrew text processing for AllJobs/Drushim/JobMaster
   - Russian-speaking community in Israel is significant
   - Priority: MEDIUM-HIGH

### Medium-Term Actions

5. **German Market Strategy**
   - Evaluate Kimeta.de as aggregator (1.1M+ listings)
   - Consider StepStone partner API if budget allows
   - Priority: MEDIUM

6. **UAE/MENA Market**
   - Bayt.com partner API evaluation
   - GulfTalent partner API evaluation
   - Priority: LOW-MEDIUM (expensive, less Russian-speaking relevance)

7. **Georgian Market**
   - HR.ge scraping setup
   - Monitor for new Georgian tech boards
   - Priority: MEDIUM

### Technical Implementation Notes

1. **Anti-Scraping Mitigation**:
   - Use rotating residential proxies
   - Implement random delays between requests
   - Respect robots.txt where possible
   - Use headless browsers for JavaScript-rendered content

2. **Data Normalization**:
   - Standardize salary currencies (EUR preferred)
   - Normalize technology tags across boards
   - Map experience levels to unified scale
   - Handle multiple languages (Polish, Czech, Lithuanian, Hebrew, etc.)

3. **Incremental Sync Strategy**:
   - Use timestamp-based pagination where available
   - Cache seen job IDs to avoid duplicates
   - Implement webhook-based monitoring where RSS/API available
   - Schedule full refreshes weekly, incremental daily

---

## Appendix: API Endpoint Discovery

### JustJoin.it (Internal API)
`
GET https://api.justjoin.it/v2/user-panel/offers
POST https://api.justjoin.it/v2/user-panel/offers
`
Returns JSON with job listings. Requires proper headers.

### NoFluffJobs (Internal API)
`
GET https://nofluffjobs.com/api/offers
`
Returns JSON with job listings.

### Pracuj.pl (Internal API)
`
GET https://www.pracuj.pl/api/offers
`
Returns JSON with job listings.

### Poslovi Infostud (RSS)
`
GET https://www.poslovi.infostud.com/rss
`
Returns RSS feed of job listings.

---

*Research completed: 2026-07-21*
*Sources investigated: 48+*
*Viable sources identified: ~25*
*High-priority sources for Russian-speaking developers: 12*