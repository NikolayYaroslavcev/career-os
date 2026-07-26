# Security Audit Report

Date: 2026-07-24
Scope: Full codebase (backend, worker, dashboard, extension, packages/*)

## Summary

| Severity | Count | Fixed | Remaining |
|----------|-------|-------|-----------|
| CRITICAL | 4 | 2 | 2 (require manual action) |
| HIGH | 8 | 1 | 7 (documented) |
| MEDIUM | 12 | 0 | 12 (documented) |
| LOW | 7 | 0 | 7 (accepted) |

## Fixed in this pass

### CRITICAL: Redis unauthenticated access (Docker)
**Files:** `docker-compose.yml`, `docker-compose.full.yml`
Redis was exposed on host port 6379 with no authentication. Anyone on the
network could read job payloads (containing PII like resume text), inject
jobs, or exploit Redis MODULE LOAD for RCE.
**Fix:** Added `--requirepass` with `REDIS_PASSWORD` env var (default:
`careeros_redis_dev`). Updated all REDIS_URL references to include auth.
Updated healthchecks to pass `-a` flag.

### CRITICAL: AI cache cross-tenant data leak
**File:** `packages/ai-orchestrator/src/cache/cache-key.ts`
Cache keys were built from `provider:model:promptVersion:feature:contentHash`
with no userId. Two users analyzing the same job title/location/experience
could see each other's cached AI responses.
**Fix:** Added optional `userId` field to `CacheKeyInput`. Orchestrator now
passes `userId` into cache key generation, isolating responses per user.

## Requiring manual action (not fixed)

### CRITICAL: `.env` contains real GROQ API key
**File:** `.env:27`
The `.env` file contains `GROQ_API_KEY=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`.
While `.gitignore` excludes `.env`, the file is on disk and could be
accidentally committed via `git add -f`.
**Action required:** Rotate the GROQ API key immediately. Consider adding a
pre-commit hook that blocks `.env` commits.

### CRITICAL: Default weak Postgres/MinIO/PGAdmin passwords
**Files:** `docker-compose.yml:14,44,74`, `docker-compose.full.yml:33,63`
Default passwords (`careeros_dev`, `minioadmin`, `admin`) are documented
as overridable via env vars but are weak for any non-localhost deployment.
**Action required:** For staging/production, set strong passwords via env
vars. The config.ts production guard already rejects weak JWT secrets and
default MinIO credentials.

## Findings (not fixed, documented for awareness)

### HIGH: 4 orchestrator handlers bypass prompt injection protection
**Files:** `packages/ai-orchestrator/src/queue/job-handlers/career-advice-handler.ts`,
`interview-prep-handler.ts`, `company-analysis-handler.ts`,
`resume-improvement-handler.ts`
These handlers interpolate user-provided text (questions, vacancy
descriptions, resume text) directly into prompts without the
`wrapUntrustedContent` fencing used by the other 4 prompt builders in
`packages/ai`. While users can only "attack" their own LLM sessions, this
violates defense-in-depth.
**Recommendation:** Apply `wrapUntrustedContent` + `UNTRUSTED_CONTENT_SYSTEM_RULE`
to all 4 handlers.

### HIGH: 3 packages/ai prompts lack input fencing
**Files:** `packages/ai/src/prompts/salary-analysis.ts`,
`skill-gap.ts`, `resume-analysis.ts`
Same issue as above but in the core AI package. User inputs (job titles,
technologies, resume text) are interpolated raw into prompts.
**Recommendation:** Apply `wrapUntrustedContent` pattern consistently.

### HIGH: Access tokens not invalidated on logout
**File:** `apps/backend/src/services/auth-service.ts:207-211`
Logout only revokes the refresh token. The JWT access token remains valid
for up to 15 minutes. This is a common tradeoff for stateless JWTs.
**Recommendation:** Document this behavior. Consider a token blocklist for
high-security deployments.

### HIGH: Tokens stored in localStorage
**File:** `apps/dashboard/src/api/client.ts:29-31`
Both access and refresh tokens are in localStorage, accessible to any JS
on the page (XSS exposure). HttpOnly cookies would be more secure.
**Recommendation:** Migrate to HttpOnly cookies for refresh tokens.

### HIGH: Gemini API key passed in URL query string
**File:** `packages/ai/src/providers/gemini-provider.ts:52`
API key is in the URL (`?key=...`), visible in logs and proxy caches.
All other providers use header-based auth.
**Recommendation:** Evaluate using the `x-goog-api-key` header alternative.

### HIGH: No runtime validation of BullMQ job payloads
**Files:** `apps/worker/src/index.ts:64`, `packages/ai-orchestrator/src/queue/ai-job-queue.ts:75`
Job data is typed but not validated at runtime. Malformed payloads could
cause unexpected behavior.
**Recommendation:** Add Zod validation at job entry boundaries.

### HIGH: No job-level timeouts on vacancy-analysis worker
**File:** `apps/worker/src/index.ts:62-78`
No `lockDuration` or `stalledInterval` configured. BullMQ defaults
(30s lock) may be too short for AI calls or too long for stalled jobs.
**Recommendation:** Configure explicit timeouts matching AI_TIMEOUT_MS.

### MEDIUM: No dedicated rate limiting on auth endpoints
**Files:** `apps/backend/src/app.ts:70`, `routes/auth/auth-routes.ts`
Only global 100 req/min limit applies. Login brute-force limited to
~100 attempts/min per IP.
**Recommendation:** Add per-endpoint limits (5-10 login attempts/min).

### MEDIUM: AI routes load entities without workspace filtering
**File:** `apps/backend/src/routes/ai/ai-routes.ts:119-125`
`analyze-vacancy` loads vacancy by ID without workspace check. A user
knowing another user's vacancy ID could trigger AI analysis on it.
**Recommendation:** Add workspace ownership verification.

### MEDIUM: PUT /mode and DELETE /cache lack user scoping
**File:** `apps/backend/src/routes/ai/ai-routes.ts:520-555`
Any authenticated user can switch global AI mode or clear everyone's cache.
**Recommendation:** Gate behind admin-only authorization.

### MEDIUM: Provider API keys stored without encryption at rest
**File:** `apps/backend/src/routes/ai/ai-routes.ts:569-581`
API keys accepted via PUT /providers and stored in database. No encryption
indication in the storage path.
**Recommendation:** Encrypt API keys at rest in the aiProviderConfig table.

### MEDIUM: InMemoryCostTracker loses data on restart
**File:** `packages/ai/src/cost/cost-tracker-impl.ts:9-10`
MatchingEngine uses InMemoryCostTracker. Cost data is lost on process
restart.
**Recommendation:** Use the database-backed cost tracker consistently.

### MEDIUM: Budget check globally disableable
**File:** `packages/ai-orchestrator/src/orchestrator.ts:95`
`budgetCheckEnabled` can be set to `false` with no production guardrail.
**Recommendation:** Reject `budgetCheckEnabled: false` when NODE_ENV=production.

### MEDIUM: No dead letter queue for permanently failed jobs
**File:** `apps/worker/src/index.ts:86-96`
Failed jobs are logged but not inspectable/replayable. The vacancy-analysis
queue has no `removeOnFail`, so failed jobs accumulate indefinitely.
**Recommendation:** Add DLQ and `removeOnFail` limit.

### MEDIUM: No read_only/no-new-privileges/cap_drop on Docker services
**Files:** `docker-compose.yml`, `docker-compose.full.yml`
Standard CIS Docker benchmark hardening options not applied.
**Recommendation:** Add `security_opt: [no-new-privileges]` and
`cap_drop: [ALL]` to all services.

### MEDIUM: minio/minio image unpinned
**File:** `docker-compose.yml:35`
No version tag (implicit `latest`). Can break without warning.
**Recommendation:** Pin to a specific version (e.g. `minio/minio:RELEASE.2024-XX-XX`).

### MEDIUM: No TLS on Redis connections
**Files:** `packages/shared/src/redis.ts:22`
All Redis URLs use `redis://` (plaintext). If accessed over network,
traffic is cleartext.
**Recommendation:** Use `rediss://` for non-localhost deployments.

### MEDIUM: Loose JSON parsing in orchestrator handlers
**Files:** `packages/ai-orchestrator/src/queue/job-handlers/*.ts`
Handlers use `content.match(/\{[\s\S]*\}/)` without size/type bounds.
**Recommendation:** Add response size limits and structured validation.

## Positive findings (well implemented)

- Argon2id hashing with configurable parameters
- HS256 algorithm pinning with confusion protection (tested)
- JWT secret loaded from env, validated for weakness in production
- Refresh token rotation on use (old deleted, new issued)
- Consistent workspace isolation via `getWorkspaceId()` in route handlers
- User enumeration prevention (uniform error messages on login failure)
- Helmet security headers enabled
- Global rate limiting with Redis backing (now authenticated)
- Prisma ORM throughout (no raw SQL, no injection risk)
- PDF upload: type validation, size limit, UUID filenames, sanitized titles
- DOM-based XSS escaping in extension panel
- SSRF protection in company-watch (DNS rebinding resistant)
- Diagnostics routes gated behind config flag
- Transactional user + workspace + refresh token creation
- AI response validation in MatchingEngine (clamp, allowlists, fallbacks)
- wrapUntrustedContent fencing in 4 of 8 prompt builders
