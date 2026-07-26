# CareerOS Infrastructure

## Docker Compose

The entire system starts with `docker compose up`.

### Services

| Service | Port | Purpose |
|---------|------|---------|
| backend | 3000 | Fastify REST API |
| worker | - | BullMQ background worker |
| dashboard | 3001 | Next.js frontend |
| postgres | 5432 | PostgreSQL database |
| redis | 6379 | Redis for queues/cache |
| pgadmin | 5050 | Database admin UI |
| mailpit | 8025 | Email testing (optional) |

### docker-compose.yml Structure

```yaml
version: '3.8'

services:
  postgres:
    image: postgres:16-alpine
    ports:
      - "5432:5432"
    environment:
      POSTGRES_DB: careeros
      POSTGRES_USER: careeros
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data

  backend:
    build:
      context: .
      dockerfile: apps/backend/Dockerfile
    ports:
      - "3000:3000"
    environment:
      DATABASE_URL: postgresql://careeros:${DB_PASSWORD}@postgres:5432/careeros
      REDIS_URL: redis://redis:6379
      JWT_SECRET: ${JWT_SECRET}
    depends_on:
      - postgres
      - redis

  worker:
    build:
      context: .
      dockerfile: apps/worker/Dockerfile
    environment:
      DATABASE_URL: postgresql://careeros:${DB_PASSWORD}@postgres:5432/careeros
      REDIS_URL: redis://redis:6379
    depends_on:
      - postgres
      - redis

  dashboard:
    build:
      context: .
      dockerfile: apps/dashboard/Dockerfile
    ports:
      - "3001:3000"
    environment:
      NEXT_PUBLIC_API_URL: http://backend:3000/api/v1
    depends_on:
      - backend

  pgadmin:
    image: dpage/pgadmin4
    ports:
      - "5050:80"
    environment:
      PGADMIN_DEFAULT_EMAIL: admin@careeros.dev
      PGADMIN_DEFAULT_PASSWORD: ${PGADMIN_PASSWORD}

volumes:
  postgres_data:
  redis_data:
```

## Environment Variables

### Required

```bash
# Database
DATABASE_URL=postgresql://careeros:password@localhost:5432/careeros
DB_PASSWORD=password

# Redis
REDIS_URL=redis://localhost:6379

# Auth
JWT_SECRET=your-jwt-secret
JWT_EXPIRES_IN=7d

# AI Provider
AI_PROVIDER=openai
OPENAI_API_KEY=sk-...
```

### Optional

```bash
# Telegram Bot
TELEGRAM_BOT_TOKEN=...
TELEGRAM_WEBHOOK_URL=...

# Email
SMTP_HOST=localhost
SMTP_PORT=1025
SMTP_USER=
SMTP_PASS=

# Notification
DEFAULT_NOTIFICATION_CHANNEL=telegram

# Job Providers
HH_API_KEY=...
LINKEDIN_SESSION_COOKIE=...
```

## Monorepo Build

### Turborepo Configuration

```json
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**", ".next/**"]
    },
    "dev": {
      "cache": false,
      "persistent": true
    },
    "lint": {
      "dependsOn": ["^build"]
    },
    "typecheck": {
      "dependsOn": ["^build"]
    },
    "test": {
      "dependsOn": ["^build"]
    }
  }
}
```

### Package Dependencies

```
apps/backend → packages/career, packages/database, packages/ai, packages/auth
apps/worker  → packages/career, packages/database, packages/ai, packages/notifications, packages/providers
apps/dashboard → packages/ui, packages/shared
packages/career → packages/shared
packages/resume → packages/shared, packages/ai
packages/analytics → packages/shared, packages/database
packages/interview → packages/shared, packages/ai
packages/ai → packages/shared
packages/database → packages/shared
packages/providers → packages/shared
packages/notifications → packages/shared
packages/telegram → packages/shared, packages/notifications
packages/auth → packages/shared, packages/database
```

## CI/CD Pipeline

### GitHub Actions

```yaml
name: CI
on: [push, pull_request]

jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      - run: npm ci
      - run: npm run lint

  typecheck:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      - run: npm ci
      - run: npm run typecheck

  test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16-alpine
        env:
          POSTGRES_DB: careeros_test
          POSTGRES_USER: careeros
          POSTGRES_PASSWORD: test
        ports: ['5432:5432']
      redis:
        image: redis:7-alpine
        ports: ['6379:6379']
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      - run: npm ci
      - run: npm run test
        env:
          DATABASE_URL: postgresql://careeros:test@localhost:5432/careeros_test
          REDIS_URL: redis://localhost:6379

  build:
    runs-on: ubuntu-latest
    needs: [lint, typecheck, test]
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      - run: npm ci
      - run: npm run build
```

## Development Setup

### Prerequisites
- Node.js 22+
- Docker & Docker Compose
- Git

### Quick Start

```bash
# Clone and install
git clone <repo>
cd career-os
npm install

# Start infrastructure
docker compose up -d postgres redis

# Run migrations
npm run db:migrate

# Seed database (optional)
npm run db:seed

# Start development
npm run dev
```

### Available Scripts

```bash
npm run dev          # Start all apps in dev mode
npm run build        # Build all packages
npm run lint         # Lint all packages
npm run typecheck    # Type check all packages
npm run test         # Run all tests
npm run db:migrate   # Run Prisma migrations
npm run db:seed      # Seed database
npm run db:studio    # Open Prisma Studio
```

## Monitoring

### Health Checks

Backend exposes:
- `GET /health` - Basic health check
- `GET /health/ready` - Readiness (DB + Redis connected)

### Logging

Structured JSON logging via `pino`:
```json
{
  "level": "info",
  "time": "2026-01-01T00:00:00.000Z",
  "service": "backend",
  "requestId": "uuid",
  "message": "Request processed"
}
```

### Metrics (Future)

Prometheus endpoint for:
- Request count and latency
- Job processing duration
- Queue depth
- AI API call costs
