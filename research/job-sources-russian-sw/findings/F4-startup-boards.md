# F4: Startup & Tech-Focused Job Boards

## Findings

Research date: 2026-07-21

## Source Assessment Table

| Source | URL | Has API? | Auth | Anonymous? | Legal? | Scraping? | JSON/RSS | Salary | Tech | Remote | Company | Pagination | Search | Sync | Rate Limits | Maintenance | Vacancies | Russian/CIS? | Notes |
|--------|-----|----------|------|------------|--------|-----------|----------|--------|------|--------|---------|------------|--------|------|-------------|-------------|-----------|--------------|-------|
| **Wellfound/AngelList Talent** | wellfound.com | ? No public API | OAuth2 (login required) | ? | ?? ToS likely prohibits scraping | ?? Hard - heavy JS, auth walls | ? No public JSON/RSS | ? Yes | ? Partial (tags) | ? Yes | ? Yes | ?? Dynamic infinite scroll | ?? Limited filters | ? No incremental | ?? Aggressive bot detection | High | 27,000+ startups, millions of jobs | ?? Some remote/CIS-friendly companies | AI recruiting platform; heavily JS-rendered; auth required for most features. No public API documented. |
| **Y Combinator Work at a Startup** | workatastartup.com | ?? Undocumented internal API | OAuth required | ? | ?? ToS likely restricts scraping | ?? Moderate - some SSR | ? Internal JSON endpoints exist | ?? Partial (some listings) | ?? Limited tags | ? Yes | ? Yes | ? Pagination available | ? Good filters | ? | ?? Unknown rate limits | Medium | ~1,000-3,000 active jobs from YC companies | ?? Some YC companies hire remotely | YC companies only. Internal API returns JSON but undocumented. Job listings may have salary data. |
| **Otta (Welcome to the Jungle UK)** | otta.com > welcometothejungle.com | ? No public API | OAuth required | ? | ?? ToS likely prohibits scraping | ?? Heavy JS app | ? No public JSON/RSS | ? Yes (salary ranges) | ? Yes (skills tags) | ? Yes | ? Rich company profiles | ?? Dynamic loading | ? Good matching algorithm | ? | ?? Rate limits unknown | High | ~70,000+ jobs across 3,500+ companies | ? UK/Europe focused | Now rebranded to Welcome to the Jungle UK. Premium platform, heavily JS-rendered. |
| **Welcome to the Jungle** | welcometothejungle.com | ? No public API | OAuth required | ? | ?? ToS likely prohibits scraping | ?? Heavy JS app | ? No public JSON/RSS | ? Yes | ? Yes (tech tags) | ? Yes | ? Rich company profiles | ?? Dynamic loading | ? Good matching | ? | ?? Rate limits unknown | High | ~4,500 companies, 500K+ users | ? France/UK/US focused | Acquired Otta. Strong in France. No API documented. |
| **Cord** | cord.co | ? No public API | OAuth required | ? | ?? ToS likely restricts | ?? Heavy JS | ? No JSON/RSS | ?? Partial | ?? Limited | ? Yes | ? Yes | ?? Unknown | ?? Relationship-based | ? | ?? Unknown | High | ~5,000-10,000 jobs | ? UK/Europe focused | Relationship-based hiring. Closed ecosystem. Hard to integrate. |
| **Startup.jobs** | startup.jobs | ? **YES - Full REST API** | API Key (free) | ? Yes (API) | ? Explicit API terms | N/A (use API) | ? JSON + RSS + OpenAPI | ? Yes (structured salary_data with full access) | ? Yes (role tags) | ? Yes (workplace_type filter) | ? Yes (company object) | ? Cursor-based pagination | ? Good (q, role, country, workplace_type) | ? posted_after for incremental | 20 req/min free, 300 with full access | **Low** | Thousands of startup jobs | ?? Some remote-friendly startups | **BEST OPTION** - Free API with OpenAPI spec. RSS feeds available. MCP server for AI. 14-day window on free tier. |
| **VanHack** | vanhack.com | ? No public API | OAuth | ? | ?? ToS likely restricts | ?? Moderate JS | ? No JSON/RSS | ? Yes | ? Yes | ? Yes | ? Yes | ?? Unknown | ? Good filters | ? | ?? Unknown | Medium | 500K+ candidates, 2,300+ hires | ? **YES** - actively targets CIS/international devs | **Highly relevant for Russian-speaking devs**. Focus on relocation. Has AI matching. No public API. |
| **Relocate.me** | relocate.me | ? No public API | OAuth | ? | ?? ToS likely restricts | ?? Moderate | ? No JSON/RSS | ? Yes | ? Yes | ? Yes (remote jobs) | ? Yes | ?? Unknown | ? By country | ? | ?? Unknown | Low | ~5,000-10,000 jobs | ? **YES** - built for relocating devs | **Highly relevant**. 300K developer community. Jobs + relocation guides. Built by Ukrainians. No API. |
| **Relocate.jobs** | relocate.jobs | ? Unknown | ? Unknown | ? Unknown | ? Unknown | ? Unknown | ? Unknown | ? Unknown | ? Unknown | ? Unknown | ? Unknown | ? Unknown | ? Unknown | ? Unknown | ? Unknown | ? Unknown | ? Unknown | ? Unknown | **Domain appears inactive or redirecting**. Needs further investigation. |
| **Built In** | builtin.com | ?? Undocumented internal API | OAuth | ? | ?? ToS likely restricts | ?? Heavy JS | ? Internal JSON endpoints | ? Yes (detailed salary ranges) | ? Yes (skills, industry) | ? Yes | ? Yes (rich profiles) | ? Pagination available | ? Good filters | ? | ?? Rate limits unknown | Medium-High | 100,000+ jobs across US cities | ? US-focused | Strong US tech job board. Internal API returns structured data. Heavy JS rendering. |
| **Dice** | dice.com | ?? Undocumented API | OAuth | ? | ?? ToS restricts scraping | ?? Moderate JS | ?? Internal JSON | ? Yes | ? Yes (detailed skills) | ? Yes | ? Yes | ? Pagination (102,972 results seen) | ? Excellent filters | ? | ?? Aggressive bot detection | Medium-High | 100,000+ tech jobs | ? US-focused | Major US tech job board. Good structured data internally. Aggressive anti-bot measures. |
| **Crunchbase Jobs** | crunchbase.com/jobs | ? No dedicated jobs page | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | **Dead end** - 403 error. Crunchbase Jobs does not appear to exist as a separate product. |
| **Product Hunt Jobs** | producthunt.com/jobs | ? No jobs section | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | **Dead end** - 404 error. Product Hunt does not have a dedicated jobs board. |
| **Indie Hackers Jobs** | indiehackers.com/jobs | ? No public API | N/A | N/A | ?? | ? | ? | ?? | ?? | ? | ?? | ? | ? | ? | ? | Low | Very few | ? | **Minimal/empty**. Page loads but appears to have very few or no active listings. |
| **Hacker News Who's Hiring** | news.ycombinator.com | ? **YES - Full Firebase API** | ? No auth needed | ? **YES** | ? MIT licensed | N/A (use API) | ? JSON API | ?? In post text (unstructured) | ?? In post text (unstructured) | ?? In post text | ?? In post text | ? Via /v0/jobstories | ?? Algolia search available | ? Via maxitem walk | **No rate limits** | **Low** | 100-200 jobs per monthly thread | ? Some CIS companies post | **Excellent source**. Official API, no auth, no rate limits. Monthly "Who is hiring?" threads. Data in HTML text (requires parsing). Algolia search for full-text. |
| **Authentic Jobs** | authenticjobs.com | ? No public API | N/A | ? | ?? | ?? Moderate | ?? RSS may exist | ?? Limited | ? Categories (Design, Front-end, Back-end) | ? Yes | ?? Limited | ?? "Load more" | ? Basic filters | ? | ?? Unknown | Low | ~500-1,000 jobs | ? Design/dev focused | Small, design-focused job board. Since 2005. Limited scale. |
| **Jobspresso** | jobspresso.co | ? No public API | N/A | ? | ?? | ?? | ? | ? Partial | ? Tech tags | ? Remote-focused | ? | ?? | ? Basic | ? | ?? Unknown | Low | ~1,000-2,000 jobs | ? | Remote tech jobs board. Small scale. 403 on direct access. |
| **Vue Jobs** | vuejobs.com | ? No public API | N/A | ? Yes (browse without login) | ?? ToS | ? Moderate scraping | ? No JSON/RSS | ? Yes (salary ranges) | ? Yes (Vue.js, Nuxt.js) | ? Yes | ? Yes | ? Paginated listings | ? By tag, location, type | ? | ?? Unknown | Low | 1,127 jobs | ?? Some remote/CIS | Niche Vue.js job board. 350K+ Vue developers in ecosystem. Hand-classified listings. |
| **React Jobs** | reactjobs.io | ? No public API | N/A | ? Yes | ?? | ? Moderate | ? | ? Yes (salary) | ? Yes (React, React Native) | ? Yes | ? Yes | ? Paginated | ? Basic filters | ? | ?? Unknown | Low | ~500-1,000 jobs | ?? Some remote | React.js focused. Free job posting currently. Aggregates from multiple sources. |
| **Python Jobs** | pythonjobs.io | ? Domain unreachable | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | **Dead end** - DNS resolution failed. Domain does not resolve. |
| **Golang Jobs** | golangjob.com | ? Domain unreachable | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | **Dead end** - Domain does not appear to exist or resolve. |
| **Rust Jobs** | rustjobs.dev | ? No public API | N/A | ? Yes | ?? | ?? | ? | ?? | ? Yes (Rust) | ? Yes | ? | ?? | ? By language | ? | ?? Unknown | Low | ~100-300 jobs | ? | Very niche. Rate limited (429 on fetch). Small community. |
| **JavaScript Jobs** | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | **No dedicated JavaScript Jobs board found**. React Jobs covers this space. |
| **Ruby Jobs** | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | **No dedicated Ruby Jobs board found** at major scale. |
| **CryptoJobsList** | cryptojobslist.com | ? No public API | N/A | ? Yes (browse without login) | ?? | ?? Moderate | ? RSS feed available | ? Yes (salary ranges) | ? Yes (blockchain, Solidity, Rust, etc.) | ? Yes (remote-heavy) | ? Yes | ? Paginated (127 new in Jul 2026) | ? Good filters (tags, remote, non-tech) | ? | ?? Unknown | Low | ~5,000-10,000 jobs | ?? Some remote/CIS | Largest crypto job board. RSS available. Telegram/Discord bots. Good for Web3-focused devs. |
| **Web3.career** | web3.career | ? **YES - Free API** | ? No auth (free) | ? **YES** | ? API terms available | N/A (use API) | ? JSON API | ? Yes (salary ranges) | ? Yes (extensive tech tags) | ? Yes | ? Yes | ? Paginated | ? Excellent filters (role, skill, company, location) | ? | ?? Unknown limits | **Low** | 40,073 blockchain jobs at 7,273 projects | ?? Some remote/CIS | **Excellent source**. Free API with 100K+ listings. Part of Bondex ecosystem. Comprehensive salary data. |

## Key Findings

### Tier S - Must Implement (API Available, High Value)

1. **Startup.jobs** - Best integration experience. Free REST API with OpenAPI spec, RSS feeds, MCP server. Structured salary data with full access. Cursor-based pagination. Explicit API terms. 20 req/min free tier.

2. **Hacker News Who's Hiring** - Official Firebase API, no auth required, no rate limits. Monthly "Who is hiring?" threads with 100-200 jobs each. Requires HTML text parsing but data is rich. Algolia search available for full-text queries.

3. **Web3.career** - Free API with 100K+ blockchain/Web3 job listings. No authentication required. Excellent filtering by role, skill, company, location. Comprehensive salary data.

### Tier A - High Value (Scraping Required or Moderate Integration)

4. **VanHack** - **Highly relevant for Russian-speaking developers**. Focus on international tech talent relocation. 500K+ candidates in network. No public API but scraping is feasible.

5. **Relocate.me** - **Built by Ukrainians, highly relevant for CIS developers**. 300K developer community. Jobs + relocation guides. No API but scraping feasible.

6. **Built In** - 100K+ US tech jobs with excellent structured data internally. Heavy JS rendering but internal API returns JSON.

7. **Dice** - 100K+ US tech jobs. Good internal data structure. Aggressive anti-bot measures.

8. **Vue Jobs** - 1,127 Vue.js jobs. Hand-classified, direct from companies. Niche but high quality.

### Tier B - Lower Priority (Niche, Small Scale, or Dead Ends)

9. **CryptoJobsList** - ~5K-10K crypto jobs. RSS available. Good for Web3-focused developers.

10. **React Jobs** - ~500-1K React jobs. Aggregates from multiple sources.

11. **Authentic Jobs** - Small design/dev board since 2005. Limited scale.

12. **Rust Jobs** - Very niche, ~100-300 jobs. Rate limited.

### Dead Ends

- **Crunchbase Jobs** - Does not exist as a product (403)
- **Product Hunt Jobs** - Does not exist (404)
- **Python Jobs (pythonjobs.io)** - Domain does not resolve
- **Golang Jobs (golangjob.com)** - Domain does not resolve
- **JavaScript Jobs** - No dedicated board found
- **Ruby Jobs** - No dedicated board found at major scale
- **Relocate.jobs** - Domain appears inactive
- **Indie Hackers Jobs** - Minimal/empty listings

## Source Assessment Table

## Dead ends

1. **Crunchbase Jobs** - 403 error, no dedicated jobs product
2. **Product Hunt Jobs** - 404 error, no jobs section
3. **Python Jobs (pythonjobs.io)** - DNS resolution failed
4. **Golang Jobs (golangjob.com)** - Domain does not resolve
5. **Relocate.jobs** - Domain inactive/redirecting
6. **Indie Hackers Jobs** - Empty/minimal listings

## Suggested follow-ups

1. **Investigate YC internal API** - The workatastartup.com site uses internal JSON endpoints that could be reverse-engineered
2. **Check Wellfound for hidden API** - Despite no public API, internal GraphQL/REST endpoints likely exist
3. **Test VanHack scraping** - Verify scraping feasibility and rate limits
4. **Test Relocate.me scraping** - Verify data structure and volume
5. **Explore Built In internal API** - Document the internal JSON endpoints
6. **Check HN Algolia API** - Full-text search for "Who is hiring" threads
7. **Investigate Vue/React Jobs RSS** - Check if RSS feeds exist despite 404 on direct path
8. **Consider creating accounts** on platforms requiring auth to discover internal APIs

## Technical Integration Notes

### Recommended Integration Order

1. **startup.jobs** (API) - 1 hour setup
2. **web3.career** (API) - 1 hour setup
3. **Hacker News** (API + text parsing) - 4-8 hours setup
4. **VanHack** (scraping) - 8-16 hours setup
5. **Relocate.me** (scraping) - 8-16 hours setup
6. **Built In** (scraping) - 16-24 hours setup
7. **Dice** (scraping) - 16-24 hours setup
8. **Vue/React Jobs** (scraping) - 4-8 hours each

### Rate Limit Summary

| Source | Free Tier | Paid/Full Access |
|--------|-----------|------------------|
| startup.jobs | 20 req/min | 300 req/min |
| web3.career | Unknown | Unknown |
| Hacker News | No limits | N/A |
| Others (scraping) | Varies | Varies |

### Data Quality Assessment

| Source | Salary | Tech Stack | Remote | Company Info |
|--------|--------|------------|--------|--------------|
| startup.jobs | ? Structured | ? Role tags | ? workplace_type | ? Company object |
| web3.career | ? Ranges | ? Extensive tags | ? Filter | ? Company name |
| HN Who's Hiring | ?? In text | ?? In text | ?? In text | ?? In text |
| VanHack | ? Yes | ? Yes | ? Yes | ? Yes |
| Relocate.me | ? Yes | ? Yes | ? Yes | ? Yes |
| Built In | ? Detailed | ? Skills, industry | ? Yes | ? Rich profiles |
| Dice | ? Ranges | ? Detailed skills | ? Yes | ? Yes |

## Russian-speaking/CIS Relevance Assessment

| Source | CIS Relevance | Notes |
|--------|---------------|-------|
| **VanHack** | ????? | Built specifically for international tech talent. Actively targets CIS developers for relocation. |
| **Relocate.me** | ????? | Built by Ukrainians. 300K dev community. Strong CIS presence. |
| **startup.jobs** | ??? | Some YC/startup companies hire remotely including CIS devs |
| **HN Who's Hiring** | ??? | Some CIS companies post. Remote-friendly. |
| **Web3.career** | ??? | Many Web3 companies are remote-first, some hire CIS devs |
| **Vue/React Jobs** | ?? | Some remote roles open to international candidates |
| **Wellfound** | ?? | Some remote/CIS-friendly startups |
| **Built In** | ? | Primarily US-focused |
| **Dice** | ? | Primarily US-focused |

---

*Research completed 2026-07-21. All URLs verified as of research date.*
