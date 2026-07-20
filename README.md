# CareerOS

CareerOS is an AI-powered career operating system: it searches job boards on your
behalf, deduplicates and persists vacancies, runs AI matching against your resume,
and surfaces ranked recommendations through a dashboard (and optionally Telegram).

This README covers getting the whole stack running locally. For product vision and
architecture, see [`CareerOS_AI_Agent_Project_Specification.md`](CareerOS_AI_Agent_Project_Specification.md)
and [`docs/`](docs/README.md).

## Quick Start

Prerequisites: Node.js 22+, pnpm 9.15+, Docker Desktop, Git.

```bash
# 1. Install dependencies
pnpm install

# 2. Copy env templates
cp .env.example .env
cp apps/dashboard/.env.example apps/dashboard/.env.local

# 3. Start infrastructure (Postgres, Redis, MinIO, Mailpit, pgAdmin)
docker compose up -d

# 4. Apply database migrations (+ seed the default workspace)
pnpm db:migrate
pnpm db:seed

# 5. Start everything (backend + dashboard)
pnpm dev
```

Then open the dashboard at **http://localhost:3001** and register an account.

RemoteOK and HH (hh.ru) need no configuration and are always active, so a fresh
checkout can search real jobs immediately — no API keys required for that part.
AI matching needs one API key (see [AI Configuration](#ai-configuration) below);
without one, search and persistence still work, only AI analysis is skipped.

### Docker-only alternative

`docker-compose.full.yml` runs the entire stack — Postgres, Redis, MinIO, Mailpit,
migrations, backend, worker, and dashboard — as containers, no local `pnpm dev` needed:

```bash
pnpm docker:full:up    # docker compose -f docker-compose.full.yml up -d --build
```

Then open `http://localhost:3001`. This is a separate stack from `docker compose up -d`
+ `pnpm dev` (different Postgres/Redis/MinIO volumes, so accounts don't carry over
between the two) — don't run both at once, they publish the same host ports. See
[`docs/LOCAL_DEVELOPMENT.md`](docs/LOCAL_DEVELOPMENT.md#docker-only-workflow-no-local-pnpm-dev)
for details.

## What's running, and where

| Service    | URL                          | Purpose                     |
| ---------- | ---------------------------- | ---------------------------- |
| Backend    | http://localhost:3000        | Fastify API (`/health`, `/api/v1/...`) |
| Worker     | http://localhost:3002        | BullMQ job processor (health-only HTTP) |
| Dashboard  | http://localhost:3001        | Next.js UI                  |
| PostgreSQL | localhost:5432               | Primary database            |
| Redis      | localhost:6379               | Cache & BullMQ queues        |
| MinIO      | http://localhost:9001         | Object storage console (provisioned, not yet wired to any feature — resume uploads currently go to local disk) |
| Mailpit    | http://localhost:8025         | Catches outbound email, no real SMTP needed |
| pgAdmin    | http://localhost:5050         | Database admin UI (`admin@careeros.dev` / `admin`) |

## Environment Variables

`.env.example` at the repo root documents every variable the backend and worker read
(they share one root `.env` — see [`docs/LOCAL_DEVELOPMENT.md`](docs/LOCAL_DEVELOPMENT.md#environment-variable-loading)
for why). The dashboard is a Next.js app and needs its own `apps/dashboard/.env.local`
(templated by `apps/dashboard/.env.example`), since Next.js only loads env files from
its own app directory.

Only two variables are truly required to boot the backend:

- `DATABASE_URL` — set by default to the `docker compose up -d` Postgres.
- `JWT_SECRET` — must be at least 32 characters; `.env.example` ships a placeholder, change it for anything beyond local use.

Everything else (Redis, MinIO, SMTP, AI, Telegram, every job provider) has a working
default or degrades gracefully when unset.

### Provider Configuration

See [`docs/LOCAL_DEVELOPMENT.md#job-providers`](docs/LOCAL_DEVELOPMENT.md#job-providers)
for the full table. Summary: RemoteOK and HH need nothing and are always on; Greenhouse,
Lever, Ashby, Workday, and Teamtailor each need a board/tenant identifier and are silently
skipped (with a startup warning in the logs) when unset — never a crash.

### AI Configuration

Set `AI_PROVIDER` (`openai` | `anthropic` | `groq` | `gemini` | `openrouter`) and its
matching `*_API_KEY`. See [`docs/LOCAL_DEVELOPMENT.md#ai-providers`](docs/LOCAL_DEVELOPMENT.md#ai-providers)
for fallback chains, timeouts, and concurrency limits. `GET /health`'s `ai` sub-check
reports whether the selected provider has a key configured (a config check, not a live
call — it won't burn API quota on every health poll).

Set `AI_ENABLED=false` to skip AI matching and the vacancy-analysis queue entirely —
`POST /intelligence/search` returns persisted vacancies immediately with no scores.
Useful for local UI work, provider debugging, and smoke tests without burning AI
provider quota. Defaults to `true`. See [ADR-026](adr/ADR-026-decoupled-vacancy-search.md)
for why search never waits on AI matching in the first place, even with this on.

## Running Locally

Day to day, once set up:

```bash
docker compose up -d
pnpm dev
```

To run a single app: `pnpm --filter @careeros/backend dev`, `pnpm --filter @careeros/worker dev`,
or `pnpm --filter @careeros/dashboard dev`.

Full details — demo scripts, database reset, environment variable loading rules,
troubleshooting — are in [`docs/LOCAL_DEVELOPMENT.md`](docs/LOCAL_DEVELOPMENT.md).

## Common Problems

- **Port already in use** — another process is bound to 3000/3001/5432/6379/9000-9001/8025/5050. Find and stop it, or stop the other CareerOS stack (`docker compose down` / `pnpm docker:full:down`).
- **`/health` or `/ready` return 503** — check `docker compose ps`; confirm `DATABASE_URL`/`REDIS_URL` in `.env` match the ports Docker actually exposes.
- **Backend won't start: "Invalid environment variables"** — `JWT_SECRET` is missing or shorter than 32 characters, or `DATABASE_URL` is unset. Check `.env` exists and was copied from `.env.example`.
- **Vacancy search runs but no AI analysis appears** — no `*_API_KEY` set for `AI_PROVIDER`, or the worker isn't running (`pnpm --filter @careeros/worker dev`, or check `docker compose -f docker-compose.full.yml ps worker`). Vacancies still persist; only the matching step is skipped/pending.
- **Stale/invalid auth token after switching between `pnpm dev` and `docker:full`** — the two stacks use separate database volumes. The dashboard detects a dead token, clears it, and redirects to `/login` automatically.

More troubleshooting (Prisma migration errors, Redis/Postgres connection issues) is in
[`docs/LOCAL_DEVELOPMENT.md#troubleshooting`](docs/LOCAL_DEVELOPMENT.md#troubleshooting).

## Verification

```bash
pnpm turbo typecheck
pnpm turbo lint
pnpm turbo test
pnpm turbo build
```

## Project Structure

```
career-os/
├── apps/
│   ├── backend/          # Fastify API server
│   ├── dashboard/        # Next.js frontend
│   └── worker/           # Background job processor (BullMQ)
├── packages/
│   ├── ai/               # AI provider abstraction (OpenAI, Anthropic, Groq, Gemini, OpenRouter)
│   ├── auth/             # Authentication (JWT + Argon2)
│   ├── career/            # Career domain logic
│   ├── database/         # Prisma ORM + repositories
│   ├── notifications/    # Notification providers
│   ├── providers/        # Job providers (RemoteOK, HH, Greenhouse, Lever, Ashby, Workday, Teamtailor)
│   ├── resume/           # Resume parsing
│   ├── shared/           # Config, Redis, health checks
│   └── telegram/         # Telegram bot integration
└── docs/                 # Architecture, ADRs, epics, detailed local dev guide
```
