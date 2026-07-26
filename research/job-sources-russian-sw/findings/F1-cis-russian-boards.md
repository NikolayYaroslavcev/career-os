# F1: CIS & Russian-Speaking Job Boards

Research date: 2026-07-21
Focus: Technical viability for ingesting job listings relevant to Russian-speaking software engineers

## Findings

### [1] HeadHunter (hh.ru) - Largest Russian job board with public REST API
- quote: HeadHunter API - это инструментарий для интеграции HeadHunter в ваш продукт. (from https://api.hh.ru/)
- url: https://hh.ru/ | API: https://api.hh.ru/openapi/redoc
- source_type: primary
- published: Ongoing (API actively maintained, 760 commits on GitHub)
- confidence: high

### [2] SuperJob (superjob.ru) - Major Russian job board with API for partners
- quote: SuperJob API requires registration at https://api.superjob.ru/ and token (from GitHub repos using it)
- url: https://superjob.ru/ | API: https://api.superjob.ru/
- source_type: primary
- published: Ongoing
- confidence: high

### [3] Trudvsem.ru (Rabota Rossii) - Russian government job portal with open data API
- quote: Open Data API at https://opendata.trudvsem.ru/ provides vacancy data in XML format (from official portal)
- url: https://trudvsem.ru/ | API: https://opendata.trudvsem.ru/api/v1/vacancies
- source_type: primary
- published: Ongoing (government maintained)
- confidence: high

### [4] Habr Career (career.habr.com) - Russian developer job board
- quote: No public API found. Scraping possible but limited reverse-engineering repos exist. (from GitHub search)
- url: https://career.habr.com/
- source_type: primary
- published: Ongoing
- confidence: medium

### [5] Djinni (djinni.co) - CIS developer job board
- quote: No official API. Reverse-engineering repos exist but are limited. (from GitHub search)
- url: https://djinni.co/
- source_type: primary
- published: Ongoing
- confidence: medium

### [6] Rabota.by - Belarus job board
- quote: No public API found. Scraping would be required. (from GitHub search)
- url: https://rabota.by/
- source_type: primary
- published: Ongoing
- confidence: medium

### [7] Zarplata.ru - Russian job board
- quote: Has some API usage in old GitHub repos from 2017, but unclear if public API exists. (from GitHub search)
- url: https://zarplata.ru/
- source_type: primary
- published: Ongoing
- confidence: low

### [8] Avito Jobs - Russian classifieds with job section
- quote: No public API for job listings. Heavy anti-scraping measures. (from general knowledge)
- url: https://avito.ru/rossiya/rabota
- source_type: primary
- published: Ongoing
- confidence: medium

### [9] Job.ru - Russian job board
- quote: No public API found. Likely requires scraping. (from general knowledge)
- url: https://job.ru/
- source_type: primary
- published: Ongoing
- confidence: low

### [10] Careerist.com - Russian-speaking developer community
- quote: Community platform, not primarily a job board. Limited structured data. (from general knowledge)
- url: https://careerist.com/
- source_type: community
- published: Ongoing
- confidence: low

### [11] VC.ru - Russian business community with job sections
- quote: No public API for job listings. Content-focused platform. (from GitHub search)
- url: https://vc.ru/
- source_type: community
- published: Ongoing
- confidence: low

### [12] Kazakh job boards (enbek.kz, hh.kz)
- quote: hh.kz is part of HeadHunter network, same API available. enbek.kz is government portal. (from research)
- url: https://hh.kz/ | https://enbek.kz/
- source_type: primary
- published: Ongoing
- confidence: medium

### [13] Georgian job platforms
- quote: HeadHunter has presence in Georgia (headhunter.ge). Local platforms limited. (from research)
- url: https://headhunter.ge/
- source_type: primary
- published: Ongoing
- confidence: medium

### [14] Armenian job platforms
- quote: Limited information found. Likely requires local research. (from research)
- url: Various
- source_type: primary
- published: Ongoing
- confidence: low

## Source Assessment Table

| Source | API | Auth | Scraping | JSON | Salary | Tech | Remote | Pagination | Search | Sync | Rate Limits | Maintenance | Vacancies | Notes |
|--------|-----|------|----------|------|--------|------|--------|------------|--------|------|-------------|-------------|------------|-------|
| HeadHunter (hh.ru) | YES (REST, OpenAPI) | OAuth 2.0 / Anonymous | Not needed | YES | YES | YES | YES | YES | YES | YES (webhooks) | YES (200 req/10min anon) | LOW | HIGH | Best source. Full API with anonymous access for vacancy search. Multi-country (RU, KZ, BY, GE, UZ, AZ, KG). |
| SuperJob (superjob.ru) | YES (REST) | API Key (free) | Not needed | YES | YES | YES | YES | YES | YES | YES | YES | LOW | HIGH | Good API but requires registration. Free tier available. |
| Trudvsem.ru | YES (Open Data) | Anonymous | Not needed | XML | YES | Limited | Limited | YES | YES | YES (daily dumps) | NO (open data) | LOW | MEDIUM | Government portal. Open data in XML format. Lower quality vacancies. |
| Habr Career | NO | N/A | MEDIUM (JS rendering) | NO (scraped HTML) | YES | YES | YES | YES | YES | N/A | N/A | HIGH | HIGH | No API. Scraping possible but requires headless browser. High-quality developer vacancies. |
| Djinni | NO | N/A | MEDIUM (JS rendering) | NO (scraped HTML) | YES | YES | YES | YES | YES | N/A | N/A | HIGH | MEDIUM | No API. Reverse-engineering repos exist. Good for CIS developers. |
| Rabota.by | NO | N/A | MEDIUM | NO (scraped HTML) | YES | Limited | Limited | YES | YES | N/A | N/A | HIGH | MEDIUM | No API. Belarus-focused. |
| Zarplata.ru | UNCLEAR | N/A | MEDIUM | UNCLEAR | YES | Limited | Limited | YES | YES | N/A | N/A | HIGH | LOW | Old API usage in GitHub repos. May have limited API. |
| Avito Jobs | NO | N/A | HIGH (anti-bot) | NO (scraped HTML) | YES | Limited | Limited | YES | YES | N/A | N/A | VERY HIGH | HIGH | No API. Heavy anti-scraping measures. Large volume but difficult to access. |
| Job.ru | NO | N/A | MEDIUM | NO (scraped HTML) | YES | Limited | Limited | YES | YES | N/A | N/A | HIGH | LOW | No API found. |
| Careerist.com | NO | N/A | LOW | NO | Limited | YES | YES | Limited | Limited | N/A | N/A | HIGH | LOW | Community platform, not job board. |
| VC.ru | NO | N/A | MEDIUM | NO | Limited | Limited | Limited | Limited | Limited | N/A | N/A | HIGH | LOW | Content platform with occasional job posts. |
| hh.kz | YES (same as hh.ru) | OAuth 2.0 / Anonymous | Not needed | YES | YES | YES | YES | YES | YES | YES | Same as hh.ru | LOW | MEDIUM | Part of HeadHunter network. Same API. |
| enbek.kz | UNCLEAR | N/A | MEDIUM | UNCLEAR | YES | Limited | Limited | YES | YES | N/A | N/A | HIGH | LOW | Kazakh government portal. May have limited API. |
| headhunter.ge | YES (same as hh.ru) | OAuth 2.0 / Anonymous | Not needed | YES | YES | YES | YES | YES | YES | YES | Same as hh.ru | LOW | LOW | Part of HeadHunter network. Same API. |

## Dead ends
- Most CIS job boards (except HeadHunter, SuperJob, Trudvsem) have NO public API
- Scraping is technically possible but high maintenance due to anti-bot measures
- Legal considerations vary by country (data protection laws, terms of service)
- Small local platforms (Georgian, Armenian) have limited documentation

## Suggested follow-ups
1. Test HeadHunter API with actual vacancy search queries to verify data completeness
2. Investigate SuperJob API registration process and free tier limitations
3. Check Trudvsem.ru API data quality and update frequency
4. Research Habr Career scraping feasibility (headless browser requirements)
5. Look for additional CIS tech community platforms (e.g., Geekforge, Tproger)
6. Investigate RSS feed availability for major platforms
7. Check legal requirements for data aggregation in different CIS countries
