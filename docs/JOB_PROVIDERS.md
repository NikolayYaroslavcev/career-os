# Job Providers

CareerOS integrates with multiple job providers to aggregate vacancies from various sources.

> **2026-07-23 audit note:** This document was missing three providers that
> exist in `packages/providers/src/providers/` — SuperJob, Habr Career, and
> Telegram (channel scraping) — added to the table and setup sections below.
> They landed very recently (same day as this audit), which is why they'd
> been missed. The "Implementation Notes" claim "No scraping or browser
> automation" is also out of date: the Telegram provider explicitly scrapes
> each channel's public `t.me/s/<channel>` HTML preview page
> (`packages/shared/src/config.ts`, `TELEGRAM_CHANNELS` comment), and the
> LinkedIn provider fetches directly from `www.linkedin.com` rather than an
> official API (see the audit note in `adr/ADR-013-linkedin-integration-strategy.md`
> for detail — that one is a real conflict with its own ADR, not just a doc gap).

## Provider Overview

| Provider | ID | Auth | Rate Limit | Countries | Salary | Remote | Pagination |
|---|---|---|---|---|---|---|---|
| RemoteOK | `remote_ok` | None | 60/min | Global | Yes | Yes | None (all at once) |
| HeadHunter | `hh` | Optional token | 100/min (3 w/o token) | RU, KZ, BY | Yes | No | Page (100/page, max 2000) |
| Adzuna | `adzuna` | App ID + Key | 25/min, 250/day | GB, US, DE, FR, AT, BE, BR, CA, CH, IN, NL, PL, SG, ZA | Yes | No | Page (50/page, max 500) |
| Greenhouse | `greenhouse` | Board token | None | Per company | No | No | None |
| Lever | `lever` | None | None | Per company | No | No | None |
| Ashby | `ashby` | None | None | Per company | No | No | None |
| Workday | `workday` | None | None | Per company | No | No | None |
| Teamtailor | `teamtailor` | API key | None | Per company | No | No | None |
| SmartRecruiters | `smartrecruiters` | None | 60/min | Per company | Yes | No | Offset (100/page) |
| Recruitee | `recruitee` | None | 60/min | Per company | Yes | Yes | Page (50/page) |
| Comeet | `comeet` | None | 60/min | Per company | Yes | Yes | None |
| Remotive | `remotive` | None | None | Global | Yes | Yes | None |
| Himalayas | `himalayas` | None | None | Global | Yes | Yes | None |
| Arbeitnow | `arbeitnow` | None | None | Global | Yes | Yes | None |
| Jobicy | `jobicy` | None | None | Global | Yes | Yes | None |
| We Work Remotely | `we_work_remotely` | None | None | Global | Yes | Yes | None |
| Working Nomads | `working_nomads` | None | None | Global | Yes | Yes | None |
| NoDesk | `nodesk` | None | None | Global | Yes | Yes | None |
| HN Who Is Hiring | `hn_hiring` | None | None | Global | No | Yes | None |
| LinkedIn | `linkedin` | None | Guest API (unofficial, direct fetch from linkedin.com — see audit note above) | Global | No | No | Offset (25/page) |
| SuperJob | `superjob` | API key (`X-Api-App-Id`) | Not verified in this pass | RU | Yes | Not verified | Page (100/page) |
| Habr Career | `habr_career` | None | Not verified in this pass | RU | Not verified | Not verified | Not verified |
| Telegram | `telegram` | None (scrapes public `t.me/s/<channel>` pages, see audit note above) | Not verified in this pass | RU/CIS (channel-dependent) | Not verified | Not verified | Not verified |

## Setup Instructions

### RemoteOK (always enabled)

No configuration needed. Automatically registered.

### HeadHunter (always enabled)

```env
HH_AREAS=113          # Comma-separated area IDs (113=Russia, 40=Kazakhstan, 16=Belarus)
HH_ACCESS_TOKEN=      # Optional, raises rate limits
```

### Adzuna

1. Register at https://developer.adzuna.com/signup
2. Get your `app_id` and `app_key`
3. Set environment variables:

```env
ADZUNA_APP_ID=your_app_id
ADZUNA_APP_KEY=your_app_key
ADZUNA_COUNTRY=gb     # Default: gb (Great Britain)
```

**Supported countries:** `gb`, `us`, `de`, `fr`, `at`, `be`, `br`, `ca`, `ch`, `in`, `nl`, `pl`, `sg`, `za`

**Rate limits:** 25 requests/minute, 250/day, 1000/week, 2500/month

**Terms of Service:** Publishing Adzuna listings requires labeling each advert with "Jobs by Adzuna" linking to adzuna.co.uk. See https://developer.adzuna.com/docs/terms_of_service

### Greenhouse (per-company)

```env
GREENHOUSE_BOARD_TOKEN=your_board_token
GREENHOUSE_COMPANY_NAME=Your Company
```

### Lever (per-company)

```env
LEVER_COMPANY=your_company_slug
LEVER_COMPANY_NAME=Your Company
```

### Ashby (per-company)

```env
ASHBY_JOB_BOARD_NAME=your_board_name
ASHBY_COMPANY_NAME=Your Company
```

### Workday (per-company)

```env
WORKDAY_TENANT=your_tenant
WORKDAY_SITE=your_site
WORKDAY_COMPANY_NAME=Your Company
WORKDAY_HOST=         # Optional custom host
```

### Teamtailor (per-company)

```env
TEAMTAILOR_API_KEY=your_api_key
TEAMTAILOR_COMPANY_NAME=Your Company
```

### SmartRecruiters (per-company)

```env
SMARTRECRUITERS_COMPANY=your_company_slug
SMARTRECRUITERS_COMPANY_NAME=Your Company
```

### Recruitee (per-company)

```env
RECRUITEE_COMPANY=your_company_slug
RECRUITEE_COMPANY_NAME=Your Company
```

### Comeet (per-company)

```env
COMEET_TOKEN=your_company_token
COMEET_COMPANY_NAME=Your Company
```

### Free Providers (always enabled)

Remotive, Himalayas, Arbeitnow, Jobicy, We Work Remotely, Working Nomads, NoDesk, HN Who Is Hiring, LinkedIn, and Habr Career require no configuration.

LinkedIn can be disabled with:
```env
LINKEDIN_ENABLED=false
```

### SuperJob (conditionally enabled)

```env
SUPERJOB_API_KEY=your_api_key   # Free signup at https://api.superjob.ru/register/
```

Without a key, SuperJob is skipped like the other conditionally-registered providers — no crash. Note from `packages/shared/src/config.ts`: the SuperJob registration page itself has been observed blocked by their WAF from some datacenter IPs, so provisioning the key may require a residential/RU IP.

### Telegram (conditionally enabled)

```env
TELEGRAM_CHANNELS=remoteit,frontend_jobs,it_vacancy   # comma-separated, no @ or t.me/ prefix
```

Scrapes each channel's public `t.me/s/<channel>` preview page — no bot token or login needed. Without any channels configured, this provider is skipped.

## Provider Architecture

Each provider implements four components:

1. **Fetcher** - Handles HTTP requests and response parsing
2. **Mapper** - Transforms raw API responses to normalized format
3. **Normalizer** - Validates and produces canonical vacancy objects
4. **SyncStrategy** - Manages incremental sync and pagination

All providers extend `DefaultProviderJob` and are registered in `ProviderRegistry`.

## Sync Intervals

| Provider | Interval |
|---|---|
| RemoteOK | 1 hour |
| HeadHunter | 1 hour |
| Adzuna | 1 hour |
| Greenhouse | 1 hour |
| Lever | 1 hour |
| Ashby | 1 hour |
| Workday | 1 hour |
| Teamtailor | 1 hour |
| SmartRecruiters | 1 hour |
| Recruitee | 1 hour |
| Comeet | 1 hour |
| Remotive | 1 hour |
| Himalayas | 2 hours |
| Arbeitnow | 1 hour |
| Jobicy | 1 hour |
| We Work Remotely | 2 hours |
| Working Nomads | 2 hours |
| NoDesk | 2 hours |
| HN Who Is Hiring | 24 hours |
| LinkedIn | 1 hour |
| SuperJob | Not verified in this pass — check `sync-scheduler-service.ts` |
| Habr Career | Not verified in this pass — check `sync-scheduler-service.ts` |
| Telegram | Not verified in this pass — check `sync-scheduler-service.ts` |

## Deduplication

The `DeduplicationEngine` handles cross-provider deduplication:

- **Exact matching**: Concatenated key fields (company + title + location + URL)
- **Fuzzy matching**: Levenshtein similarity on normalized company name and title

Configuration:
```typescript
{
  keyFields: ['companyName', 'title', 'location.raw', 'url'],
  similarityThreshold: 0.8,
  timeWindowMs: 7 * 24 * 60 * 60 * 1000, // 7 days
  enableFuzzyMatching: true,
}
```

## Implementation Notes

- All providers use the same `DefaultProviderJob` base class
- Most providers use official APIs or public JSON endpoints; two don't —
  see the audit note at the top of this document (LinkedIn fetches
  directly from linkedin.com, Telegram scrapes public HTML preview pages).
  This line previously claimed "No scraping or browser automation" for
  every provider, which is no longer accurate.
- Rate limiting is handled per-provider via `TokenBucketRateLimiter`
- Exponential backoff with jitter for retries
- Health monitoring tracks consecutive failures and response times
- Diagnostics exposed at `/api/v1/diagnostics/providers`

## Adding a New Provider

1. Create `packages/providers/src/providers/<name>/` directory
2. Implement `Fetcher`, `Mapper`, `Normalizer` interfaces
3. Create factory function `create<Name>Provider()`
4. Export from `packages/providers/src/index.ts`
5. Register in `apps/backend/src/container.ts`
6. Add sync interval in `apps/backend/src/services/sync-scheduler-service.ts`
7. Add to dashboard `PROVIDER_NAMES` in `apps/dashboard/src/app/app/sync/page.tsx`
8. Add config env vars in `packages/shared/src/config.ts`
9. Write tests
