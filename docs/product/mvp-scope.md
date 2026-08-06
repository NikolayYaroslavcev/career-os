# CareerOS MVP Scope

> **2026-07-23 status note:** This document described a pre-implementation plan ("Status: Planned" for everything, "8 weeks to MVP"). The MVP has since shipped and the product has grown well past it. The tables below are corrected to reflect actual code state; see `docs/ROADMAP.md` for the fuller picture and `epics/*.md` for per-epic detail.

## Definition

The MVP is the smallest version of CareerOS that delivers value to users. It must be a complete, usable product, not a prototype.

## MVP Features

### Must Have (MVP)

| Feature | Description | Status |
|---------|-------------|--------|
| Docker Environment | One command to start everything | Done |
| Backend API | REST API with auth | Done |
| PostgreSQL + Prisma | Data persistence | Done |
| Redis + BullMQ | Background job processing | Done |
| Telegram Bot | Primary user interface — in practice the dashboard, not Telegram, became the primary UI | Done |
| Resume Parsing | PDF/DOCX/Markdown import | Partial — PDF only |
| AI Matching | Match jobs to resume | Done, plus multi-provider resilience layer beyond original scope |
| Job Provider (HH.ru) | At least one source | Done, plus 19+ more providers |
| Career CRM | Application tracking | Done |
| Follow-up Reminders | Automated follow-ups | Done — delivered via Telegram/digest, no dedicated dashboard view yet |

### Nice to Have (Post-MVP)

| Feature | Description | Status |
|---------|-------------|--------|
| Dashboard (Next.js) | Web interface | Done — now the primary UI |
| Multiple Job Providers | LinkedIn, Habr Career, HH | Done, plus 17 more (Greenhouse, Lever, Ashby, Workday, etc.) |
| Analytics | Application statistics | Done — Career Intelligence, see ADR-029 |
| Cover Letter Generation | AI-generated letters | Built (`cover-letter-service.ts` + dashboard component) but **not linked from any route** — unreachable in the UI |
| Interview Prep | Question generation | **Not built** — `packages/interview` is a two-line stub despite the `Interview` domain entity existing |
| Email Notifications | Secondary channel | Not verified — Mailpit is wired for local dev, production email delivery not confirmed |

### Not in MVP

| Feature | Reason | Current status |
|---------|--------|--------|
| Learning Engine | Requires data accumulation | Not built |
| Salary Prediction | Needs market data | Not built |
| Browser Extension | Separate project | **Built** — `apps/extension`, Manifest V3, detectors for 9 job sites; save-to-CareerOS flow works, AI match score / inline generation not yet added |
| Mobile App | Separate project | Not built |
| Interview Simulator | Complex, post-MVP | Not built |
| Resume Tailoring | Not originally scoped | Built (`resume-tailoring-service.ts` + dashboard component) but **not linked from any route** |

## Technical Scope

### Infrastructure
- Docker Compose with all services
- PostgreSQL 16
- Redis 7
- PgAdmin for DB management
- Mailpit for email testing

### Backend
- Fastify REST API
- JWT authentication
- Zod validation
- Structured logging (pino)
- Health checks

### Worker
- BullMQ job processing
- Scheduled tasks (cron)
- Job aggregation worker
- Match analysis worker
- Follow-up check worker

### Telegram Bot
- User registration/linking
- Job display with cards
- Apply/Favorite/Ignore actions
- /start, /search, /profile, /stats commands
- Notification delivery

### Domain
- User, Resume, Job, Application
- FollowUp, Recruiter, SearchProfile
- Repository interfaces
- Domain events

### AI
- OpenAI provider (primary)
- Match analysis
- Follow-up message generation
- Resume content generation

### Database
- 10 tables (see data-model.md)
- Prisma migrations
- Repository pattern

## Out of Scope for MVP

1. **Performance optimization** - Get it working first
2. **Advanced caching** - Redis caching only where needed
3. **Monitoring/alerting** - Basic health checks sufficient
4. **Load testing** - Manual testing only
5. **Internationalization** - English only
6. **Accessibility audit** - Basic a11y only

## Success Criteria

The MVP is complete when:

- [x] `docker compose up` starts all services
- [x] User can register and login
- [x] User can upload resume
- [x] System fetches jobs from HH.ru
- [x] System matches jobs to resume
- [x] User can apply to jobs via Telegram
- [x] System tracks application status
- [x] System sends follow-up reminders
- [ ] All tests pass — not verified in this pass, run `pnpm test` to confirm current state
- [ ] All type checks pass — not verified in this pass
- [ ] All lint checks pass — not verified in this pass

## MVP Testing Plan

### Manual Testing
1. Full user journey (register → upload resume → get jobs → apply)
2. Telegram bot interactions
3. Follow-up reminder flow
4. Error handling scenarios

### Automated Testing
1. Unit tests for domain logic
2. Integration tests for API endpoints
3. Repository tests with test database

## MVP Timeline

| Week | Focus |
|------|-------|
| 1 | Documentation, Bootstrap |
| 2 | Infrastructure |
| 3 | Domain Layer |
| 4 | Backend API + AI Layer |
| 5 | Job Providers |
| 6 | Job Pipeline + Telegram Bot |
| 7 | Career CRM + Follow-up Engine |
| 8 | Integration, Testing, Release |

**Original estimate: 8 weeks to MVP** — see `docs/ROADMAP.md` for actual status; this table is the original plan, not a record of what happened.

## Post-MVP Roadmap — status as of 2026-07-23

### v0.2 - Dashboard — shipped
- Next.js web interface — done
- Job browsing — done
- Application pipeline (Kanban) — done
- Resume management — done

### v0.3 - Analytics — shipped
- Application statistics — done (Career Intelligence, ADR-029)
- Salary analysis — not verified
- Skill demand — not verified
- Timeline view — done (`application-timeline.tsx`)

### v0.4 - Multiple Providers — shipped, far exceeded
- LinkedIn integration — done
- Habr Career integration — done
- Plus 17 more providers not in the original plan (Greenhouse, Lever, Ashby, Workday, Adzuna, etc.)

### v0.5 - Learning Engine — not built
- Recommendation improvements — a basic recommendation engine exists (`recommendation-service.ts`) but no learning/feedback loop
- Skill gap analysis — not built
- Career path suggestions — not built

### v1.0 - Full Platform — not reached
- Real gaps blocking this: Interview Assistant is an empty stub; cover letter and resume tailoring are built but not linked into the dashboard UI; learning engine not started.
