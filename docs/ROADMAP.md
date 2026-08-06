# CareerOS Development Roadmap

## Overview

CareerOS development follows a phased approach. Each phase builds on the previous. Only one Epic active at a time.

## Phase 0: Foundation Planning (Completed)

Created all documentation, ADRs, and planning artifacts. No code.

> **2026-07-23 status note:** Every epic below (EPIC-01 through EPIC-13) is implemented, several well beyond original scope (see individual epic files in `epics/` for details — e.g. EPIC-06 shipped 20+ job providers, not 3). Two further epics shipped after this roadmap was last touched: EPIC-16 (decoupled vacancy search, [ADR-026](adr/ADR-026-decoupled-vacancy-search.md)) and EPIC-17 (search diagnostics/continuity, [ADR-027](adr/ADR-027-search-pipeline-diagnostics-and-continuity.md)). This file was not kept current as work shipped — verify against `epics/*.md` and code before trusting a specific claim below.

## Implementation Epics

### EPIC-01: Bootstrap
**Status:** Complete
**Duration:** 2-3 days
**Dependencies:** None

**Tasks:**
- [ ] Initialize Turborepo monorepo
- [ ] Configure TypeScript (strict mode)
- [ ] Configure ESLint + Prettier
- [ ] Create basic Docker Compose
- [ ] Set up CI pipeline
- [ ] Create package structure
- [ ] Add development scripts

**Deliverables:**
- Working monorepo with build/lint/typecheck
- Docker environment starting
- CI pipeline running

---

### EPIC-02: Infrastructure
**Status:** Complete
**Duration:** 3-4 days
**Dependencies:** EPIC-01

**Tasks:**
- [ ] Set up PostgreSQL in Docker
- [ ] Configure Prisma with initial schema
- [ ] Set up Redis in Docker
- [ ] Configure BullMQ
- [ ] Set up MinIO for file storage
- [ ] Configure Mailpit for email
- [ ] Create environment configuration
- [ ] Set up logging
- [ ] Create health check endpoints

**Deliverables:**
- Database running and accessible
- Prisma migrations working
- Redis connected
- MinIO running
- Mailpit running
- Queue system operational

---

### EPIC-03: Domain Layer
**Status:** Complete
**Duration:** 4-5 days
**Dependencies:** EPIC-02

**Tasks:**
- [ ] Create User entity
- [ ] Create Workspace entity (multi-tenancy)
- [ ] Create Vacancy entity
- [ ] Create Company entity
- [ ] Create Application entity
- [ ] Create MatchResult entity
- [ ] Create FollowUp entity
- [ ] Create Resume entity
- [ ] Create domain events
- [ ] Create repository interfaces

**Deliverables:**
- Complete domain model
- All entities with business logic
- Repository interfaces defined

---

### EPIC-04: Backend API
**Status:** Complete
**Duration:** 4-5 days
**Dependencies:** EPIC-03

**Tasks:**
- [ ] Set up Fastify server with /api/v1 prefix
- [ ] Create authentication endpoints (JWT + Argon2)
- [ ] Create vacancy endpoints
- [ ] Create application endpoints
- [ ] Create user endpoints
- [ ] Add request validation
- [ ] Add rate limiting (workspace-scoped)
- [ ] Add error handling
- [ ] Create API documentation

**Deliverables:**
- RESTful API with all CRUD operations
- JWT authentication working
- Input validation with Zod
- Rate limiting configured

---

### EPIC-05: AI Layer
**Status:** Complete (exceeds scope — 5 providers plus a resilience/fallback orchestrator, see ADR-025/ADR-028)
**Duration:** 3-4 days
**Dependencies:** EPIC-04

**Tasks:**
- [ ] Create AIProvider interface
- [ ] Implement OpenAI provider
- [ ] Implement Anthropic provider
- [ ] Create prompt templates
- [ ] Add response validation
- [ ] Add fallback logic
- [ ] Create AI testing utilities

**Deliverables:**
- Pluggable AI provider system
- At least one working provider
- Prompt versioning

---

### EPIC-06: Job Providers
**Status:** Complete (exceeds scope — 20+ providers shipped, not 3; see ADR-030)
**Duration:** 4-5 days
**Dependencies:** EPIC-05

**Tasks:**
- [ ] Create JobProvider interface
- [ ] Implement HH.ru adapter
- [ ] Implement Habr Career adapter
- [ ] Implement RemoteOK adapter
- [ ] Create job normalization
- [ ] Add deduplication logic
- [ ] Create provider configuration
- [ ] LinkedIn: Interface only (no scraping)

**Deliverables:**
- Pluggable job provider system
- 3 working providers
- LinkedIn interface defined (future)

---

### EPIC-07: Career CRM
**Status:** Complete
**Duration:** 3-4 days
**Dependencies:** EPIC-04

**Core Product Differentiator**

**Tasks:**
- [ ] Create application tracking
- [ ] Implement status transitions
- [ ] Add notes functionality
- [ ] Create recruiter management
- [ ] Add communication history
- [ ] Create pipeline view
- [ ] Add application templates

**Deliverables:**
- Complete application management
- Recruiter CRM
- Communication tracking
- Pipeline Kanban

---

### EPIC-08: Follow-up Engine
**Status:** Complete (reminders surface via Telegram/digest; no standalone "due follow-ups" dashboard view yet)
**Duration:** 3-4 days
**Dependencies:** EPIC-07

**Core Product Differentiator**

**Tasks:**
- [ ] Create follow-up scheduler
- [ ] Implement reminder system
- [ ] Add AI message generation
- [ ] Create snooze functionality
- [ ] Add notification integration
- [ ] Create follow-up history
- [ ] Add follow-up templates

**Deliverables:**
- Automated follow-up reminders
- AI-generated messages
- Follow-up tracking

---

### EPIC-09: Job Pipeline
**Status:** Complete
**Duration:** 4-5 days
**Dependencies:** EPIC-06

**Tasks:**
- [ ] Create aggregation worker
- [ ] Implement normalization pipeline
- [ ] Add deduplication logic
- [ ] Create AI analysis pipeline
- [ ] Add ranking logic
- [ ] Create notification triggers
- [ ] Add monitoring/metrics

**Deliverables:**
- Automated job discovery
- AI-powered job analysis
- Ranked job feed

---

### EPIC-10: Telegram Bot
**Status:** Complete (account linking + digest delivery; inline job-card action buttons not verified)
**Duration:** 3-4 days
**Dependencies:** EPIC-09

**Tasks:**
- [ ] Set up Telegram bot
- [ ] Create /start command
- [ ] Create /link command (one-time code binding)
- [ ] Create /search command
- [ ] Create job cards with buttons
- [ ] Create /profile command
- [ ] Create /stats command
- [ ] Add webhook support

**Deliverables:**
- Working Telegram bot
- Account binding via one-time code
- Job notifications via Telegram
- Interactive job cards

---

### EPIC-11: Resume Engine
**Status:** Partial — PDF only (no DOCX/Markdown import); AI structured extraction implemented; files stored on local disk, not MinIO
**Duration:** 3-4 days
**Dependencies:** EPIC-05, EPIC-04

**Tasks:**
- [ ] Create resume upload endpoint
- [ ] Implement PDF parsing (pdf-parse)
- [ ] Implement DOCX parsing (mammoth)
- [ ] Implement Markdown parsing
- [ ] Create AI extraction pipeline
- [ ] Add resume validation
- [ ] Create resume storage (MinIO)

**Deliverables:**
- Resume upload and parsing
- AI-powered data extraction
- Structured career profiles

---

### EPIC-12: Dashboard
**Status:** Complete (exceeds scope — see full nav list in code; cover letter and resume tailoring UI exist but aren't linked from any route)
**Duration:** 5-7 days
**Dependencies:** EPIC-04

**Tasks:**
- [ ] Set up Next.js application
- [ ] Create authentication flow
- [ ] Build job listing page
- [ ] Build application pipeline (Kanban)
- [ ] Build analytics dashboard
- [ ] Build settings page (Telegram binding)
- [ ] Add responsive design

**Deliverables:**
- Complete web dashboard
- All CRUD operations
- Analytics visualization
- Telegram binding UI

---

### EPIC-13: Advanced AI Features
**Status:** Partial — career analytics and recommendations shipped (ADR-029); interview simulator, salary prediction, and formal career-path suggestions not built
**Duration:** 5-7 days
**Dependencies:** EPIC-05, EPIC-12

**Tasks:**
- [ ] Create learning engine
- [ ] Implement salary prediction
- [ ] Add skill recommendations
- [ ] Create interview simulator
- [ ] Add career path suggestions
- [ ] Create analytics AI

**Deliverables:**
- AI-powered career insights
- Predictive analytics
- Personalized recommendations

---

## MVP Scope

**Shipped and exceeded.** All 12 original MVP items are done, with job providers and AI matching both going well beyond the original target (20+ providers instead of 3; a full resilience/fallback AI layer instead of one provider). Resume parsing is the one partial item — PDF only, no DOCX/Markdown.

1. Docker environment (EPIC-01) — done
2. Backend API (EPIC-04) — done
3. PostgreSQL + Prisma (EPIC-02) — done
4. Redis + BullMQ (EPIC-02) — done
5. MinIO for file storage (EPIC-02) — running, but unused: resumes still go to local disk
6. Mailpit for email (EPIC-02) — done
7. Career CRM (EPIC-07) - **Core differentiator** — done
8. Follow-up Engine (EPIC-08) - **Core differentiator** — done (no dedicated dashboard view yet)
9. Job providers: HH, Habr Career (EPIC-06) — done, plus 17+ more providers
10. AI matching (EPIC-05) — done, plus multi-provider resilience layer
11. Telegram bot (EPIC-10) — done
12. Resume parsing (EPIC-11) — partial, PDF only

## Future Versions (updated 2026-07-23)

### v0.2 — shipped
- Dashboard (EPIC-12) — shipped, and is now the primary UI surface

### v0.3 — shipped
- Career Intelligence / analytics (ADR-029) — shipped
- Browser extension (`apps/extension`, ADR-008) — core detect-and-save flow shipped; AI match score and inline cover-letter/resume generation in the extension panel are not yet built

### v0.4 — partial
- Advanced AI (EPIC-13): career analytics and recommendations shipped; learning engine, interview simulator, and salary prediction not built

### Not yet on any version list — real gaps found in code, worth prioritizing
- **Interview Assistant**: `Interview` domain entity and an application-detail scheduler exist, but `packages/interview` is an empty stub — no AI-generated interview prep exists despite being a named differentiator.
- **Cover letter & resume tailoring**: fully implemented on the backend and as dashboard components, but neither is linked from any route — currently unreachable by users.

### v1.0
- Complete CareerOS platform (not yet — see gaps above)

## Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Daily active users | 100+ within 3 months | Login count |
| Jobs processed daily | 5000+ | Worker logs |
| Match accuracy | > 70% user agreement | Feedback ratio |
| Follow-up completion | 80% of reminders acted on | Reminder status |
| Time saved per user | 2+ hours/day | User survey |
