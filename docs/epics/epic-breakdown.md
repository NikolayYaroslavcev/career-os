# CareerOS Epic Breakdown

> **2026-07-23 audit note:** This file's epic numbering does **not** match the
> canonical `epics/EPIC-*.md` directory at the repo root — they were planned
> independently and diverged. EPIC-01 through EPIC-06 happen to line up by
> number; EPIC-07 through EPIC-12 here do not. Mapping, and actual status
> verified against code (not against other docs):
>
> | This file | This file's scope | Canonical `epics/` equivalent | Actual status |
> |---|---|---|---|
> | EPIC-00 | Documentation & Architecture | *(no equivalent — meta)* | Ongoing — this very audit is an instance of it |
> | EPIC-01 | Project Bootstrap | EPIC-01 Bootstrap | **Done** |
> | EPIC-02 | Infrastructure Setup | EPIC-02 Infrastructure | **Done** |
> | EPIC-03 | Domain Layer | EPIC-03 Domain Layer | **Done** |
> | EPIC-04 | Backend API | EPIC-04 Backend API | **Done** |
> | EPIC-05 | AI Layer | EPIC-05 AI Layer | **Done**, exceeded (5 providers + resilience orchestrator, ADR-025/028) |
> | EPIC-06 | Job Providers | EPIC-06 Job Providers | **Done**, far exceeded (20+ providers, ADR-030) |
> | EPIC-07 | **Job Pipeline** | canonical **EPIC-09** Job Pipeline | **Done** (plus canonical EPIC-16/17 follow-on work, ADR-026/027) |
> | EPIC-08 | **Telegram Bot** | canonical **EPIC-10** Telegram Bot | **Done** (linking + digest; inline job-card buttons not verified) |
> | EPIC-09 | **Career CRM** | canonical **EPIC-07** Career CRM | **Done** |
> | EPIC-10 | **Follow-up Engine** | canonical **EPIC-08** Follow-up Engine | **Done** (no dedicated dashboard view yet) |
> | EPIC-11 | **Dashboard** | canonical **EPIC-12** Dashboard | **Done**, exceeded |
> | EPIC-12 | **Advanced AI Features** | canonical **EPIC-13** Advanced AI | **Partial** — analytics/recommendations shipped; learning engine, salary prediction, interview simulator not built |
>
> Note: this file has no dedicated Resume Engine epic (canonical `EPIC-11-resume-engine.md`) — resume work here is folded into T-04.5 (Resume CRUD) and T-05.6/T-05.7 (AI resume/cover-letter generation) below. Actual status: PDF upload + AI extraction shipped; DOCX/Markdown import and the dashboard-reachable cover-letter flow are not (see canonical EPIC-11 and EPIC-13 files for detail).
>
> Per-epic "Actual status" lines are added below under each heading. Original
> planning content (tasks, priorities, durations) is left untouched as a
> historical record — it describes what was planned, not what shipped.

## Epic Overview

| Epic | Name | Phase | Dependencies | Original Status | Actual Status (2026-07-23) |
|------|------|-------|--------------|--------|--------|
| EPIC-00 | Documentation & Architecture | 0 | None | In Progress | Ongoing |
| EPIC-01 | Project Bootstrap | 1 | EPIC-00 | Planned | Done |
| EPIC-02 | Infrastructure Setup | 2 | EPIC-01 | Planned | Done |
| EPIC-03 | Domain Layer | 3 | EPIC-02 | Planned | Done |
| EPIC-04 | Backend API | 4 | EPIC-03 | Planned | Done |
| EPIC-05 | AI Layer | 5 | EPIC-03 | Planned | Done (exceeded) |
| EPIC-06 | Job Providers | 6 | EPIC-03, EPIC-05 | Planned | Done (exceeded) |
| EPIC-07 | Job Pipeline | 7 | EPIC-04, EPIC-06 | Planned | Done |
| EPIC-08 | Telegram Bot | 8 | EPIC-04, EPIC-05 | Planned | Done |
| EPIC-09 | Career CRM | 9 | EPIC-04 | Planned | Done |
| EPIC-10 | Follow-up Engine | 10 | EPIC-09 | Planned | Done |
| EPIC-11 | Dashboard | 11 | EPIC-04 | Planned | Done (exceeded) |
| EPIC-12 | Advanced AI Features | 12 | EPIC-05 | Planned | Partial |

---

## EPIC-00: Documentation & Architecture

**Goal:** Complete all documentation before writing code.

**Duration:** 1-2 days

**Status:** In Progress

**Actual status (2026-07-23):** Ongoing by nature — this file was itself out of date until this audit pass.

### Tasks

| ID | Task | Priority | Status |
|----|------|----------|--------|
| T-00.1 | Create docs structure | Critical | Done |
| T-00.2 | Write product requirements | Critical | Done |
| T-00.3 | Write system architecture | Critical | Done |
| T-00.4 | Write domain model | Critical | Done |
| T-00.5 | Create ADR documents | High | Done |
| T-00.6 | Create epic breakdown | High | Done |
| T-00.7 | Create task roadmap | High | In Progress |
| T-00.8 | Write coding standards | Medium | Done |
| T-00.9 | Write guardrails | Medium | Done |

---

## EPIC-01: Project Bootstrap

**Goal:** Initialize monorepo with tooling.

**Duration:** 1 day

**Dependencies:** EPIC-00

**Actual status (2026-07-23):** Done. See canonical `epics/EPIC-01-bootstrap.md`.

### Tasks

| ID | Task | Priority |
|----|------|----------|
| T-01.1 | Initialize Turborepo | Critical |
| T-01.2 | Configure TypeScript (shared config) | Critical |
| T-01.3 | Configure ESLint | Critical |
| T-01.4 | Configure Prettier | Critical |
| T-01.5 | Create apps/backend skeleton | Critical |
| T-01.6 | Create apps/worker skeleton | Critical |
| T-01.7 | Create apps/dashboard skeleton | Critical |
| T-01.8 | Create packages/shared | High |
| T-01.9 | Create root package.json scripts | High |
| T-01.10 | Create .env.example | Medium |

---

## EPIC-02: Infrastructure Setup

**Goal:** Database, Redis, Docker, CI.

**Duration:** 2-3 days

**Dependencies:** EPIC-01

**Actual status (2026-07-23):** Done. See canonical `epics/EPIC-02-infrastructure.md`.

### Tasks

| ID | Task | Priority |
|----|------|----------|
| T-02.1 | Create Docker Compose (postgres, redis) | Critical |
| T-02.2 | Initialize Prisma schema | Critical |
| T-02.3 | Create initial migration | Critical |
| T-02.4 | Create packages/database with Prisma client | Critical |
| T-02.5 | Configure BullMQ with Redis | Critical |
| T-02.6 | Create Fastify server setup | Critical |
| T-02.7 | Create health check endpoint | High |
| T-02.8 | Add pgadmin to Docker Compose | Medium |
| T-02.9 | Add mailpit to Docker Compose | Medium |
| T-02.10 | Create GitHub Actions CI | High |

---

## EPIC-03: Domain Layer

**Goal:** Implement all domain entities and interfaces.

**Duration:** 3-4 days

**Dependencies:** EPIC-02

**Actual status (2026-07-23):** Done. See canonical `epics/EPIC-03-domain-layer.md`.

### Tasks

| ID | Task | Priority |
|----|------|----------|
| T-03.1 | Create User entity | Critical |
| T-03.2 | Create Resume entity + value objects | Critical |
| T-03.3 | Create Job entity | Critical |
| T-03.4 | Create Application entity + state machine | Critical |
| T-03.5 | Create FollowUp entity | Critical |
| T-03.6 | Create Recruiter entity | High |
| T-03.7 | Create SearchProfile entity | High |
| T-03.8 | Create Notification entity | Medium |
| T-03.9 | Create UserFeedback entity | Medium |
| T-03.10 | Define repository interfaces | Critical |
| T-03.11 | Define domain events | High |
| T-03.12 | Create domain error types | High |

---

## EPIC-04: Backend API

**Goal:** REST API with auth, CRUD, validation.

**Duration:** 4-5 days

**Dependencies:** EPIC-03

**Actual status (2026-07-23):** Done. See canonical `epics/EPIC-04-backend-api.md`.

### Tasks

| ID | Task | Priority |
|----|------|----------|
| T-04.1 | Implement user registration | Critical |
| T-04.2 | Implement login with JWT | Critical |
| T-04.3 | Implement token refresh | Critical |
| T-04.4 | Create auth middleware | Critical |
| T-04.5 | Implement resume CRUD | Critical |
| T-04.6 | Implement job listing endpoints | Critical |
| T-04.7 | Implement application CRUD | Critical |
| T-04.8 | Implement application status transitions | Critical |
| T-04.9 | Implement follow-up endpoints | High |
| T-04.10 | Implement recruiter endpoints | High |
| T-04.11 | Implement search profile endpoints | High |
| T-04.12 | Implement notification endpoints | Medium |
| T-04.13 | Add Zod validation to all endpoints | Critical |
| T-04.14 | Add error handling middleware | Critical |
| T-04.15 | Add rate limiting | Medium |

---

## EPIC-05: AI Layer

**Goal:** AI provider abstraction and core capabilities.

**Duration:** 3-4 days

**Dependencies:** EPIC-03

**Actual status (2026-07-23):** Done, exceeded original scope (5 AI providers plus resilience/fallback orchestrator — ADR-025, ADR-028). T-05.7 (cover letter generation) and T-05.8 (interview question generation) need a caveat: cover-letter generation is built but not wired into any dashboard route, and interview question generation was never built (`packages/interview` is an empty stub). See canonical `epics/EPIC-05-ai-layer.md` and `epics/EPIC-13-advanced-ai.md`.

### Tasks

| ID | Task | Priority |
|----|------|----------|
| T-05.1 | Create AIProvider interface | Critical |
| T-05.2 | Implement OpenAI provider | Critical |
| T-05.3 | Create prompt management system | Critical |
| T-05.4 | Implement match analysis prompts | Critical |
| T-05.5 | Implement follow-up message generation | High |
| T-05.6 | Implement resume generation prompts | High |
| T-05.7 | Implement cover letter generation | High |
| T-05.8 | Implement interview question generation | Medium |
| T-05.9 | Implement salary estimation | Medium |
| T-05.10 | Add AI response validation | Critical |
| T-05.11 | Add AI error handling | High |

---

## EPIC-06: Job Providers

**Job source adapters.**

**Duration:** 3-4 days

**Dependencies:** EPIC-03, EPIC-05

**Actual status (2026-07-23):** Done, far exceeded (20+ providers shipped, not the 4 listed below — see ADR-030 and canonical `epics/EPIC-06-job-providers.md`).

### Tasks

| ID | Task | Priority |
|----|------|----------|
| T-06.1 | Create JobProvider interface | Critical |
| T-06.2 | Create provider registry | Critical |
| T-06.3 | Implement HH.ru provider | Critical |
| T-06.4 | Implement LinkedIn provider | High |
| T-06.5 | Implement Habr Career provider | High |
| T-06.6 | Implement RemoteOK provider | Medium |
| T-06.7 | Create job normalization logic | Critical |
| T-06.8 | Create deduplication logic | Critical |
| T-06.9 | Add provider health checks | Medium |

---

## EPIC-07: Job Pipeline

**End-to-end job discovery flow.**

**Duration:** 3-4 days

**Dependencies:** EPIC-04, EPIC-06

**Actual status (2026-07-23):** Done. This is the "Job Pipeline" scope — maps to canonical `epics/EPIC-09-job-pipeline.md`, plus follow-on work in canonical EPIC-16/EPIC-17 (decoupled search + diagnostics, ADR-026/ADR-027).

### Tasks

| ID | Task | Priority |
|----|------|----------|
| T-07.1 | Create aggregation worker job | Critical |
| T-07.2 | Create matching worker job | Critical |
| T-07.3 | Create pipeline orchestrator | Critical |
| T-07.4 | Implement job ranking | High |
| T-07.5 | Add pipeline scheduling | Critical |
| T-07.6 | Add pipeline monitoring | Medium |

---

## EPIC-08: Telegram Bot

**Telegram bot interface.**

**Duration:** 4-5 days

**Dependencies:** EPIC-04, EPIC-05

**Actual status (2026-07-23):** Done — maps to canonical `epics/EPIC-10-telegram-bot.md`. Account linking and digest delivery confirmed; T-08.8/T-08.9/T-08.10/T-08.11 (inline job-card buttons for Apply/Favorite/Ignore/Generate Resume/Generate Cover Letter/Generate Interview) not verified — and Generate Interview specifically cannot work today since interview generation was never built.

### Tasks

| ID | Task | Priority |
|----|------|----------|
| T-08.1 | Create Telegram bot skeleton | Critical |
| T-08.2 | Implement /start command | Critical |
| T-08.3 | Implement /search command | Critical |
| T-08.4 | Implement /profile command | High |
| T-08.5 | Implement /history command | High |
| T-08.6 | Implement /settings command | Medium |
| T-08.7 | Implement job card display | Critical |
| T-08.8 | Implement Apply/Favorite/Ignore buttons | Critical |
| T-08.9 | Implement Generate Resume button | High |
| T-08.10 | Implement Generate Cover Letter button | High |
| T-08.11 | Implement Generate Interview button | Medium |
| T-08.12 | Add user linking (Telegram ↔ CareerOS) | Critical |
| T-08.13 | Add notification integration | High |

---

## EPIC-09: Career CRM

**Application tracking and management.**

**Duration:** 3-4 days

**Dependencies:** EPIC-04

**Actual status (2026-07-23):** Done. This is the "Career CRM" scope — maps to canonical `epics/EPIC-07-career-crm.md`.

### Tasks

| ID | Task | Priority |
|----|------|----------|
| T-09.1 | Implement application pipeline view | Critical |
| T-09.2 | Implement status transition logic | Critical |
| T-09.3 | Implement notes system | High |
| T-09.4 | Implement recruiter management | High |
| T-09.5 | Implement communication history | Medium |
| T-09.6 | Add pipeline analytics | Medium |

---

## EPIC-10: Follow-up Engine

**Automated follow-up reminders.**

**Duration:** 2-3 days

**Dependencies:** EPIC-09

**Actual status (2026-07-23):** Done. This is the "Follow-up Engine" scope — maps to canonical `epics/EPIC-08-followup-engine.md`. Reminders are delivered via Telegram/digest; there is no dedicated "follow-ups due" dashboard view (T-09.6-equivalent pipeline analytics exists, but not a follow-up-specific list).

### Tasks

| ID | Task | Priority |
|----|------|----------|
| T-10.1 | Create follow-up scheduler | Critical |
| T-10.2 | Create follow-up check worker | Critical |
| T-10.3 | Implement snooze functionality | High |
| T-10.4 | Implement AI message generation | High |
| T-10.5 | Implement notification delivery | Critical |
| T-10.6 | Add follow-up history tracking | Medium |

---

## EPIC-11: Dashboard

**Next.js web interface.**

**Duration:** 5-7 days

**Dependencies:** EPIC-04

**Actual status (2026-07-23):** Done, exceeded — maps to canonical `epics/EPIC-12-dashboard.md`. The dashboard has grown well past this list (search profiles, recommendations, resume intelligence, career intelligence, company watch, provider settings, diagnostics — none of which appear in the task list below).

### Tasks

| ID | Task | Priority |
|----|------|----------|
| T-11.1 | Create layout and navigation | Critical |
| T-11.2 | Implement auth pages (login/register) | Critical |
| T-11.3 | Implement job listing page | Critical |
| T-11.4 | Implement job detail page | Critical |
| T-11.5 | Implement application pipeline (Kanban) | Critical |
| T-11.6 | Implement resume management | High |
| T-11.7 | Implement settings page | Medium |
| T-11.8 | Implement analytics dashboard | Medium |
| T-11.9 | Add dark mode | Low |

---

## EPIC-12: Advanced AI Features

**Learning, recommendations, simulation.**

**Duration:** 5-7 days

**Dependencies:** EPIC-05

**Actual status (2026-07-23):** Partial — maps to canonical `epics/EPIC-13-advanced-ai.md`. T-12.3 (skill recommendations) shipped in a general form (`recommendation-service.ts`, career intelligence, ADR-029). T-12.1 (learning engine), T-12.2 (salary prediction), and T-12.4 (interview simulator) are not built.

### Tasks

| ID | Task | Priority |
|----|------|----------|
| T-12.1 | Implement learning engine | High |
| T-12.2 | Implement salary prediction | Medium |
| T-12.3 | Implement skill recommendations | Medium |
| T-12.4 | Implement interview simulator | Medium |

---

## MVP Scope (Epics 00-10)

**Shipped.** All items below are done; job providers and dashboard both went
past their original phase boundaries (see status note at top of file).

The first usable release includes:
- Docker environment — done
- Backend API — done
- PostgreSQL + Prisma — done
- Redis + BullMQ — done
- Telegram bot — done
- Resume parsing — partial (PDF only)
- AI matching — done, exceeded
- One job provider (HH.ru) — done, plus 19+ more
- Career CRM — done
- Follow-up reminders — done

**Dashboard (EPIC-11) is Phase 2.** — shipped, not gated behind the rest; it's now the primary UI.
**Advanced AI (EPIC-12) is Phase 3.** — partially shipped, see status note above.
