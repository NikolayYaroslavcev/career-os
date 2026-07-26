# CareerOS Current Features

> Source of truth for what's actually implemented, verified directly against
> the codebase (not against other documentation) on 2026-07-24. Every path
> below was read, not assumed. Where something couldn't be verified without
> deeper code review, it's marked "not verified in this pass" rather than
> guessed. This file describes **current state**, not roadmap — see
> `docs/ROADMAP.md` and `epics/*.md` for what's planned.
>
> **2026-07-24 cleanup notes:** 3 dead worker job processors
> (`ai-job-processor.ts`, `company-watch-sync-processor.ts`,
> `notification-check-processor.ts`) and 45 dead barrel index.ts files were
> removed as confirmed-unused during a knip triage pass. 49 dependencies/
> devDeps were also removed (see `docs/development/knip.md` for the updated
> baseline). A security audit found and fixed Redis auth and AI cache tenant
> isolation issues (see `docs/development/security-audit.md`).

---

## Vacancy Discovery

### Job providers

**Status:** Implemented

**Backend:** `packages/providers/src/providers/` (23 provider directories), registered in `apps/backend/src/container.ts:225-537`

**Frontend:** `apps/dashboard/src/app/app/sync/page.tsx` (provider status/sync view), `apps/dashboard/src/features/diagnostics`

**Notes:**
23 live providers, each implementing the same `Fetcher` / `Mapper` / `Normalizer` / `SyncStrategy` pattern:

- **RU/CIS-relevant:** HeadHunter (`hh`), Habr Career (`habr_career`), SuperJob (`superjob`), Telegram channel scraping (`telegram`)
- **Global ATS/aggregators:** RemoteOK, Adzuna, Greenhouse, Lever, Ashby, Workday, Teamtailor, SmartRecruiters, Recruitee, Comeet, Remotive, Himalayas, Arbeitnow, Jobicy, We Work Remotely, Working Nomads, NoDesk, HN Who's Hiring, LinkedIn

Most providers are always-on; several (Greenhouse, Lever, Ashby, Workday, Teamtailor, SmartRecruiters, Recruitee, Comeet, Adzuna, SuperJob, Telegram) are conditionally registered and silently skipped when their config (board token / API key / channel list) is unset — see `docs/JOB_PROVIDERS.md` for exact env vars. Two providers don't use official APIs: LinkedIn fetches directly from `www.linkedin.com` (`packages/providers/src/providers/linkedin/linkedin-fetcher.ts`), and Telegram scrapes each channel's public `t.me/s/<channel>` HTML preview page (`packages/providers/src/providers/telegram/telegram-fetcher.ts`) — this conflicts with `adr/ADR-013-linkedin-integration-strategy.md`'s original "no scraping" decision, see that ADR's audit note.

### Telegram channels (as a vacancy source)

**Status:** Implemented

**Backend:** `packages/providers/src/providers/telegram/` (`telegram-fetcher.ts`, `telegram-mapper.ts`, `telegram-normalizer.ts`, `telegram-provider.ts`, `telegram-sync-strategy.ts`), config in `packages/shared/src/config.ts:162-167` (`TELEGRAM_CHANNELS`)

**Frontend:** None dedicated — vacancies surface in the normal search/dashboard flow like any other provider

**Notes:** Configured via comma-separated bare channel usernames (`TELEGRAM_CHANNELS=remoteit,frontend_jobs`). No bot token or login required — scrapes each channel's public preview page. Skipped entirely if unset. Not confirmed whether it matches the specific `@remoteit` + 10-subchannel network described in `research/job-sources-russian-sw/REPORT.md`.

This is distinct from the **Telegram bot integration** (account linking + digest delivery), which lives in `packages/telegram/` and `apps/backend/src/services/telegram-linking-service.ts` / `telegram-digest-formatter.ts` — see Applications CRM section for that.

### Browser extension (vacancy capture)

**Status:** Partial

**Backend:** `apps/backend/src/routes/extension/extension-routes.ts`

**Frontend:** `apps/extension/` (separate app, Manifest V3)

**Notes:** See the dedicated "Browser Extension" section below for full detail. Summary: detects vacancies on 9 specific job sites plus a generic JSON-LD fallback, can save them to CareerOS, and has panel buttons that trigger AI analyze/tailor/cover-letter/interview-prep actions on the backend — but none of those AI actions' results are displayed anywhere once triggered.

### Sync scheduler

**Status:** Implemented

**Backend:** `apps/backend/src/services/sync-scheduler-service.ts`, `apps/worker` (BullMQ)

**Frontend:** `apps/dashboard/src/app/app/sync/page.tsx`, `apps/dashboard/src/features/diagnostics`

**Notes:** Per-provider sync intervals defined in `DEFAULT_SYNC_INTERVALS` (`sync-scheduler-service.ts:37-58`) — 1 hour for most, 2 hours for lower-volume providers (Himalayas, We Work Remotely, Working Nomads, NoDesk, Habr Career), 24 hours for HN Who's Hiring. SuperJob, Telegram, and LinkedIn have no entry in that map and fall back to a generic default interval (`this.defaultIntervalMs`) rather than a tuned one. Tracks last sync result, next sync time, total jobs synced, and last error per provider/workspace.

---

## Search and Ranking

### Filters (SearchProfile)

**Status:** Implemented

**Backend:** `packages/career/src/domain/entities/search-profile.ts`, `apps/backend/src/services/search-profile-service.ts`, `apps/backend/src/routes/search-profiles/search-profile-routes.ts`

**Frontend:** `apps/dashboard/src/features/search-profiles/` (`search-profile-form.tsx`, `search-profile-list.tsx`)

**Notes:** A SearchProfile has: name, desired positions (list), desired technologies, experience level, desired salary, desired locations, remote-only flag. A user can have multiple named profiles; each can be active/inactive.

### Ranking engine

**Status:** Implemented

**Backend:** `apps/backend/src/services/ranking/vacancy-ranking-service.ts`, `vacancy-ranker.ts`

**Frontend:** Ranked results surface through `apps/dashboard/src/features/intelligence`, `apps/dashboard/src/features/recommendations`

**Notes:** Deterministic (non-AI) scoring — weights: Role match 35, Technology match 30, Experience 15, Remote/Location 10, Salary 5, Provider quality 5 (`vacancy-ranking-service.ts:61-68`). Produces a 0-100 score classified into 4 tiers: `HOT` (≥80), `WARM` (≥60), `COLD` (≥40), `REJECT` (<40) (`classifyTier`, same file). This deterministic ranker has no explicit version identifier in code. There is a separate, explicit version constant for the **AI matching** algorithm — `CURRENT_MATCHING_ALGORITHM_VERSION = '2.0.0'` in `packages/ai/src/matching/matching-algorithm-version.ts` — used to group/compare historical AI `MatchResult`s across algorithm revisions; don't conflate the two, they're different scoring systems (see AI Features section).

### Personalization

**Status:** Backend implemented, not wired to any frontend (produces zero effect today)

**Backend:** `apps/backend/src/services/ranking/preference-boost.ts`; recording endpoints live in `apps/backend/src/routes/vacancies/vacancy-routes.ts` (`POST /:id/view`, `/:id/save`, `/:id/hide`, `GET /:id/interactions`)

**Frontend:** No caller anywhere in `apps/dashboard` or `apps/extension` — verified by search, not just absence of a settings UI. Every user's interaction history is permanently empty, so `computePreferenceBoosts` always returns zero boosts in production.

**Notes:** Derives per-user boosts (technology, role, remote preference, location) from past `SAVE`/`APPLY`/`VIEW`/`HIDE`/`IGNORE` interactions, with time decay: full weight ≤7 days old, 70% at ≤30 days, 40% at ≤90 days (`getPreferenceDecayFactor`). The logic and its unit tests are correct; the gap is purely that nothing ever calls the recording endpoints, so no rows ever land in `UserVacancyInteraction`.

### Interaction learning

**Status:** Backend implemented, not wired to any frontend (same gap as Personalization above)

**Backend:** `apps/backend/src/services/ranking/vacancy-ranking-service.ts:8-14` (`INTERACTION_WEIGHTS`), `packages/career/src/domain/repositories/user-vacancy-interaction-repository.ts`

**Frontend:** None. (Previously documented as "implicit — every save/dismiss/apply/view action in the dashboard feeds this"; that was inaccurate as of this audit — no dashboard or extension code calls the interaction-recording endpoints.)

**Notes:** Weights: SAVE +10, APPLY +15, VIEW +2, IGNORE -10, HIDE -20. Feeds both the ranking service's `interactionBoost` and the personalization boosts above — both permanently 0 until the frontend/extension actually calls `POST /vacancies/:id/{view,save,hide}` on the corresponding user actions.

### Quality scoring

**Status:** Implemented

**Backend:** `apps/backend/src/services/ranking/vacancy-quality-score.ts`, `provider-quality-calculator.ts`

**Frontend:** Surfaces indirectly through ranking/tier, not shown as a standalone score in the UI (not verified in this pass — check `apps/dashboard/src/features/intelligence` for whether a raw quality number is ever rendered)

**Notes:** A 0-100 breakdown: company exists (15), salary exists (15), apply URL exists (15), description quality by length (25), source reliability / provider quality (15), freshness by days-since-published (15) — weights sum to 100 (`vacancy-quality-score.ts:13-20`). Freshness decays from 100 (≤1 day) to 10 (>60 days).

---

## AI Features

### AI matching

**Status:** Implemented

**Backend:** `packages/ai/src/matching/` (`matching-engine.ts`, `vacancy-analysis-orchestrator.ts`, `explainability.ts`), `packages/ai-orchestrator/` (provider routing, budget enforcement, caching), `apps/backend/src/services/ai-matching-service.ts`, `apps/backend/src/services/triage-matching-service.ts`

**Frontend:** `apps/dashboard/src/features/match-explanation/` (routed at `apps/dashboard/src/app/app/match-explanation/[matchResultId]/page.tsx`), `apps/dashboard/src/features/ai/ai-dashboard.tsx` (routed at `apps/dashboard/src/app/app/ai/page.tsx`)

**Notes:** 5 AI providers behind one interface with fallback: OpenAI, Anthropic, Gemini, Groq, OpenRouter (`packages/ai/src/providers/`, `fallback-ai-provider.ts`). `packages/ai-orchestrator` adds a resilience layer on top: provider routing, per-workspace budget enforcement (`usage/budget-enforcer.ts`), usage tracking, and a persistent cache — see ADR-025 and ADR-028. Match results include score, category, strengths/weaknesses/missing-skills, rendered via a radar chart and actionable-items list in the match-explanation UI. Matching runs decoupled from the search request (ADR-026) so a slow/rate-limited AI call can't hang the search response.

### Resume parsing

**Status:** Partial

**Backend:** `apps/backend/src/services/resume-service.ts`, `packages/ai/src/extraction/resume-extraction-engine.ts`, `packages/ai/src/prompts/structured-resume-extraction.ts`, `apps/backend/src/routes/resumes/resume-routes.ts`

**Frontend:** `apps/dashboard/src/features/resumes/resume-upload.tsx`, `resume-list.tsx`

**Notes:** PDF only — `ALLOWED_MIME_TYPES = ['application/pdf']` (`resume-service.ts:9`), text extracted via `pdf-parse`. DOCX and Markdown import were planned (see `epics/EPIC-11-resume-engine.md`) but never built. AI then extracts a structured profile (`StructuredResume` domain entity) from the raw text — that part works regardless of the PDF-only limitation. Files are stored on local disk; MinIO is provisioned in Docker but unused.

### Resume tailoring

**Status:** Partial — **two independent implementations**, each reachable from a different client

**Backend:** Two separate endpoint pairs exist:
1. `apps/backend/src/services/resume-tailoring-service.ts` → `apps/backend/src/routes/resumes/resume-tailoring-routes.ts` (`POST /resumes/tailor`)
2. `packages/ai-orchestrator/src/queue/job-handlers/tailor-resume-handler.ts` → `apps/backend/src/routes/ai/ai-routes.ts` (`POST /ai/tailor-resume`)

**Frontend:** `apps/dashboard/src/features/resume-tailoring/resume-tailoring-page.tsx` calls endpoint (1) via `fetch('/api/v1/resumes/tailor')` — but this page is **not imported by any route** under `apps/dashboard/src/app/`, so it's unreachable. Endpoint (2) is called by the **browser extension**'s panel "Tailor Resume" button (`apps/extension/src/content/core/panel-injector.ts:87`, `background/message-router.ts:62-63`) — reachable, but see Notes on what happens to the result.

**Notes:** Neither path is fully usable end-to-end today: path (1) has a UI but no route to it; path (2) is reachable but fire-and-forget — see "AI action results are not surfaced anywhere" below.

### Cover letters

**Status:** Partial — same dual-implementation pattern as resume tailoring

**Backend:** Two separate endpoint pairs:
1. `apps/backend/src/services/cover-letter-service.ts` → `apps/backend/src/routes/resumes/resume-tailoring-routes.ts` (`POST /resumes/cover-letter`)
2. `packages/ai-orchestrator/src/queue/job-handlers/cover-letter-handler.ts` → `apps/backend/src/routes/ai/ai-routes.ts` (`POST /ai/cover-letter`)

**Frontend:** `apps/dashboard/src/features/cover-letter/cover-letter-page.tsx` calls endpoint (1) via `fetch('/api/v1/resumes/cover-letter')` — not routed anywhere in `apps/dashboard/src/app`, unreachable. Endpoint (2) is wired to the extension panel's "Cover Letter" button, same as resume tailoring.

**Notes:** Same caveats as resume tailoring.

### Interview preparation

**Status:** Implemented on the backend; reachable only via the browser extension, not the dashboard

**Backend:** `packages/ai-orchestrator/src/queue/job-handlers/interview-prep-handler.ts` → `apps/backend/src/routes/ai/ai-routes.ts` (`POST /ai/interview-prep`)

**Frontend:** `apps/dashboard/src/api/ai.ts` exports `getInterviewPrep()`, but it is **not called from any dashboard component** (checked every `.tsx` file under `apps/dashboard/src/features`). The browser extension panel's "Interview Prep" button (`panel-injector.ts:89, 138-140`) does call it via the background service worker.

**Notes:** This corrects an earlier read of this codebase (including this session's own prior-turn edit to `adr/008-browser-extension-implementation-plan.md`, since fixed) that said interview prep "doesn't exist." That was wrong in one specific way: `packages/interview/src/index.ts` genuinely is a 2-line stub, and the `Interview` *domain entity* is just a scheduling record — but the actual AI interview-prep logic lives entirely in `packages/ai-orchestrator`'s job-handler layer, a different package than the name suggests. It generates 10 questions (with expected answers, difficulty, category), 5 tips, and key topics from the vacancy + resume + interview type. It's real and complete on the backend; the gap is purely front-end reachability and result display (see below).

### Other AI actions with a backend + API client but no UI caller at all

**Status:** Implemented on the backend; not reachable from the dashboard, and not wired into the extension either

**Backend:** `packages/ai-orchestrator/src/queue/job-handlers/`: `salary-analysis-handler.ts`, `company-analysis-handler.ts`, `resume-improvement-handler.ts`, `career-advice-handler.ts` → `apps/backend/src/routes/ai/ai-routes.ts` (`POST /ai/salary-analysis`, `/ai/company-analysis`, `/ai/resume-improvement`, `/ai/career-advice`)

**Frontend:** `apps/dashboard/src/api/ai.ts` exports a client function for each (`getSalaryAnalysis`, `getCompanyAnalysis`, `getResumeImprovement`, `getCareerAdvice`) — none are called from any `.tsx` file in the dashboard, and none of these four have a corresponding button in the extension panel either (only save/analyze/tailor/cover-letter/interview-prep are wired there).

**Notes:** These are fully implemented, real AI capabilities (each with its own prompt and structured JSON response schema) that are currently unreachable by any user through any client. Lower priority to wire up than tailoring/cover-letter/interview-prep since there's no partially-built UI for these yet — wiring them would be new frontend work, not just adding a route.

### AI action results are not surfaced anywhere

This applies to all of: analyze-vacancy, tailor-resume, cover-letter, and interview-prep as triggered from the **extension**. Clicking any of those buttons fires `chrome.runtime.sendMessage(...)`, which calls the matching `/ai/*` endpoint and gets back `{ jobId }` — the extension's click handlers for these four buttons (`tailor`, `cover-letter`, `interview-prep`; `analyze` additionally tracks a loading state) don't do anything with the response beyond that. `apps/extension/src/background/notification-manager.ts` has a `notifyAiCompleted(jobId, feature)` method that would show a browser notification — it is defined but **never called** anywhere in the extension. On the dashboard side, `apps/dashboard/src/features/ai/ai-dashboard.tsx` shows AI usage/cost/budget stats only — it does not render individual job results (`getAIJob`/`getAIJobs` from `api/ai.ts` are not called from it either). So: the job runs, presumably completes and stores a result server-side (queryable via `GET /ai/jobs/:jobId`, unused by any client), but no UI anywhere displays it. This is distinct from `analyze-vacancy`'s older, separate AI-matching path (`ai-matching-service.ts` / `MatchingEngine`) that **does** have a results UI at `apps/dashboard/src/app/app/match-explanation/[matchResultId]/page.tsx` — not confirmed in this pass whether the two "analyze vacancy" code paths (the orchestrator job-handler vs. the original matching service) produce/share the same stored result type.

### Limitations

- Resume parsing is PDF-only (see above).
- The 4 AI actions above (salary/company/resume-improvement/career-advice analysis) and the extension-triggered tailor/cover-letter/interview-prep/analyze results have no UI to view their output — see the two subsections above. This is the most significant AI-feature gap in the product: most of the AI capability surface is backend-complete and essentially invisible to a user.
- `apps/backend/src/routes/extension/extension-routes.ts`'s `/status` endpoint declares a `features` array (`'ai-interview-prep'`, `'ai-cover-letter'`, `'ai-resume-tailor'`, `'apply-tracking'`, etc.) that turned out to be **accurate** on closer reading — each of those is genuinely triggerable from the extension (apply-tracking via `handleApplyDetected` in `message-router.ts:140-173`, which PATCHes an application's status to `submitted`). An earlier pass through this codebase (including this session) assumed this list was aspirational without reading `panel-injector.ts` past its first ~115 lines; it wasn't. The real gap isn't whether these are wired, it's that their results aren't shown anywhere (see above).

---

## Applications CRM

### Kanban

**Status:** Implemented

**Backend:** `apps/backend/src/services/application-crm-service.ts`, `apps/backend/src/routes/applications/application-routes.ts`

**Frontend:** `apps/dashboard/src/features/applications/application-pipeline.tsx`, `application-detail.tsx`

**Notes:** Column-based pipeline view grouped by status.

### Statuses

**Status:** Implemented

**Backend:** `packages/career/src/domain/enums/application-status.ts`

**Frontend:** Reflected throughout `apps/dashboard/src/features/applications/`

**Notes:** 10 statuses in a fixed order: Saved → Started → Submitted → Waiting → HR Interview → Technical Interview → Final Interview → Offer, plus two terminal states (Rejected, Archived) reachable from any non-terminal status. `canTransitionTo()` enforces forward-only movement except into the two terminal states.

### Reminders (follow-up engine)

**Status:** Implemented, including a dedicated dashboard view

**Backend:** `apps/backend/src/services/follow-up-service.ts`, `apps/backend/src/services/application-crm-service.ts` (automatic scheduling on status change), `apps/backend/src/routes/follow-ups/follow-up-routes.ts` (cross-application aggregate API), `packages/notifications/src/follow-up-reminder-service.ts`, `apps/backend/src/services/digest-scheduler.ts`, `morning-digest-service.ts`

**Frontend:** `apps/dashboard/src/features/follow-ups/follow-ups-dashboard.tsx` at `/app/follow-ups` — overdue/today/upcoming/completed buckets, filters, manual creation, and a link back into the owning application. The per-application follow-up card inside `apps/dashboard/src/features/applications/application-detail.tsx` is unchanged and still the place to manage one application's follow-ups directly.

**Notes:** Automated scheduling + AI-generated follow-up message text (`follow-up-message.ts`), delivered through the notification dispatcher. `FollowUp` now carries an optional `type` (`FOLLOW_UP`/`INTERVIEW`/`REPLY_EXPECTED`/`CUSTOM`) so the lifecycle hooks can tell their own tasks apart and never stack duplicates for one application. The Telegram morning digest also gained a due-today follow-ups summary, separate from the existing 15-minute reminder sweep.

### Interviews

**Status:** Partial — scheduling only, no AI prep

**Backend:** `packages/career/src/domain/entities/interview.ts`, application routes' interview endpoints

**Frontend:** `apps/dashboard/src/features/applications/interview-scheduler.tsx`

**Notes:** Lets a user log an interview (type: hr/technical/system_design/behavioral/coding/cultural/final, date, duration, interviewer name/email, notes) and track completion. This scheduler is pure record-keeping and has no connection to AI-generated interview questions — that's a separate feature (see AI Features → Interview preparation) reachable only from the browser extension, not from this scheduler or anywhere else in the dashboard.

### Recruiter management & communication history

**Status:** Implemented

**Backend:** `apps/backend/src/services/recruiter-service.ts`, `apps/backend/src/routes/recruiters/recruiter-routes.ts`, `packages/career/src/domain/entities/recruiter.ts`, `communication.ts`

**Frontend:** `apps/dashboard/src/features/applications/communication-log.tsx`

**Notes:** Not explicitly requested by the task template but directly adjacent to CRM status — included for completeness.

---

## User Profile

### Resume

**Status:** Partial (see AI Features → Resume parsing for detail)

**Backend:** `apps/backend/src/services/resume-service.ts`

**Frontend:** `apps/dashboard/src/features/resumes/resume-upload.tsx`, `resume-list.tsx`, `resume-page.tsx`

**Notes:** PDF-only upload; multiple resumes per user supported (`resume-list.tsx`).

### Skills

**Status:** Implemented

**Backend:** `packages/career/src/domain/value-objects/skill.ts`

**Frontend:** Surfaced through resume intelligence (`apps/dashboard/src/features/resume-intelligence/`) rather than a standalone skills editor

**Notes:** A `Skill` value object has a name, a level (`beginner`/`intermediate`/`advanced`/`expert`), and optional years of experience. Populated primarily via AI structured extraction from an uploaded resume, not manual entry (no dedicated "add skill" form found).

### Preferences

**Status:** Implemented

**Backend:** Folded into `SearchProfile` (see Search and Ranking → Filters) — there's no separate "preferences" entity

**Frontend:** `apps/dashboard/src/features/search-profiles/`

**Notes:** What the task template calls "preferences" and what this codebase calls a `SearchProfile` are the same thing — documented once here to avoid duplicating the Search and Ranking section.

### Search profiles

**Status:** Implemented, with an AI-assisted creation path

**Backend:** `apps/backend/src/services/search-profile-service.ts`, `apps/backend/src/services/search-profile-suggestion-service.ts`, `packages/ai/src/prompts/search-profile-suggestion.ts`

**Frontend:** `apps/dashboard/src/features/search-profiles/`, `apps/dashboard/src/features/resumes/resume-search-profile-suggestion.tsx`

**Notes:** Beyond manual creation, a user can generate a suggested SearchProfile from their uploaded resume via AI (`resume-search-profile-suggestion.tsx` — confirmed wired into the resumes feature, unlike cover letter/tailoring).

---

## Company Features

### Company watch

**Status:** Implemented

**Backend:** `packages/company-watch/` (full package: domain entities, repositories, services, ATS adapters), `apps/backend/src/routes/company-watch/company-watch-routes.ts`

**Frontend:** `apps/dashboard/src/app/app/company-watch/page.tsx`

**Notes:** Lets a user register a specific company's career page and get notified of changes, independent of the general job-provider pipeline. ATS adapters: Ashby, Greenhouse, Lever, Teamtailor, Workday, plus a generic custom-HTML adapter and a JSON-LD adapter (`packages/company-watch/src/adapters/`) — same ATS coverage pattern as the main provider list and the browser extension's detectors.

### Tracking

**Status:** Implemented

**Backend:** `packages/company-watch/src/services/company-watch-service.ts` (`syncCompany()`), `deduplication-service.ts`, `normalization-service.ts`

**Frontend:** `apps/dashboard/src/app/app/company-watch/page.tsx`

**Notes:** Each sync diffs the watched company's current job list against the last known state and reports new / removed / changed jobs (`SyncResult` in `company-watch-service.ts:6-15`), logged via `CompanyWatchSyncLog`. Verified in this pass: there is **no automatic scheduling at all**. `CompanyWatchService` is wired only into `apps/backend`'s container for on-demand API-triggered syncs; it is not on `sync-scheduler-service.ts`'s cadence. A user who "watches" a company only gets an update when they (or something calling the API) manually triggers a sync. (The `company-watch-sync-processor.ts` BullMQ handler that would have enabled automatic polling was removed as dead code on 2026-07-24 — it was never registered in the worker.)

---

## Browser Extension

**Status:** Partial

**Backend:** `apps/backend/src/routes/extension/extension-routes.ts`

**Frontend:** `apps/extension/` — separate Manifest V3 app (background service worker, content scripts, popup, options page)

### Supported job boards

Explicit per-site detectors in `apps/extension/src/content/providers/`: **LinkedIn, HH (hh.ru), Greenhouse, Lever, Ashby, Workday, Teamtailor, Recruitee, SmartRecruiters** (9 sites), plus a generic fallback using JSON-LD structured data (`content/providers/generic/jsonld.ts`) for sites without a dedicated detector. Declared in `manifest.json`'s `host_permissions`.

### Current capabilities

- Detect a vacancy on a supported page and inject a panel (`content/core/panel-injector.ts`) showing title, company, location, salary
- Save the detected vacancy to CareerOS with one click; panel shows a saved/not-saved badge
- Panel action buttons beyond Save: **Analyze**, **Tailor Resume**, **Cover Letter**, **Interview Prep** (`panel-injector.ts:84-90`) — each fires the matching `/ai/*` backend endpoint (see AI Features section for what happens to the result: currently nothing displays it)
- A "watching this company" badge and a match-percentage badge are templated into the panel (`panel-injector.ts:77-78`) but **never populated with real data** — `detector.ts:54-57` hardcodes `saved: false, companyWatched: false` and never sets a match percentage at all, so in the current code path these two badges never actually render
- Automatic apply-detection: when the extension detects the user submitted an application on a supported site, it PATCHes the matching CareerOS application to `submitted` status (`background/message-router.ts:140-173`, `handleApplyDetected`) — this is the real implementation behind the `/status` endpoint's `apply-tracking` feature flag
- Background service worker: auth token management (`background/auth-manager.ts`), periodic sync (`sync-manager.ts`), offline queue for actions taken while disconnected (`offline-queue.ts`), browser notifications (`notification-manager.ts` — though its `notifyAiCompleted` method is defined but never called)
- Popup: login, recent vacancies list, connection status bar (`popup/components/`)
- Options page: auth, backend URL settings, notification settings, privacy settings, per-provider toggles (`options/components/`)

### Limitations

- **AI action results aren't shown anywhere.** Clicking Analyze / Tailor Resume / Cover Letter / Interview Prep triggers a real backend job and gets a `jobId` back, but nothing in the extension or dashboard displays the result — see AI Features → "AI action results are not surfaced anywhere" for full detail. This is the most significant extension gap, more so than missing site coverage.
- **Match-percentage and company-watched badges are dead code in the current data flow** — templated in the UI, never populated (see above). Not the same thing as "the AI matching system doesn't work" — it works (see AI Features → AI matching), this panel just doesn't fetch/display its output.
- Coverage is capped at the 9 explicit sites above + generic JSON-LD. The extension's 9 sites overlap with only part of the 23-provider list from Vacancy Discovery (LinkedIn, HH, Greenhouse, Lever, Ashby, Workday, Teamtailor, Recruitee, SmartRecruiters are in both). The other 14 providers (RemoteOK, Adzuna, Comeet, Remotive, Himalayas, Arbeitnow, Jobicy, We Work Remotely, Working Nomads, NoDesk, HN Hiring, Habr Career, SuperJob, Telegram) have no corresponding extension detector — the extension and the main provider pipeline are two independent coverage sets that happen to overlap partially, not the same list.
- 4 of the 8 `/ai/*` actions (salary-analysis, company-analysis, resume-improvement, career-advice) have no button in the extension panel at all — only save/analyze/tailor/cover-letter/interview-prep are wired.

---

## Summary of gaps found across all sections

1. **The AI action layer (`/api/v1/ai/*`) is backend-complete but its results are invisible.** 8 distinct AI actions exist (analyze-vacancy, tailor-resume, cover-letter, interview-prep, salary-analysis, company-analysis, resume-improvement, career-advice), each with a real prompt and structured output. 5 of them are triggerable only from the browser extension panel (analyze/tailor/cover-letter/interview-prep) or not triggerable from any client at all (salary/company/resume-improvement/career-advice). None of their results are displayed anywhere — not in the extension, not in the dashboard. This is the single biggest gap in the product: a large amount of working AI capability that a user cannot currently see the output of.
2. **Resume tailoring and cover letters each have two independent, non-overlapping implementations** (`/resumes/tailor`+`/resumes/cover-letter` vs. `/ai/tailor-resume`+`/ai/cover-letter`), one with an orphaned dashboard page, one reachable-but-invisible via the extension. Consolidating to one path is probably worth doing before building more UI on either.
3. Interview preparation is real and complete on the backend (`packages/ai-orchestrator`'s job-handler, not the empty `packages/interview` package) but has zero dashboard reachability and, like the other extension-triggered actions, no visible result.
4. Several items marked "not verified in this pass" above (whether the orchestrator's `analyze_vacancy` and the older `ai-matching-service.ts` path share result storage, quality-score UI surfacing) — flagged rather than guessed; worth a follow-up pass if precision matters for a specific decision. Company-watch sync cadence *was* verified in a later pass (see item 6 below): there isn't one.
5. This document itself required a correction mid-creation: an initial read of `apps/extension/src/content/core/panel-injector.ts` stopped partway through the file and concluded the extension panel only supports Save — the file actually has 5 action buttons. Carried through to a fix of the same wrong claim in `adr/008-browser-extension-implementation-plan.md` from the prior documentation-audit session. Noted here as a caution against trusting a partial file read on a file this central.
6. **Two fully-implemented worker job handlers were never registered and have been removed** (2026-07-24): `company-watch-sync-processor.ts` (would have given Company Watch automatic polling) and `notification-check-processor.ts` (would have driven `NotificationDispatcherService.checkHighScoreJobs`/`checkInterviewApproaching`). A third, `ai-job-processor.ts`, was an earlier alternative to the AI orchestrator's own job handling. All three were confirmed dead code via knip analysis and removed. `apps/worker/src/index.ts` currently registers only the vacancy-analysis and follow-up-reminder queues.
7. **Interaction tracking and personalization ranking have zero frontend callers** (see Search and Ranking → Personalization / Interaction learning above, corrected in this pass from a previously-inaccurate "implicit" status) — the recording endpoints, service, and ranking-boost logic are all implemented and unit-tested, but nothing in `apps/dashboard` or `apps/extension` ever calls them, so every user's personalization boost is permanently zero in production.
