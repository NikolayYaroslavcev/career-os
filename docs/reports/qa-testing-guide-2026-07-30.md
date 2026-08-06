# CareerOS Manual QA / Testing Guide

**Date:** 2026-07-30
**Purpose:** A practical guide for manually testing everything currently implemented in CareerOS. Every claim below was checked directly against the code (file:line references given); anything I could not verify is marked explicitly rather than guessed.

**Scope note on "everything implemented so far":** the repo has a lot more surface area than just Telegram V2 / AI matching / free-provider-expansion (which is what recent work focused on). This guide covers the whole backend + dashboard as it stands today, with extra depth on the areas that changed most recently.

---

## 0. Before you start — environment

```bash
pnpm install
docker compose up -d          # Postgres, Redis, MinIO, Mailpit
pnpm db:migrate
cp .env.example .env
cp apps/dashboard/.env.example apps/dashboard/.env.local
pnpm dev                       # backend :3000, dashboard :3001
```

- Backend: http://localhost:3000, Dashboard: http://localhost:3001
- `CORS_ORIGIN` in `.env` must match the dashboard origin or every dashboard→backend call fails silently in the browser console.
- `DIAGNOSTICS_ENABLED=true` unlocks `/api/v1/diagnostics/*` and the dashboard's `/app/diagnostics` page — turn this on, you'll need it constantly below. It's off by default, and every diagnostics route 404s (not 403) when it's off, so "404 on diagnostics" first means "check this flag" before "something's broken."
- `AI_ENABLED=false` makes search return persisted vacancies with **no** AI scores at all — useful to know when a "why is nothing scored" question comes up while testing something unrelated to AI.
- There are two completely separate Docker stacks (`docker compose up -d` + `pnpm dev`, vs `docker-compose.full.yml`'s fully-containerized workflow) with **different Postgres volumes**. A login/session from one does not exist in the other. Don't mix them mid-test-session.

---

## PART 1 — What was implemented

### 1.1 Free Provider Expansion (`research/free-provider-expansion/EPIC.md`)

- **Phase 0 (config-only):** HH_AREAS widened to Georgia/Armenia/Tajikistan/Moldova (`.env.example:98-106`); Greenhouse now defaults to the JetBrains board (`packages/shared/src/config.ts:151-152`) so it's live with zero config; `otta`/`wellfound` are reserved-but-dormant slots in `source-priority.ts:24-28` — **no provider folder exists for either**, they cannot be synced no matter what you configure.
- **Phase 1 (new ATS adapters):** Personio (per-tenant XML feed) and Workable (per-tenant JSON widget) adapters shipped — both board-scoped, both need config to register (no default tenant, unlike Greenhouse).
- **Phase 2 (new job-board providers), all live and registered with zero config:**
  - `dou` — Ukraine dev jobs, per-category RSS (`https://jobs.dou.ua/vacancies/feeds/`)
  - `pyjobs` — Python jobs RSS (`https://www.pyjobs.com/rss`)
  - `django_jobs` — merges builtwithdjango.com RSS + djangojobboard.com Atom (`https://builtwithdjango.com/jobs/feed/rss`)
  - `speedrun` — a16z Speedrun Talent Network REST API (`https://speedrun-talent-network.com/api/v1/jobs`), gated behind a Phase-0 manual apply-flow check that **passed** 2026-07-30
  - `france_travail` — REST + OAuth2, conditionally registered only when `FRANCE_TRAVAIL_CLIENT_ID`/`SECRET` are set — **unverified against a live response**, see Part 8.
  - Landing.jobs was investigated and **rejected** (inbox/handshake apply model found at implementation time) — no code exists for it, nothing to test.
- **Phase 3-5** (Common Crawl discovery, Djinni/work.ua/NoFluffJobs, diaspora RSS): **not started** — nothing to test.

### 1.2 Telegram V2 (ADR-032: Telegram V1 → V2 migration)

The old regex-only `TelegramMapper`/`TelegramNormalizer` pair is **removed** — there is no V1/V2 coexistence flag, this is the only Telegram vacancy pipeline now. New pipeline (all detail in Part 5):

`TelegramFetcher` scrape/Bot API → `SocialMessageIngestionService` persists raw `SocialMessage` rows → `SocialMessagePipeline` runs a deterministic precheck, then `MessageExtractionEngine` (AI) → confidence-scored `MessageExtraction` row → if `SUCCESS`, the next `telegram` provider sync tick's `TelegramFetcher.buildRawJob()` reads that extraction back out and produces a normal `Vacancy`/`VacancySource` through the existing dedup/merge pipeline.

What's new: `SocialMessage`, `MessageExtraction`, `TelegramChannel`, `TelegramChannelSubscription`, `TelegramChannelStats` tables; a DB-backed channel list (env `TELEGRAM_CHANNELS` is now only a migration fallback, DB is authoritative); per-channel settings (min confidence, AI extraction on/off, sync interval) manageable via the provider-management API/dashboard.

What the user should expect differently: Telegram vacancies are no longer keyword-regex-guessed — they're populated from an LLM extraction with a **deterministic, code-computed confidence score** (not the model's own self-reported confidence), and anything below that score never becomes a vacancy.

### 1.3 AI Matching + AI Orchestrator ("cost optimization")

Two genuinely separate caching subsystems exist — don't confuse them:

1. **Bulk vacancy matching / message extraction** (`AiMatchingService` → `MatchingEngine`, and `MessageExtractionEngine`): each gets its **own** `InMemoryAICache` instance (`packages/ai/src/cache/ai-cache.ts`) — a plain in-process `Map`, 60-minute default TTL, **not** persisted, **cleared on every backend restart**, **not** shared between the two engines, **not** wired to the `AI_CACHE_TTL_MS` env var (that only affects the orchestrator below).
2. **AI Orchestrator** (`packages/ai-orchestrator`, `AIOrchestrator.execute()`): backs the 7 single-shot AI features exposed at `/api/v1/ai/*` (analyze-vacancy, cover-letter, interview-prep, salary-analysis, company-analysis, resume-improvement, career-advice). This one **is** DB-persisted (`AICache` table via `PersistentCache`), tracks every call in `AIJob`/`AIUsage`, honors `AI_CACHE_TTL_MS`, and is gated by `AI_ORCHESTRATOR_MODE` (default `manual`).

Also new: `AIBudget` (per-user/global token/cost caps), `AIProviderConfiguration` (per-user provider/model override), and a `/api/v1/ai/usage/dashboard` endpoint showing today/week/month spend, cache-hit-derived "saved tokens," and most-expensive/most-frequent feature.

Resume tailoring (`tailor_resume`) is **not** in the orchestrator anymore — ADR-031 moved it to its own async BullMQ pipeline (`TailoringRequestService` + `apps/worker`), polled via `/api/v1/ai/tailor-resume/:id/status`.

### 1.4 Provider Registry / source-priority changes

`SOURCE_PRIORITY` (`apps/backend/src/config/source-priority.ts`) now ranks ~30 sources; ATS sources (Greenhouse/Lever/Ashby/etc.) outrank job boards, which outrank community sources (Telegram lowest at 40, `manual` lowest overall at 10). This governs which source's fields win when the same vacancy is seen from two sources.

### 1.5 Provider Quality

`ProviderManagementService.calculateProviderQuality()` (`apps/backend/src/services/provider-management-service.ts:347`) computes a 0-100 score per provider from real persisted data: % missing salary, % missing company, % missing location, % invalid apply URLs — weighted 30/30/25/15 respectively. Recomputing writes the score into `ProviderConfig.qualityScore`.

### 1.6 Company Watch

Unchanged in this pass architecturally, but relevant for QA: `CompanyWatch` → per-company ATS polling (11 ATS types incl. Personio now) → `CompanyWatchEvent` rows (`NEW_JOB`/`REMOVED_JOB`/`CHANGED_JOB`) → `CompanyWatchSyncLog` per sync run.

### 1.7 Known stub / not implemented

`apps/backend/src/routes/workspaces/workspace-routes.ts` — **all four workspace endpoints are hardcoded placeholders** (see Part 9, Critical #1). This is pre-existing, not something this pass touched, but it's worth knowing before you go testing multi-workspace behavior.

---

## PART 2 — What can be tested (manual checklist)

| # | Screen | Action | Expected | Should NOT happen |
|---|--------|--------|----------|--------------------|
| 1 | `/register` → `/login` | Register a new account | Redirected into `/app`, JWT issued, a `Workspace` created for you (real, via `AuthService`, **not** the stubbed workspace routes) | Login loop / redirect back to `/login` |
| 2 | `/app/sync` | Click "Sync All" | `POST /api/v1/sync/all` fires; each registered provider's status updates (last sync time, jobs found); a second click inside 60s | Second click within 60s should get a **429** ("Please wait 1 minute between sync requests") — this is the rate limiter, not a bug |
| 3 | `/app/sync` | Sync a single provider (e.g. `dou`, `remotive`) | New vacancies appear in `/app/search` shortly after; provider's `lastSyncAt`/job count updates | Sync claiming success with 0 jobs found for a provider that's clearly live (check `/api/v1/diagnostics/providers` for the real error) |
| 4 | `/app/settings/providers` | View provider list | Providers requiring config (Lever, Ashby, Workday, Teamtailor, SmartRecruiters, Recruitee, Comeet, Personio, Workable, Adzuna, SuperJob, France Travail) show as **not registered** unless their env vars are set; Greenhouse shows registered by default (JetBrains) | A provider silently crashing sync instead of just not registering |
| 5 | `/app/settings/providers` (quality tab / `/api/v1/providers/providers/quality`) | View provider quality scores | Score only appears once a provider has synced vacancies (`totalVacancies > 0`); brand-new providers show the 50 baseline | Score computed from zero data pretending to be meaningful |
| 6 | `/app/telegram` | Add a Telegram channel username | Channel appears in list; toggle enabled/disabled | — |
| 7 | `/app/telegram` → sync `telegram` provider | Trigger sync | `SocialMessage` rows created (`PENDING`) → pipeline runs same tick → statuses move to `EXTRACTED`/`LOW_CONFIDENCE`/`SPAM`/`SKIPPED_PRECHECK`/`FAILED` (see Part 5) → only `EXTRACTED` ones can become vacancies **on the next sync tick** | Vacancies appearing instantly from a message that scored `LOW_CONFIDENCE` or `SPAM` |
| 8 | `/app/search` | Run a search with a Search Profile | Vacancies list with AI match scores (if `AI_ENABLED=true` and a profile+resume exist) | Every vacancy scored — only triage-passing, top-N candidates get an AI call (`AI_MAX_CANDIDATES`/`AI_MIN_TRIAGE_SCORE`) |
| 9 | Any vacancy → "Analyze" button | Click twice in a row on the same vacancy+profile | First call: `cached: false`, real latency, an `AIJob` row created; second call: `cached: true`, `latencyMs: 0` in the usage record | Second call re-charging tokens/cost (check `/api/v1/ai/usage/dashboard`) |
| 10 | `/app/ai` (usage dashboard) | View after a few AI actions | Today/week/month totals, `savedTokens` from cache hits, most expensive/frequent feature | Zeroes after you've actually triggered AI actions |
| 11 | `/api/v1/ai/mode` (PUT, no dedicated UI seen) | Set mode to `manual` | Background/automatic features refuse to execute (mode gate in `AIModeManager`) | Silent execution while mode is `manual` for a feature meant to be gated |
| 12 | `/app/diagnostics` (needs `DIAGNOSTICS_ENABLED=true`) | Open page | Per-provider health snapshot, BullMQ queue depth, recent search-run traces (with per-vacancy exclusion reasons), AI provider health + `cacheReused`/`triageTotal`/`triagePassed`/`failed` counters | 404 — if you see this, check the env flag first |
| 13 | `/app/company-watch` | Add a company + trigger `/:id/sync` | `CompanyWatchSyncLog` row created (`PENDING`→`RUNNING`→`SUCCESS`/`FAILED`); new postings create `CompanyWatchEvent` rows | — |
| 14 | `/app/applications` | Move an application through pipeline statuses | Status updates persist; follow-ups/interviews/communications attach correctly | — |
| 15 | `/app/resumes` → tailor a resume for a vacancy | Trigger tailoring, poll status | Async job via BullMQ (`apps/worker`), NOT the synchronous AI orchestrator — poll `/api/v1/ai/tailor-resume/:id/status` until `COMPLETED` | Tailoring blocking the request/timing out synchronously |
| 16 | Browser extension | Detect a vacancy on a supported site, click AI actions (analyze/tailor/cover-letter/interview-prep) | Backend call succeeds | **Results are not displayed anywhere in the extension UI** — this is a known gap (per `docs/product/CURRENT_FEATURES.md`), not a bug you need to re-report |
| 17 | `/app/workspaces` (if a UI exists) or `GET /api/v1/workspaces` | List/create a workspace | **Returns hardcoded placeholder data regardless of what's in the DB** — see Part 9 Critical #1 | Don't spend time debugging "my workspace name isn't saving" — it's a known stub |

---

## PART 3 — Providers (current inventory)

Config source of truth: `apps/backend/src/container.ts` (`registerConfiguredProviders`, lines ~280-675) and `.env.example`. "Configured?" reflects a totally fresh `.env` copied from `.env.example` with no values filled in beyond the defaults that ship in `packages/shared/src/config.ts`.

| Provider | Registered w/ blank `.env`? | Needs API key/config? | Direct apply? | Endpoint | Test it |
|---|---|---|---|---|---|
| `hh` (HeadHunter) | Yes (always) | No (token only raises rate limits) | Yes | `api.hh.ru/vacancies` | `POST /api/v1/sync/hh`. **Known-blocked**: `api.hh.ru` returns HTTP 403 (DDoS-Guard) from most cloud/datacenter IPs — a 0-result sync here is very likely this, not a code bug. See `docs/hh-api-403-investigation.md`. |
| `greenhouse` | **Yes** (defaults to JetBrains board) | No, unless you want a different board | Yes | `boards-api.greenhouse.io/v1/boards/jetbrains` | `POST /api/v1/sync/greenhouse` — should return real JetBrains postings out of the box |
| `lever` | No | `LEVER_COMPANY`, `LEVER_COMPANY_NAME` | Yes | `api.lever.co/v0/postings/{company}` | Set both env vars to a real Lever-hosted company, restart, sync |
| `ashby` | No | `ASHBY_JOB_BOARD_NAME`, `ASHBY_COMPANY_NAME` | Yes | `api.ashbyhq.com/posting-api/job-board/{name}` | same pattern |
| `workday` | No | `WORKDAY_TENANT`, `WORKDAY_SITE`, `WORKDAY_COMPANY_NAME` | Yes | `wd1.myworkdayjobs.com` (host overridable) | same pattern |
| `smartrecruiters` | No | `SMARTRECRUITERS_COMPANY`, `_COMPANY_NAME` | Yes | `api.smartrecruiters.com/v1` | same pattern |
| `recruitee` | No | `RECRUITEE_COMPANY`, `_COMPANY_NAME` | Yes | `api.recruitee.com/v3` | same pattern |
| `comeet` | No | `COMEET_TOKEN`, `COMEET_COMPANY_UID`, `_COMPANY_NAME` | Yes | `www.comeet.co/careers-api/2.0` | same pattern |
| `teamtailor` | No | `TEAMTAILOR_API_KEY`, `_COMPANY_NAME` | Yes | `api.teamtailor.com/v1/jobs` | same pattern |
| `personio` | No (no default tenant, unlike Greenhouse) | `PERSONIO_COMPANY`, `_COMPANY_NAME` | Yes | `{company}.jobs.personio.de/xml` | Pick a real Personio-hosted DACH company subdomain |
| `workable` | No | `WORKABLE_ACCOUNT_SLUG`, `_COMPANY_NAME` | Yes | `apply.workable.com/api/v1/widget/accounts/{slug}` | same pattern |
| `adzuna` | No | `ADZUNA_APP_ID`, `ADZUNA_APP_KEY` | Depends on listing | `api.adzuna.com/v1/api` | Free registration at developer.adzuna.com |
| `superjob` | No | `SUPERJOB_API_KEY` | Yes | `api.superjob.ru/2.33` | Free key at api.superjob.ru/register — **registration page itself can 403 from datacenter IPs** |
| `france_travail` | No | `FRANCE_TRAVAIL_CLIENT_ID`, `_CLIENT_SECRET` | Yes | OAuth2 token + `api.francetravail.io/partenaire/offresdemploi/v2/offres/search` | Free OAuth2 registration at francetravail.io. **Credentials currently unavailable in this environment — cannot be tested end-to-end** (see Part 8) |
| `telegram` | No | `TELEGRAM_CHANNELS` (env fallback) or ≥1 DB channel | No (community-sourced) | scrapes `t.me/s/<channel>` (or Bot API if `TELEGRAM_BOT_TOKEN` set) | Add a channel via `/app/telegram` or `TELEGRAM_CHANNELS`, then sync. See Part 5 for the full pipeline. |
| `linkedin` | Yes (unless `LINKEDIN_ENABLED=false`) | No | Redirect-based | `www.linkedin.com` (Guest API/scrape) | `POST /api/v1/sync/linkedin` |
| `remotive` | Yes | No | Yes | `remotive.com/api/remote-jobs` | `POST /api/v1/sync/remotive` |
| `himalayas` | Yes | No | Yes | `himalayas.app/jobs/api` | same |
| `arbeitnow` | Yes | No | Yes | `www.arbeitnow.com/api/job-board-api` | same |
| `jobicy` | Yes | No | Yes | `jobicy.com/api/v2/remote-jobs` | same |
| `we_work_remotely` | Yes | No | Redirect | `weworkremotely.com/categories/remote-programming-jobs.rss` | same |
| `working_nomads` | Yes | No | Yes | `www.workingnomads.com/api/exposed_jobs` | same |
| `nodesk` | Yes | No | Redirect | `nodesk.co/remote-jobs/index.xml` | same |
| `hn_hiring` | Yes | No | N/A (HN thread reply) | `hn.algolia.com/api/v1/search` + `news.ycombinator.com` | same — expect low apply-URL quality, this is a community board |
| `habr_career` | Yes | No | Yes | `career.habr.com/vacancies/rss` | same |
| `dou` | Yes | No | Yes | `jobs.dou.ua/vacancies/feeds/` (per-category) | same |
| `pyjobs` | Yes | No | Yes | `www.pyjobs.com/rss` | same |
| `django_jobs` | Yes | No | Partial | `builtwithdjango.com/jobs/feed/rss` + djangojobboard.com Atom (company `Unknown` on the Atom side) | same |
| `speedrun` | Yes | No | Yes (confirmed live 2026-07-30, see Part 8) | `speedrun-talent-network.com/api/v1/jobs` | same |
| `wellfound` / `otta` | **N/A — no code exists** | — | — | — | **Cannot be tested.** Reserved priority-config slots only; do not spend time looking for a sync button. |

---

## PART 4 — New providers (Free Provider Expansion, Phase 2)

For `dou`, `pyjobs`, `django_jobs`, `speedrun`, `france_travail` (the ones actually shipped this pass):

**How to verify each works:**
1. Set `DIAGNOSTICS_ENABLED=true`, restart backend.
2. `POST /api/v1/sync/<provider>` (or use the Sync page button).
3. Check `GET /api/v1/diagnostics/providers` for that provider's health snapshot (last success/failure, latency).
4. Check `GET /api/v1/sync/status` for job counts.

**How to inspect imported vacancies:**
- `GET /api/v1/vacancies?source=<provider>` (dashboard: `/app/search`, filter by source).
- Or query the DB directly: `SELECT * FROM "VacancySource" WHERE "providerId" = '<provider>' ORDER BY "discoveredAt" DESC;` joined to `"Vacancy"` on `vacancyId`.

**How to verify field quality (per vacancy row, via `/app/search/<id>` detail or the DB join above):**
- **Company** — check `Vacancy.companyId` → `Company.name`. `django_jobs`' Atom-sourced half is *expected* to show `Unknown` (no separable company field in that feed) — this is documented, not a bug.
- **Salary** — `salaryMin`/`salaryMax`/`currency` on `Vacancy`. Most RSS-based sources (dou, pyjobs) don't reliably have structured salary — absence is expected, not a defect.
- **Location** — `Vacancy.location`.
- **Remote** — `Vacancy.remote` (`ONSITE`/`REMOTE`/`HYBRID`/`UNKNOWN`).
- **Apply URL** — `VacancySource.applyUrl` / `sourceUrl`. For `speedrun`, this should be the list endpoint's own job-page URL (the per-job detail endpoint is deliberately not called — see EPIC.md Phase 2 note).
- **Deduplication** — check `VacancyMergeAudit` for `sourceId`/`sourceName` matching this provider; a genuine dedup event shows a merge audit row explaining which field lost to which source's higher `SOURCE_PRIORITY`. If the same real posting appears twice as separate `Vacancy` rows instead of one `Vacancy` with two `VacancySource` rows, that's a dedup miss worth reporting.

**France Travail — cannot be fully tested right now:** no `FRANCE_TRAVAIL_CLIENT_ID`/`SECRET` are registered in this environment (Part 8). If you obtain them, register a free account at francetravail.io, set both vars, restart, and sync — this will be the **first live test** of this provider's field mapping.

---

## PART 5 — Telegram V2

**Pipeline (ground truth: `apps/backend/src/services/social-message-pipeline.ts`, `packages/database/prisma/schema.prisma` lines 1013-1190):**

```
TelegramFetcher (scrape t.me/s/<channel>, or Bot API if TELEGRAM_BOT_TOKEN set)
  → SocialMessageIngestionService.ingestSource() writes SocialMessage rows (status: PENDING)
  → SocialMessagePipeline.processPendingBySource() — runs immediately after ingestion, same sync tick
       1. isLikelyJobPost() deterministic keyword precheck (packages/providers/src/shared/message-precheck-classifier.ts)
          fails → status = SKIPPED_PRECHECK, done, no AI call, no cost
       2. status = EXTRACTING
       3. MessageExtractionEngine.extract() calls the LLM → produces a MessageExtraction row
          + a deterministic 0-100 confidence score (computeMessageExtractionConfidence(),
            packages/ai/src/extraction/message-extraction-confidence.ts)
       4. classifyMessageExtractionStatus():
          - no title/company/technologies/requirements/responsibilities at all → SPAM
          - confidence < 40 → LOW_CONFIDENCE
          - otherwise → SUCCESS
       5. SocialMessage.processingStatus updated to match (EXTRACTED / LOW_CONFIDENCE / SPAM),
          or FAILED if the engine threw (PARSE_ERROR/PROVIDER_ERROR)
  → (next 'telegram' provider sync tick) TelegramFetcher.buildRawJob() looks up the latest
    extraction per message; only a SUCCESS-status extraction produces vacancy fields — anything
    else resolves to undefined, same as "not extracted yet" → no Vacancy created this tick.
```

**Tables to check:**
- `SocialMessage` — one row per raw Telegram message. Check `processingStatus`, `processingError`, `contentHash` (sha256 of normalized text — also the repost-detection key).
- `MessageExtraction` — one row per extraction attempt (versioned; reprocessing appends, never overwrites). Check `status`, `deterministicConfidence`, `missingFields`, `fromCache`, `tokensIn`/`tokensOut`/`estimatedCost`.
- `TelegramChannel` / `TelegramChannelSubscription` — per-channel config (enabled, min confidence, AI extraction on/off).
- `TelegramChannelStats` — pre-aggregated per-channel stats (extraction rate, spam rate, avg confidence) — check this updates after a sync.
- Eventually `Vacancy`/`VacancySource` with `providerId = 'telegram'` — **only** for messages that reached `SUCCESS`.

**Distinguishing the 5 statuses you asked about (plus 2 more that actually exist — `PENDING`, `EXTRACTING`):**

| Status | Meaning | How to trigger it for a test |
|---|---|---|
| `PENDING` | Freshly ingested, not yet processed | Any message right after ingestion, before the pipeline runs |
| `SKIPPED_PRECHECK` | Failed the cheap keyword gate — obviously not a job post | Post/find a channel message with no job-related keywords at all |
| `EXTRACTING` | Mid-flight (should be transient — if you see many rows stuck here, the pipeline run crashed) | — |
| `EXTRACTED` | LLM extraction succeeded, confidence ≥ 40, has real signal | A clear, complete job posting |
| `LOW_CONFIDENCE` | Has *some* signal (title/company/etc.) but scored < 40 — usually missing several key fields | A vague or very short job-adjacent post |
| `SPAM` | Extraction found **zero** job signal (no title, company, tech, requirements, or responsibilities at all) | A message that passed the cheap precheck's keyword gate but has no actual job content |
| `FAILED` | The extraction call itself threw (parse error or provider error), not a confidence judgment | Simulate by pointing `AI_PROVIDER` at an invalid key mid-test |

---

## PART 6 — AI Matching (verifying the optimization is real)

**Two separate things to verify — don't conflate them:**

### 6a. Bulk matching / message extraction cache (`InMemoryAICache`)
- Trigger the same vacancy+profile match twice **within the same backend process** (restart clears this cache entirely).
- Look for the log line `"Cache hit for AI request"` (`packages/ai/src/matching/matching-engine.ts` around line 123) at `debug`/`info` level.
- Check `GET /api/v1/diagnostics/ai` → `metrics.cacheReused` (backed by counter `careeros.ai_matching.reused`) — this should increment on the second identical bulk-match call and not on the first.
- Because this cache is pure in-memory and per-engine, it will **not** show anything in the DB — there's no `AICache` row for this path. Don't go looking for one.

### 6b. AI Orchestrator's persistent cache (single-shot features)
- Call `POST /api/v1/ai/analyze-vacancy` (or cover-letter/interview-prep/etc.) twice with identical input.
- First response: `"cached": false`, real `usage.latencyMs`, a new `AIJob` row (`status: COMPLETED`).
- Second response: `"cached": true`, `"status": "cached"`. Check `AIUsage` — the cache-hit record has `cacheHit: true`, `latencyMs: 0`, and **reuses the original tokensIn/tokensOut/estimatedCost** (not zeros) — this is a deliberate design choice (`orchestrator.ts:128-142`) so usage dashboards reflect the true cost the first call incurred.
- `GET /api/v1/ai/cache/stats` and `DELETE /api/v1/ai/cache` (optionally `?feature=analyze_vacancy`) let you inspect/reset the persistent cache directly.
- Query `SELECT * FROM "AICache" WHERE feature = 'analyze_vacancy' ORDER BY "createdAt" DESC;` — `hitCount` should increment on repeat hits.
- The cache key includes `inputHash` — each route computes this itself (e.g. `analyze-vacancy` uses `${vacancy.id}:${profile.id}:${vacancy.updatedAt.getTime()}`), so **editing the vacancy or profile invalidates the cache automatically** — a good edge case to test (change vacancy title, re-call, confirm `cached: false`).

**"Vacancy parsing cache" specifically** — this is the `MessageExtractionEngine`'s own `InMemoryAICache`, keyed off `SocialMessage.contentHash`. `MessageExtraction.fromCache` on a given row tells you whether that particular extraction was served from cache — check this column directly rather than inferring it from logs.

**What would prove the optimization is NOT working:** `cached: false` on a second, byte-identical call; `AIJob`/`AIUsage` rows for a call that should have hit cache; `careeros.ai_matching.reused` staying at 0 across repeated identical bulk-match runs.

---

## PART 7 — Database (key tables)

Ground truth: `packages/database/prisma/schema.prisma` (55 models). Postgres via `docker compose up -d`, connect with any client using `DATABASE_URL` from `.env`.

| Table | What appears | Created when | Key relationships |
|---|---|---|---|
| `Vacancy` | Merged/deduped job posting | First time any provider sees it | 1—N `VacancySource`, `MatchResult`, `Application`; N—1 `Company`, `Workspace` |
| `VacancySource` | One row per (provider, external ID) that contributed to a `Vacancy` | Every sync that discovers/re-sees a posting | N—1 `Vacancy`; unique on `(vacancyId, providerId, externalId)` |
| `VacancyMergeAudit` | A field-level record of which source overrode which, and why | Whenever `SOURCE_PRIORITY` causes a field to be overwritten during merge | N—1 `Vacancy` |
| `SocialMessage` | Raw Telegram (or future platform) message, immutable | Every ingested message, before any processing | 1—N `MessageExtraction` |
| `MessageExtraction` | Versioned AI extraction result | Every extraction attempt (including reprocessing) | N—1 `SocialMessage` |
| `TelegramChannel` / `TelegramChannelSubscription` / `TelegramChannelStats` | Channel config, per-workspace overrides, aggregated stats | Channel added; subscription created; stats recomputed | — |
| `AIJob` | One row per orchestrator `execute()` call (not per cache hit) | Every non-cached orchestrator call | N—1 `User`; optional loose ref to `vacancyId`/`applicationId` |
| `AICache` | Persistent AI response cache (orchestrator only) | First orchestrator call for a given cache key | Looked up by `cacheKey` unique index |
| `AIUsage` | Every orchestrator call, cached or not | Every `execute()` call | N—1 `User`, optional `jobId` |
| `AIBudget` | Per-user/global token/cost caps | User sets a budget via `PUT /api/v1/ai/budget` | N—1 `User` (nullable = global) |
| `MatchResult` | Bulk AI-matching output (score, fit breakdown, reasoning) | `AiMatchingService` scores a vacancy against a profile | N—1 `Vacancy` |
| `CompanyWatch` / `CompanyWatchEvent` / `CompanyWatchSyncLog` | Watched company config / detected job changes / sync run log | Company added; ATS poll finds a diff; every sync attempt | 1—N each off `CompanyWatch` |
| `Application` / `Communication` / `Interview` / `FollowUp` / `Recruiter` | Applications CRM | User applies / logs contact / schedules interview / sets reminder | All N—1 `Application` (except `Recruiter`, standalone) |
| `User` / `Workspace` / `WorkspaceMember` | Auth/tenancy | Registration | `WorkspaceMember` joins `User`↔`Workspace` |

---

## PART 8 — Known limitations (intentionally incomplete)

- **France Travail credentials** — no `FRANCE_TRAVAIL_CLIENT_ID`/`SECRET` provisioned in this environment. Provider is coded and conditionally registers, but **has never been exercised against a live response**; field mapping is built from static API docs, not a live sample. Get free credentials at francetravail.io to close this gap.
- **a16z Speedrun apply-flow** — resolved, not a limitation: manually verified 2026-07-30, real ATS direct-apply confirmed.
- **Common Crawl / YC / CNCF / Getro discovery pipeline (EPIC Phase 3)** — not started. No tooling exists yet to bulk-discover CompanyWatch candidates; onboarding new companies is still fully manual.
- **Djinni, work.ua, NoFluffJobs/JustJoin.it, Bundesagentur, ai-jobs.net, BuiltIn (EPIC Phase 4)** — not started, pending product risk sign-off.
- **Diaspora/niche RSS (EPIC Phase 5)** — not started.
- **`otta`/`wellfound`** — reserved priority-config slots only, deliberately never to be built as real providers.
- **Browser extension AI actions** — trigger successfully but results aren't displayed anywhere in the extension UI (a real gap, not a bug per se — nothing is broken, the feature is just half-wired).
- **Workspace management** — see Part 9 Critical #1; entirely stubbed.
- **AI Orchestrator's job queue** — `AIJobQueue` (`packages/ai-orchestrator/src/queue/ai-job-queue.ts`) exists and is constructed, but `AIOrchestrator.execute()` runs handlers **synchronously inline** (its own comment: "Execute synchronously (for now — can be made async with queue)") — the queue path is not the live path for the 7 orchestrated features today.
- **Diagnostics gate** — `DIAGNOSTICS_ENABLED` defaults falsy; don't mistake "diagnostics 404" for a broken build.

---

## PART 9 — Bugs (known, unfixed)

### Critical
1. **Workspace management is entirely fake.** `apps/backend/src/routes/workspaces/workspace-routes.ts` — all 4 endpoints (`GET /`, `POST /`, `POST /:id/invite`, `PUT /:id/members/:userId/role`) return hardcoded placeholder data (`id: 'placeholder-id'`, always `success: true`) regardless of request body or actual DB state. Creating a workspace via this API does not persist anything; inviting a member does nothing. (Note: the *real* workspace created at registration, via `AuthService`, is unaffected by this — only these standalone management endpoints are stubbed.)

### Medium
2. **France Travail provider is unverified in production conditions** — correctness of its field mapping (salary/location/ROME-code filtering) cannot be confirmed until real credentials are used against a live response (Part 8).
3. **AI Orchestrator executes synchronously despite having a job queue built** — under load, a slow provider call blocks the request thread instead of being queued; the `AIJobQueue`/BullMQ path exists but isn't wired into `execute()`.

### Low
4. **`django_jobs`' Atom-sourced half has no company field** — by design (documented), but worth knowing so you don't file it as a data-quality bug.
5. **HH (HeadHunter) is commonly blocked by DDoS-Guard from cloud/datacenter IPs** (documented in `docs/hh-api-403-investigation.md`) — a 0-result HH sync in most cloud dev/CI environments is expected, not a regression.
6. **SuperJob's own key-registration page can 403 from datacenter IPs** — same class of issue, affects setup rather than runtime.

---

## PART 10 — Demo scenarios

1. **Cold-start registration → first sync.** Register, land on `/app`, hit "Sync All," confirm Greenhouse (JetBrains) and the ~14 zero-config job-board providers (`remotive`, `himalayas`, `arbeitnow`, `jobicy`, `we_work_remotely`, `working_nomads`, `nodesk`, `hn_hiring`, `habr_career`, `dou`, `pyjobs`, `django_jobs`, `speedrun`, `linkedin`) return vacancies.
2. **Configure one board-scoped ATS provider end to end.** Pick Lever or Ashby, set its two env vars to a real public company, restart, sync, confirm vacancies appear with `providerType: ATS` and a working apply URL.
3. **Telegram V2 full pipeline.** Add a channel, sync, and manually classify a sample of the resulting `SocialMessage` rows against their `processingStatus` — confirm at least one of each of `SKIPPED_PRECHECK`/`EXTRACTED`/`LOW_CONFIDENCE` shows up naturally, and that only `EXTRACTED` ones eventually get a matching `Vacancy` row after the next sync tick.
4. **AI matching, then prove the cache.** Create a Search Profile + upload a resume, run a search, note an AI-scored vacancy's exact score/reasoning, re-run the same search immediately, confirm identical output plus a `careeros.ai_matching.reused` bump in `/api/v1/diagnostics/ai`.
5. **Single-shot AI feature cache proof.** Call `/api/v1/ai/analyze-vacancy` twice back to back for the same vacancy+profile; confirm `cached: true` on call 2 and that `/api/v1/ai/usage/dashboard` didn't double-charge tokens.
6. **Invalidate the cache by editing input.** Repeat scenario 5, then edit the vacancy's title, call again, confirm `cached: false` this time (inputHash changed).
7. **Provider Quality after real data.** Sync a provider with genuinely messy data (e.g. `hn_hiring` or `telegram`), call `/api/v1/providers/providers/:id/quality`, confirm the score is materially lower than a clean ATS provider's.
8. **Company Watch a real company.** Add a Greenhouse- or Lever-hosted company to Company Watch, sync it, confirm a `CompanyWatchSyncLog` row and (if anything changed) `CompanyWatchEvent` rows.
9. **Deduplication across two sources.** Find (or contrive) a vacancy that's reachable from two configured sources at once (e.g. a company on both Greenhouse and LinkedIn), sync both, confirm one `Vacancy` with two `VacancySource` rows rather than two separate vacancies, and check `VacancyMergeAudit` for the resulting field-merge decision.
10. **Full applications CRM loop.** Save a vacancy → apply → log a recruiter + a communication → schedule an interview → set a follow-up → snooze/complete it — confirm each step's own table gets the expected row and the application's status timeline is coherent.

---

*Compiled 2026-07-30 by direct source inspection (container.ts, schema.prisma, route files, .env.example, config.ts) — not from other documentation. Where existing docs (`docs/product/CURRENT_FEATURES.md`, EPIC.md) were used for context, this was cross-checked against the actual code before being stated as fact here.*
