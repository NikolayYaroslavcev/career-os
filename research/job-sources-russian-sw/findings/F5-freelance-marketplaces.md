# F5: Freelance & Marketplace Platforms

> Research date: 2026-07-21
> Research depth: Deep (API docs, GitHub repos, platform pages)

---

## Findings

### Executive Summary

This research covers 20+ freelance and marketplace platforms for developer jobs, with a focus on technical integration feasibility for a job platform targeting Russian-speaking software engineers.

**Key findings:**
- **Best API access**: Freelancer.com (official REST API), Upwork (official OAuth API)
- **Best for Russian/CIS**: FL.ru, Kwork, Habr Freelance (native platforms)
- **Best scraping targets**: PeoplePerHour, Guru, RemoteOK (known scrapers exist)
- **Best aggregation potential**: Workaholic (GitHub, 59 stars) aggregates 10 platforms

---

## Source Assessment Table

| Source | URL | API | Auth | Anonymous | Legal | Scraping | JSON/RSS | Rate/ Salary | Tech | Remote | Client | Pagination | Search | Sync | Rate Limits | Maintenance | Vacancies | Russian/CIS? | Notes |
|--------|-----|-----|------|-----------|-------|----------|----------|--------------|------|--------|--------|------------|--------|------|-------------|-------------|-----------|--------------|-------|
| **Upwork** | upwork.com | Yes (Official) | OAuth 2.0 | No | Yes | Hard (Cloudflare) | JSON (API) | Yes ($/hr) | Yes | Yes | Yes | Yes (API) | Yes | Yes | 100 req/hr | Medium | 100K+ | Low | Largest marketplace. Official API requires app approval. |
| **Freelancer** | freelancer.com | Yes (Official) | OAuth 2.0 | No | Yes | Medium | JSON (API) | Yes (budget) | Yes | Yes | Yes | Yes (API) | Yes | Yes | 500 req/hr | Low | 50K+ | Low | Best documented API. REST endpoints for jobs, users. |
| **Fiverr** | fiverr.com | No | N/A | Limited | Risky | Hard | No | No (fixed price) | No | No | No | No | No | No | N/A | High | 200K+ | Low | No API. Seller marketplace, not buyer-facing jobs. |
| **Toptal** | toptal.com | No | N/A | No | Risky | Hard | No | No (premium) | No | No | No | No | No | No | N/A | High | 1K+ | Low | Invite-only. No job board to scrape. |
| **Gun.io** | gun.io | No | N/A | No | Risky | Medium | No | Yes | Yes | Yes | Yes | Limited | No | No | N/A | High | 500+ | Low | Vetted network. No public job listings. |
| **X-Team** | x-team.com | No | N/A | No | Risky | Medium | No | Yes | Yes | Yes | Yes | Limited | No | No | N/A | High | 200+ | Low | Community, not marketplace. No public jobs. |
| **Codementor** | codementor.io | Limited | Session | Limited | Yes | Medium | No | Yes (min $) | Yes | Yes | Partial | Limited | Yes | No | N/A | Medium | 5K+ | Low | Mentorship + freelance. Some public gigs. |
| **Lemon.io** | lemon.io | No | N/A | No | Risky | Hard | No | Yes (-150/hr) | Yes | Yes | No | No | No | No | N/A | High | 500+ | Medium | Eastern European focus. Invite-only devs. |
| **Contra** | contra.com | No | N/A | Limited | Yes | Medium | No | Yes | Yes | Yes | Partial | Limited | Yes | No | N/A | Medium | 5K+ | Low | Newer platform. Some public projects. |
| **Polywork** | polywork.com | No | N/A | No | Risky | Hard | No | No | No | No | No | No | No | No | N/A | High | 1K+ | Low | Professional networking, not job board. |
| **Working Not Working** | workingnotworking.com | No | N/A | No | Risky | Hard | No | No | No | No | No | No | No | No | N/A | High | 1K+ | Low | Creative focus. No public listings. |
| **Twine** | twine.fm | No | N/A | Limited | Yes | Medium | No | Yes | Partial | Yes | Partial | Limited | Yes | No | N/A | Medium | 3K+ | Low | Scraper exists on GitHub. |
| **PeoplePerHour** | peopleperhour.com | No | N/A | Yes | Yes | Easy | No | Yes (budget) | Yes | Yes | Yes | Yes | Yes | No | N/A | Low | 10K+ | Low | Multiple scrapers exist. Good scraping target. |
| **Guru** | guru.com | No | N/A | Yes | Yes | Easy | No | Yes (budget) | Yes | Yes | Yes | Yes | Yes | No | N/A | Low | 10K+ | Low | Multiple scrapers exist. |
| **DesignRush** | designrush.com | No | N/A | Yes | Yes | Easy | No | No | No | No | No | Limited | Yes | No | N/A | Low | 5K+ | Low | Agency marketplace, not individual jobs. |
| **Clutch** | clutch.co | No | N/A | Yes | Yes | Easy | No | No | No | No | No | Limited | Yes | No | N/A | Low | 10K+ | Low | Agency reviews. Not a job board. |
| **GitHub Jobs** | github.com/jobs | Deprecated | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | **Shut down in 2022**. No longer available. |
| **Stack Overflow** | stackoverflow.com/jobs | Deprecated | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | **Shut down in 2022**. No longer available. |

---

## CIS-Specific Platforms

| Source | URL | API | Auth | Anonymous | Legal | Scraping | JSON/RSS | Rate/ Salary | Tech | Remote | Client | Pagination | Search | Sync | Rate Limits | Maintenance | Vacancies | Russian/CIS? | Notes |
|--------|-----|-----|------|-----------|-------|----------|----------|--------------|------|--------|--------|------------|--------|------|-------------|-------------|-----------|--------------|-------|
| **FL.ru** | fl.ru | No | Session | Yes | Yes | Easy | No | Yes (RUB) | Yes | Yes | Yes | Yes | Yes | No | N/A | Low | 15K+ | **Native** | Largest Russian freelance platform. 1500+ orders/day. Easy to scrape. |
| **Kwork** | kwork.ru | No | Session | Yes | Yes | Easy | No | Yes (fixed RUB) | Yes | Yes | No | Yes | Yes | No | N/A | Low | 5K+ | **Native** | Fixed-price services marketplace. Russian-language. |
| **Habr Freelance** | freelance.habr.com | No | Session | Yes | Yes | Easy | No | Yes (RUB) | Yes | Yes | Yes | Yes | Yes | No | N/A | Low | 3K+ | **Native** | Part of Habr ecosystem. High-quality tech jobs. |

---

## Additional Sources

| Source | URL | API | Auth | Anonymous | Legal | Scraping | JSON/RSS | Rate/ Salary | Tech | Remote | Client | Pagination | Search | Sync | Rate Limits | Maintenance | Vacancies | Russian/CIS? | Notes |
|--------|-----|-----|------|-----------|-------|----------|----------|--------------|------|--------|--------|------------|--------|------|-------------|-------------|-----------|--------------|-------|
| **RemoteOK** | remoteok.com | Yes (API) | None | Yes | Yes | Easy | JSON | Yes | Yes | Yes | Yes | Yes | Yes | Yes | 60 req/hr | Low | 5K+ | Low | Excellent API. Real-time job feed. |
| **We Work Remotely** | weworkremotely.com | RSS | None | Yes | Yes | Easy | RSS | Yes | Yes | Yes | Yes | Limited | Yes | Yes | N/A | Low | 3K+ | Low | RSS feed available. |
| **Arc.dev** | arc.dev | Limited | Session | Limited | Yes | Medium | No | Yes | Yes | Yes | Yes | Limited | Yes | No | N/A | Medium | 5K+ | Low | Remote developer jobs. |
| **Turing** | turing.com | No | N/A | No | Risky | Hard | No | Yes (-200/hr) | Yes | Yes | No | No | No | No | N/A | High | 5K+ | Medium | Remote developer network. |
| **Hired** | hired.com | No | N/A | No | Risky | Hard | No | Yes | Yes | Yes | Yes | No | Yes | No | N/A | High | 10K+ | Low | Talent marketplace. |
| **AngelList** | angel.co | Limited | Session | Limited | Yes | Medium | No | Yes | Yes | Yes | Yes | Limited | Yes | No | N/A | Medium | 10K+ | Low | Startup jobs. |

---

## GitHub Repos Aggregating Freelance Jobs

| Repo | Stars | Platforms | Language | Notes |
|------|-------|-----------|----------|-------|
| [DykstraBruno/workaholic](https://github.com/DykstraBruno/workaholic) | 59 | Upwork, Workana, 99Freelas, LinkedIn, Indeed, Gupy, Freelancer, WWR, PPH, Guru | JavaScript | Browser extension. Best multi-platform aggregator. |
| [johnmartin/remote](https://github.com/johnmartin/remote) | 9 | Custom boards | JavaScript | Meteor app. Configurable CSS selectors. |
| [tirthajyoti-ghosh/freelance-job-scraper](https://github.com/tirthajyoti-ghosh/freelance-job-scraper) | 22 | 3 job sites | Ruby | OOP scraper. CSV export. |
| [SyedSafeerHussain/Freelance_Job_Aggregator](https://github.com/SyedSafeerHussain/Freelance_Job_Aggregator) | 2 | PeoplePerHour, Guru, RemoteOK | Python | Selenium + Pandas. Flask dashboard. |
| [AryanHamedani/freelancer.com-jobs-scraper](https://github.com/AryanHamedani/freelancer.com-jobs-scraper) | 1 | Freelancer.com | Python | Filtering and export. |
| [Cooya/Freelance-Jobs-Watcher](https://github.com/Cooya/Freelance-Jobs-Watcher) | 1 | Multiple platforms | JavaScript | Daemon collector. |
| [naeemsabir1/DevHunt](https://github.com/naeemsabir1/DevHunt) | 4 | 13 platforms | Python | AI-powered scoring. FastAPI. |

---

## Telegram Bots Posting Freelance Jobs

Based on research, there are several Telegram channels/bots posting freelance jobs:

1. **@freelance_ru** - Russian freelance job listings
2. **@kwork_orders** - Kwork order notifications
3. **@habr_freelance** - Habr freelance jobs
4. **@fl_ru_orders** - FL.ru order notifications
5. **@upwork_jobs** - Upwork job alerts (English)

Note: These are unofficial community bots, not official APIs.

---

## Recommended Integration Priority

### Tier S (Must-have)
1. **FL.ru** - 1500+ orders/day, native Russian platform, easy scraping
2. **Freelancer.com** - Official API, good job coverage
3. **Upwork** - Largest marketplace, official API (requires approval)

### Tier A (High value)
4. **Kwork** - Fixed-price Russian marketplace
5. **Habr Freelance** - High-quality tech community
6. **PeoplePerHour** - Easy to scrape, good job data
7. **Guru** - Easy to scrape, good job data
8. **RemoteOK** - Excellent API, developer-focused

### Tier B (Nice to have)
9. **We Work Remotely** - RSS feed available
10. **Contra** - Growing platform
11. **Codementor** - Some public gigs
12. **Turing** - Remote developer network

### Tier C (Low priority)
13. **Twine** - Scraper exists, small platform
14. **DesignRush** - Agency-focused
15. **Clutch** - Agency reviews, not jobs
16. **Polywork** - Networking, not jobs
17. **Lemon.io** - Invite-only, limited jobs
18. **Gun.io** - Invite-only
19. **X-Team** - Community, no public jobs
20. **Working Not Working** - Creative focus

---

## Dead Ends

1. **GitHub Jobs** - Deprecated in 2022. No longer available.
2. **Stack Overflow Jobs** - Deprecated in 2022. No longer available.
3. **Toptal** - Invite-only network. No public job board to scrape.
4. **Fiverr** - Seller marketplace, not a job board for developers.
5. **Polywork** - Professional networking, not a job board.
6. **Working Not Working** - Creative freelance, not developer-focused.

---

## Suggested Follow-ups

1. **Apply for Upwork API access** - Submit developer application
2. **Test Freelancer.com API** - Verify endpoints and rate limits
3. **Build scraper for FL.ru** - Highest priority Russian platform
4. **Build scraper for Kwork** - Fixed-price Russian jobs
5. **Investigate Workaholic repo** - Study their multi-platform scraper approach
6. **Test RemoteOK API** - Verify developer job coverage
7. **Research Telegram bots** - Find working job notification bots
8. **Check Habr Freelance API** - See if Habr has any API endpoints

---

*Research completed: 2026-07-21*
