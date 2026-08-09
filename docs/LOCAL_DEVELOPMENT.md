# Local Development Guide

## Architecture

| App       | Port | URL                     |
| --------- | ---- | ------------------------ |
| Backend   | 3000 | http://localhost:3000    |
| Dashboard | 3001 | http://localhost:3001    |

The backend and dashboard run on separate ports so they can run side by side. The dashboard's dev/start scripts hardcode `--port 3001`, and the backend defaults to `PORT=3000`, so `pnpm dev` never collides on a single port.

## Prerequisites

- Node.js 22+
- pnpm 9.15+
- Docker Desktop
- Git

## First-Time Setup

```bash
# 1. Install dependencies
pnpm install

# 2. Start infrastructure (Postgres, Redis, MinIO, Mailpit)
docker compose up -d

# 3. Apply database migrations
pnpm db:migrate

# 4. Start everything (backend + dashboard, via Turborepo)
pnpm dev
```

Before step 4, copy the env templates if you haven't already: `cp .env.example .env` and `cp apps/dashboard/.env.example apps/dashboard/.env.local` (see [Environment Variable Loading](#environment-variable-loading) for why the dashboard needs its own file).

## Daily Development

```bash
docker compose up -d
pnpm dev
```

`pnpm dev` runs `turbo dev`, which starts the backend (`next dev`-equivalent `tsx watch`) and the dashboard (`next dev --port 3001`) in parallel, each in its own terminal-multiplexed output. To run just one app:

```bash
pnpm --filter @careeros/backend dev
pnpm --filter @careeros/dashboard dev
```

## Docker-Only Workflow (no local pnpm dev)

For day-to-day personal use you don't need `pnpm dev` at all — `docker-compose.full.yml` runs postgres, redis, minio, mailpit, migrations, the backend, the worker, and the dashboard as containers:

```bash
pnpm docker:full:up    # docker compose -f docker-compose.full.yml up -d --build
```

Then open `http://localhost:3001`.

**This is a separate stack from `docker compose up -d` / `pnpm dev`.** `docker-compose.yml` (infra-only, used by `pnpm dev`) and `docker-compose.full.yml` (fully containerized) intentionally use different named Postgres/Redis/MinIO volumes (`postgres_data` vs `postgres_full_data`, etc.) so the two workflows never collide. The consequence: a user account and login session created under one stack does not exist in the other's database. Don't run both at once (they publish the same host ports), and don't switch between them expecting to stay logged in.

**First time on this stack:** register once at `http://localhost:3001/register`. After that, your session (and all app data — resumes, search profiles, etc.) survives `pnpm docker:full:down` / `pnpm docker:full:up` restarts, because:
- Postgres data lives in the named volume `postgres_full_data`, not the container — it's only wiped by `docker compose -f docker-compose.full.yml down -v` (note the `-v`).
- Uploaded resume PDFs live in the named volume `backend_uploads` (mounted at `/app/uploads` in the backend container) for the same reason.
- `JWT_SECRET` comes from the root `.env` file via `env_file:`, not generated at container start, so it's stable across rebuilds — access tokens don't silently invalidate just because you ran `--build` again.

**If you ever do land on a stale/invalid token** (e.g. a token left over from the `pnpm dev` stack, or from before a `down -v`), the dashboard now detects the failed API call, clears the dead token, and redirects you to `/login` automatically — no manual `localStorage` cleanup needed. Just log back in.

## Infrastructure Services

| Service  | Port  | Purpose               | Health Check                    |
| -------- | ----- | --------------------- | ------------------------------- |
| PostgreSQL | 5432  | Primary database      | `pg_isready -U careeros`       |
| Redis    | 6379  | Cache & queues        | `redis-cli ping`               |
| MinIO    | 9000  | Object storage        | `curl http://localhost:9000/minio/health/live` |
| MinIO Console | 9001  | MinIO web UI          | Open in browser                 |
| Mailpit  | 8025  | Email testing UI      | Open in browser                 |
| pgAdmin  | 5050  | Database admin UI     | Open in browser                 |

## Environment Variables

Key variables in root `.env` (backend):

```bash
# Database
DATABASE_URL=postgresql://careeros:careeros_dev@localhost:5432/careeros

# Redis
REDIS_URL=redis://localhost:6379

# App
PORT=3000
CORS_ORIGIN=http://localhost:3001

# Auth (required, min 32 chars)
JWT_SECRET=dev-only-secret-key-that-is-at-least-32-characters-long

# AI (optional for demo scripts)
AI_PROVIDER=openai
OPENAI_API_KEY=

# Telegram (optional for demo scripts)
TELEGRAM_BOT_TOKEN=
```

`CORS_ORIGIN` must match the dashboard's origin (`http://localhost:3001`) or the browser will reject cross-origin requests from the dashboard to the backend.

### Job Providers

Every job provider is optional and degrades gracefully — the container registers a
provider only when its required identifiers are set; anything else is skipped with a
`logger.warn` at startup, not a crash:

| Provider    | Required env vars                                                          | Notes |
| ----------- | ---------------------------------------------------------------------------- | ----- |
| HH (HeadHunter, hh.ru) | none (`HH_ACCESS_TOKEN` optional)                                | Always registered; a token only raises rate limits. |
| Greenhouse  | `GREENHOUSE_BOARD_TOKEN`, `GREENHOUSE_COMPANY_NAME`                          | Board-scoped. |
| Lever       | `LEVER_COMPANY`, `LEVER_COMPANY_NAME`                                        | Board-scoped. |
| Ashby       | `ASHBY_JOB_BOARD_NAME`, `ASHBY_COMPANY_NAME`                                 | Board-scoped. |
| Workday     | `WORKDAY_TENANT`, `WORKDAY_SITE`, `WORKDAY_COMPANY_NAME` (`WORKDAY_HOST` optional) | Tenant-scoped. |
| Teamtailor  | `TEAMTAILOR_API_KEY`, `TEAMTAILOR_COMPANY_NAME`                              | Board-scoped. |

HH needs no configuration, so a fresh checkout can always search jobs —
the board-specific providers are opt-in extras for a particular company's careers page.

### AI Providers

`AI_PROVIDER` selects the primary provider (`openai` | `anthropic` | `groq` | `gemini` |
`openrouter`); its matching `*_API_KEY` must be set or every AI call fails at request
time (`GET /health`'s `ai` sub-check reports this). Optional resilience knobs:

- `AI_FALLBACK_PROVIDERS` — comma-separated chain tried on a retryable failure, e.g. `openrouter,openai`.
- `AI_MODEL` — overrides the primary provider's default model (not applied to fallbacks — model IDs aren't portable across vendors).
- `AI_TIMEOUT_MS` — overrides the 60s per-request default.
- `AI_MAX_CONCURRENCY` — caps concurrent in-flight AI calls (unset = unlimited).

Groq's free tier has a tight per-minute token budget — vacancy matching is
serialized (concurrency 1) automatically when `AI_PROVIDER=groq`.

Key variables in `apps/dashboard/.env.local` (dashboard):

```bash
# Backend base URL — no /api/v1 suffix, the API client appends paths itself
NEXT_PUBLIC_API_URL=http://localhost:3000
```

## Demo Scripts

### Run Intelligence Flow Demo
```bash
pnpm demo:intelligence
```
Demonstrates: Resume → Search Profile → Provider Search → AI Matching → Recommendations → Application creation

### Run Morning Digest Demo
```bash
pnpm demo:digest
```
Demonstrates: Scheduler → Search Profile → Provider Search → AI Matching → Ranking → Digest Builder → Telegram

### Run Telegram Linking Demo
```bash
pnpm demo:telegram-link
```
Demonstrates: Create user → Generate link code → Simulate /start CODE → Verify connection → Send digest

## Health Verification

Once the backend is running on `http://localhost:3000`, confirm it's up before testing anything else:

```bash
curl http://localhost:3000/live    # {"status":"alive"}      — process is up
curl http://localhost:3000/health  # {"status":"healthy",...} — database + Redis reachable
curl http://localhost:3000/ready   # {"status":"ready"}       — safe to receive traffic
```

- `GET /live` - Liveness check (no dependencies)
- `GET /health` - Full health check. Always checks database + Redis (these gate the
  200/503 status code and the Docker `HEALTHCHECK`/`depends_on: condition: service_healthy`
  wiring). Also reports two informational sub-checks that never flip the overall
  status, since both are optional: `providers` (at least one job provider is
  registered — HH always is, so this is effectively always healthy)
  and `ai` (the configured `AI_PROVIDER` has an API key set — a config check,
  not a live call to the vendor, so it doesn't burn rate-limit budget on every poll).
- `GET /ready` - Readiness check (database + Redis)

The worker has no other HTTP surface, so it exposes the same shape on its own
port (`WORKER_HEALTH_PORT`, default 3002): `GET http://localhost:3002/live` and
`GET http://localhost:3002/health` (adds a `workers` check — both BullMQ
`Worker` instances report `isRunning()`).

If `/health` or `/ready` return 503, check `docker compose ps` and that `DATABASE_URL`/`REDIS_URL` in `.env` match the ports Docker exposes.

Once the dashboard is running on `http://localhost:3001`, open it in a browser — it should render without console errors about `NEXT_PUBLIC_API_URL` or CORS.

## API Endpoints

### Authentication (Public)
- `POST /api/v1/auth/register` - Register new user
- `POST /api/v1/auth/login` - Login
- `POST /api/v1/auth/refresh` - Refresh token

### Protected Routes (require Bearer token)
- `GET /api/v1/users` - User profile
- `GET /api/v1/workspaces` - Workspaces
- `GET /api/v1/vacancies` - Vacancies
- `GET /api/v1/applications` - Applications
- `GET /api/v1/resumes` - Resumes
- `GET /api/v1/search-profiles` - Search profiles
- `POST /api/v1/intelligence/search` - Run intelligence workflow
- `POST /api/v1/telegram/link` - Generate Telegram linking code

## Test Accounts & RBAC Verification

CareerOS has three `UserRole` values (`packages/database/prisma/schema.prisma`): `JOB_SEEKER` (default on registration), `RECRUITER`, and `ADMIN`. There is no self-service way to change a role — `apps/backend/src/scripts/promote-user-to-admin.ts` is the only path, and it writes directly to the database.

### Create a JOB_SEEKER

Just register normally — this is the default role for every new account:

```bash
curl -X POST http://localhost:3000/api/v1/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"email":"jobseeker@test.local","password":"TestPass!2024","firstName":"Job","lastName":"Seeker"}'
```

or via the UI at `http://localhost:3001/register`.

### Create an ADMIN

Register a second account the same way, then promote it:

```bash
pnpm --filter @careeros/backend exec tsx src/scripts/promote-user-to-admin.ts admin@test.local
```

**Log in again (or call `/api/v1/auth/refresh`) after promoting.** The role is baked into the JWT at issuance and trusted as-is by the backend on every request — it is not re-checked against the database per request, so an already-issued token keeps the old role until it's refreshed.

### E2E: the `authenticatedAdminPage` fixture

`apps/e2e/fixtures/auth.ts` exposes an `authenticatedAdminPage` fixture (alongside the regular `authenticatedPage`) for tests against admin-only pages (e.g. `apps/e2e/tests/providers.spec.ts`). It registers a dedicated fixed account and promotes it via the same `promote-user-to-admin.ts` script above, run against Postgres's host-published port (`5432` in `docker-compose.full.yml`) — so `@careeros/database` must be built on the host first:

```bash
pnpm --filter @careeros/database exec prisma generate
pnpm turbo build --filter=@careeros/database
```

### Areas gated to ADMIN only

`AdminGuard` (`apps/dashboard/src/lib/access/admin-guard.tsx`) wraps these routes, and the matching backend routes enforce `requireAdmin` (`apps/backend/src/middleware/require-role.ts`) independently:

| Area | Frontend route | Backend route(s) |
| --- | --- | --- |
| Diagnostics | `/app/diagnostics` | `GET /api/v1/diagnostics/*` (also requires `DIAGNOSTICS_ENABLED=true`, see below) |
| Providers | `/app/settings/providers` | `/api/v1/providers/*` |
| AI dashboard | `/app/ai` | `GET/PUT /api/v1/ai/mode`, `GET /api/v1/ai/cache/stats`, `DELETE /api/v1/ai/cache` (other `/api/v1/ai/*` endpoints, e.g. `/usage/dashboard`, are auth-only, not admin-only) |
| Sync | `/app/sync` | `/api/v1/sync/*` |

**Diagnostics needs one extra env var:** `DIAGNOSTICS_ENABLED=true` in the backend `.env` (default `false`). With the flag off, `/api/v1/diagnostics/*` 404s for every role, including ADMIN — the flag is checked before the role check.

**Not admin-gated, by design:** `/app/career-intelligence` has no `AdminGuard` and its backend routes have no `requireAdmin` — it's a JOB_SEEKER-facing feature, not a gap.

### Verification checklist

UI (log in as each account):
- JOB_SEEKER: the Diagnostics/Providers/AI/Sync nav items are absent, and navigating directly to any of the four routes above renders an "access forbidden" panel instead of page content.
- ADMIN: all four nav items are visible and the pages render normally.

API (bypasses the frontend guard — this is the authoritative check, since the frontend guard alone isn't a security boundary):

```bash
# no token -> 401
curl -i http://localhost:3000/api/v1/providers

# JOB_SEEKER token -> 403
curl -i http://localhost:3000/api/v1/providers -H "Authorization: Bearer <job_seeker_token>"
curl -i http://localhost:3000/api/v1/sync/status -H "Authorization: Bearer <job_seeker_token>"
curl -i http://localhost:3000/api/v1/ai/mode -H "Authorization: Bearer <job_seeker_token>"

# ADMIN token -> 200
curl -i http://localhost:3000/api/v1/providers -H "Authorization: Bearer <admin_token>"
```

## Database Management

### Reset Database
```bash
docker compose down -v
docker compose up -d postgres
pnpm db:migrate
```

### View Database
Open pgAdmin at `http://localhost:5050`:
- Email: `admin@careeros.dev`
- Password: `admin`

### View Emails
Open Mailpit at `http://localhost:8025`

### View Files
Open MinIO Console at `http://localhost:9001`:
- Username: `minioadmin`
- Password: `minioadmin`

## Troubleshooting

### Port Already in Use
```bash
# Find process using the port
netstat -ano | findstr :5432

# Kill the process (replace PID)
taskkill /PID <PID> /F
```

### Database Connection Refused
```bash
# Check if PostgreSQL is running
docker compose ps postgres

# Check logs
docker compose logs postgres
```

### Redis Connection Refused
```bash
# Check if Redis is running
docker compose ps redis

# Test connection
docker exec career-os-redis-1 redis-cli ping
```

### Prisma Migration Errors
```bash
# Reset migrations
docker compose down -v
docker compose up -d postgres
pnpm db:migrate
pnpm --filter @careeros/database exec prisma generate
```

### Backend Won't Start
1. Ensure `.env` file exists with valid `JWT_SECRET` (min 32 chars)
2. Ensure Docker services are running: `docker compose ps`
3. Ensure migrations are applied: `pnpm db:migrate`

### Backend Returns Placeholder Tokens
Auth routes currently return placeholder tokens. The real `AuthProviderImpl` from `@careeros/auth` needs to be wired into the DI container. The auth middleware correctly rejects invalid tokens, confirming JWT verification is functional.

## Environment Variable Loading

The backend and worker share a **single root `.env`** file as the source of truth for their config. The backend loads it explicitly via `dotenv` at startup:

```ts
import { config } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, '../../../.env') });
```

**Why root `.env` for backend/worker (not app-specific)?**
- Both share the same config values (database, Redis, JWT secret, etc.) in local development
- Single source of truth prevents env drift between packages
- `.env` is in `.gitignore` and never committed
- `.env.example` documents all required variables with safe defaults

**Why the dashboard is different:**
Next.js only loads `.env*` files from its own app directory (`apps/dashboard/`), never from the monorepo root, and it only exposes variables prefixed `NEXT_PUBLIC_*` to the browser. So the dashboard keeps its own `apps/dashboard/.env.local` (gitignored) with `NEXT_PUBLIC_API_URL`, documented in `apps/dashboard/.env.example`.

**When to add more app-specific `.env` files:**
- Production deployments where each service has different secrets
- CI/CD pipelines where env vars are injected per-service
- If an app needs a variable that others don't, prefer adding it to root `.env` first (others will ignore it via Zod defaults/optionals); only split it into an app-specific file if the framework requires it (as with Next.js above)

## Project Structure

```
career-os/
├── apps/
│   ├── backend/          # Fastify API server
│   ├── dashboard/        # Next.js frontend
│   └── worker/           # Background job processor
├── packages/
│   ├── ai/               # AI provider abstraction
│   ├── auth/             # Authentication (JWT + Argon2)
│   ├── career/           # Career domain logic
│   ├── database/         # Prisma ORM + repositories
│   ├── notifications/    # Notification providers
│   ├── providers/        # Job providers (HH, Greenhouse, Lever, etc.)
│   ├── resume/           # Resume parsing
│   ├── shared/           # Config, Redis, health checks
│   └── telegram/         # Telegram bot integration
└── docs/                 # Documentation
```
