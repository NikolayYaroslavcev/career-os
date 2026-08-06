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
| Personio | `personio` | None | None documented | Per company (DE/AT/CH-heavy) | No | Yes | None (single XML feed) |
| Workable | `workable` | None | Unpublished, unverified | Per company (SMB/mid-market) | No | Yes | None (single widget response) |
| Remotive | `remotive` | None | None | Global | Yes | Yes | None |
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
| PyJobs | `pyjobs` | None | None documented | Global | No (feed always reports $0-$0) | Yes | None (single RSS feed) |
| Django Jobs | `django_jobs` | None | None documented | Global | No | Not verified | None (two merged feeds, RSS + Atom) |
| a16z Speedrun | `speedrun` | None | None documented | Global | Yes (structured) | Yes | Page (50/page, ~122 pages for engineering-only) |
| France Travail | `france_travail` | OAuth2 client credentials | 10 req/s (documented) | FR | Yes (freeform French text) | No | Offset (`range=`, 50/page) |

## Setup Instructions

### HeadHunter (always enabled)

```env
HH_AREAS=113,16,40,97,48,9,28,13,86,62   # Comma-separated area IDs, default = CIS + diaspora coverage
HH_ACCESS_TOKEN=      # Optional, raises rate limits
```

Default area IDs: 113 Russia, 16 Belarus, 40 Kazakhstan, 97 Uzbekistan, 48 Kyrgyzstan,
9 Azerbaijan, 28 Georgia, 13 Armenia, 86 Tajikistan, 62 Moldova. Ukraine (area 5) is
deliberately excluded pending a separate live-data check. Full list at
https://api.hh.ru/areas, country-only list at https://api.hh.ru/areas/countries.

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

### Greenhouse (per-company, defaults to JetBrains)

```env
GREENHOUSE_BOARD_TOKEN=your_board_token
GREENHOUSE_COMPANY_NAME=Your Company
```

Unlike the other per-company ATS providers below, Greenhouse ships with a live
default (`jetbrains` / `JetBrains`, confirmed live at
`job-boards.eu.greenhouse.io/jetbrains`) so this slot isn't sitting empty out of
the box. Set both vars to point at a different company's board instead.

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

### Personio (per-company)

```env
PERSONIO_COMPANY=your_company_subdomain
PERSONIO_COMPANY_NAME=Your Company
PERSONIO_LANGUAGE=en   # Optional: de/en/fr/es/nl/it/pt, defaults to en
```

Public, unauthenticated, officially-documented XML feed
(`https://{company}.jobs.personio.de/xml`) — no API key needed, just a
company subdomain. Unlike Greenhouse, no default company ships here; Personio
is common among German/Austrian/Swiss SMEs and scale-ups, an EU segment the
other ATS providers under-cover. No salary data in the feed, but structured
`seniority`/`employmentType`/`schedule` fields map directly to CareerOS's
canonical experience-level/employment-type scale (most other providers infer
these from free text).

### Workable (per-company)

```env
WORKABLE_ACCOUNT_SLUG=your_account_slug
WORKABLE_COMPANY_NAME=Your Company
```

Public, unauthenticated per-tenant JSON widget endpoint
(`https://apply.workable.com/api/v1/widget/accounts/{accountSlug}`) — the
same endpoint Workable designs for customers to embed on their own career
pages. Uses `application_url` (the direct `.../apply` link) as the canonical
job URL, not the listing page. No salary data. `experience`/`employment_type`
are structured fields mapped directly, same as Personio.

### Free Providers (always enabled)

Remotive, Arbeitnow, Jobicy, We Work Remotely, Working Nomads, NoDesk, HN Who Is Hiring, LinkedIn, Habr Career, PyJobs, Django Jobs, and a16z Speedrun require no configuration.

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
TELEGRAM_CHANNELS=remoteit,jobforjunior,geekjobs,...   # comma-separated, no @ or t.me/ prefix — fallback only, see below
```

Scrapes each channel's public `t.me/s/<channel>` preview page — no bot token or login needed. Without any channels configured (DB or env), this provider is skipped.

**Channel source of truth**: the `TelegramChannel` DB table, managed via `/providers/telegram/channels` (GET/POST/PATCH/DELETE). `TELEGRAM_CHANNELS` above is only a fallback used when that table is empty or unreachable — see `resolveTelegramChannelSource()` in `apps/backend/src/container.ts`. The current curated channel list (as of 2026-07-31, 25 channels across the existing set + Tier 1 expansion) lives in `apps/backend/src/scripts/manage-telegram-channels.ts`, run once to seed the DB table so it's the live source going forward.

Per-channel quality metrics (messages received, spam/low-confidence/extraction rates, unique-vs-duplicate vacancy counts, and a deterministic 0-100 quality score) are computed after every sync into `TelegramChannelStats` and returned alongside each channel from `GET /providers/telegram/channels` — see `apps/backend/src/services/telegram-channel-stats-service.ts`.

### PyJobs (always enabled)

No configuration needed — public RSS feed at `https://www.pyjobs.com/rss`, no API key. Company, work mode, and employment type are parsed out of the feed's packed description line (`"{Company} / {WorkMode} / {Salary} / {EmploymentType}"`); salary is dropped rather than parsed since the feed reports `$0 to $0` for every listing observed. Every job is tagged `python` regardless of title/description text, since the board is Python-specific by definition.

### Django Jobs (always enabled)

No configuration needed. Merges two independently-run feeds that `djangoproject.com/community/jobs/` itself aggregates: `builtwithdjango.com/jobs/feed/rss` (RSS, company parsed from the "{title} at {company}" title template) and `djangojobboard.com/feed/atom/` (Atom; company is left `Unknown` since it isn't reliably separable from the URL slug — an honest gap rather than a guessed-wrong company name). Every job is tagged `django`/`python` regardless of title/description text.

### a16z Speedrun Talent Network (always enabled)

No configuration needed — public JSON API at `https://speedrun-talent-network.com/api/v1/jobs`, no API key. **Apply-flow verified before building** (this was the gate `research/free-provider-expansion/EPIC.md` §Phase 2 required): the per-job detail endpoint exposes `apply: {kind: "external", url: "..."}` pointing at the employer's own ATS (e.g. `jobs.ashbyhq.com/.../application`) — a genuine direct-apply link, unlike Landing.jobs' inbox/handshake model (rejected, see below). The fetcher does **not** call the per-job detail endpoint though — doing so for every one of the ~6,000 engineering listings would mean ~6,000 extra requests per sync. Instead it uses only the list endpoint's own `url` field (Speedrun's own job page, which itself forwards to the real apply link) — the same accepted precedent as WWR/Arbeitnow/DOU pointing at their own aggregator page rather than the employer's.

The list endpoint aggregates every function across the a16z portfolio (engineering, sales, ops, product, ...); only ~38% (6,083 of 16,203 at last check) is `engineering`. The API silently ignores an unrecognized `function` query param and returns unfiltered results rather than erroring — the fetcher uses `fn=engineering` (the actual facet key name) to filter server-side. Salary, remote flag, employment type, and seniority all come from clean structured fields (`comp_min`/`comp_max`/`comp_currency`, `remote`, `employment_type`, `seniority`) rather than freeform-text parsing — the richest field set of any provider in this batch. No full job description is available from the list endpoint, so the mapper composes a short, honest summary from those same structured fields rather than fabricating prose.

**Landing.jobs was evaluated and rejected** at this same implementation-time gate — see `research/free-provider-expansion/REPORT.md`'s Tier C table for the finding (inbox/handshake apply model, no company field in the live API).

### France Travail (conditionally enabled)

```env
FRANCE_TRAVAIL_CLIENT_ID=your_client_id
FRANCE_TRAVAIL_CLIENT_SECRET=your_client_secret
FRANCE_TRAVAIL_ROME_CODES=M1805   # Optional, comma-separated ROME codes; defaults to M1805 (Études et développement informatique)
```

Free self-service registration at https://francetravail.io (Emploi Store Développeurs) gets you an OAuth2 `client_id`/`client_secret` pair — without one, this provider is skipped like the other conditionally-registered providers, no crash. The official "Offres d'emploi" v2 REST API is France's government labor-market API — general-purpose across every profession, not tech-specific, so a ROME occupation-code filter (`codeROME=M1805`) is required to keep results to software-engineering roles; without it, sync would firehose every French job listing.

**Unverified against a live response** — building this required an OAuth2 client_credentials flow and the francetravail.io documentation site is a client-rendered SPA this codebase's tooling can't execute. Both the OAuth2 token endpoint and the search endpoint were confirmed live and reachable (error responses, not DNS/404 failures) during implementation, and the request shapes are confirmed correct (the token endpoint's `invalid_client` error response confirms the `grant_type`/`client_id`/`client_secret`/`scope` shape), but the response field names (`intitule`, `entreprise.nom`, `lieuTravail.libelle`, `salaire.libelle`, `origineOffre.urlOrigine`) come from the API's long-stable public shape, not a live-fetched sample. **Validate this against a real response as soon as credentials are provisioned** — see `packages/providers/src/providers/francetravail/francetravail-types.ts` for the full caveat.

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
| Personio | 1 hour |
| Workable | 1 hour |
| Remotive | 1 hour |
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
| PyJobs | 1 hour |
| Django Jobs | 2 hours |
| a16z Speedrun | 1 hour |
| France Travail | 1 hour |

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
