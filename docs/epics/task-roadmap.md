# CareerOS Task Roadmap

> **2026-07-23 audit note:** This is the original week-by-week plan (dated
> from before implementation started). Every epic referenced here has since
> shipped — see the status mapping table in `docs/epics/epic-breakdown.md`
> (same epic numbering as this file, which does **not** match the canonical
> `epics/EPIC-*.md` directory for EPIC-07 through EPIC-12). Hour estimates,
> task IDs, and dependency graph below are left as-is as a historical record
> of the plan; they are not a description of actual time spent or current
> status. For current status, see `docs/ROADMAP.md` and canonical
> `epics/EPIC-*.md`.

## Timeline Overview

```
Week 1:  EPIC-00 (Docs) → EPIC-01 (Bootstrap)
Week 2:  EPIC-02 (Infrastructure)
Week 3:  EPIC-03 (Domain Layer)
Week 4:  EPIC-04 (Backend API) + EPIC-05 (AI Layer) [parallel]
Week 5:  EPIC-06 (Job Providers)
Week 6:  EPIC-07 (Job Pipeline) + EPIC-08 (Telegram Bot) [parallel]
Week 7:  EPIC-09 (Career CRM) + EPIC-10 (Follow-up Engine) [parallel]
Week 8:  Integration testing, bug fixes, MVP release
Week 9+: EPIC-11 (Dashboard) - Phase 2
Week 11+: EPIC-12 (Advanced AI) - Phase 3
```

---

## Phase 0: Foundation (Week 1) — done

### EPIC-00: Documentation & Architecture
**Status:** In Progress → Complete by end of Day 1

| Task | Est. | Status |
|------|------|--------|
| T-00.1 Create docs structure | 1h | Done |
| T-00.2 Write product requirements | 2h | Done |
| T-00.3 Write system architecture | 2h | Done |
| T-00.4 Write domain model | 2h | Done |
| T-00.5 Create ADR documents | 2h | Done |
| T-00.6 Create epic breakdown | 1h | Done |
| T-00.7 Create task roadmap | 1h | Done |
| T-00.8 Write coding standards | 1h | Done |
| T-00.9 Write guardrails | 1h | Done |

### EPIC-01: Project Bootstrap
**Start:** After EPIC-00
**Duration:** 1 day

| Task | Est. | Depends On |
|------|------|------------|
| T-01.1 Initialize Turborepo | 1h | - |
| T-01.2 Configure TypeScript | 1h | T-01.1 |
| T-01.3 Configure ESLint | 1h | T-01.1 |
| T-01.4 Configure Prettier | 30m | T-01.1 |
| T-01.5 Create backend skeleton | 2h | T-01.2 |
| T-01.6 Create worker skeleton | 1h | T-01.2 |
| T-01.7 Create dashboard skeleton | 2h | T-01.2 |
| T-01.8 Create packages/shared | 2h | T-01.2 |
| T-01.9 Create root scripts | 1h | T-01.1 |
| T-01.10 Create .env.example | 30m | - |

---

## Phase 1: Infrastructure (Week 2) — done

### EPIC-02: Infrastructure Setup
**Start:** After EPIC-01
**Duration:** 2-3 days

| Task | Est. | Depends On |
|------|------|------------|
| T-02.1 Docker Compose (postgres, redis) | 2h | - |
| T-02.2 Initialize Prisma schema | 2h | T-02.1 |
| T-02.3 Create initial migration | 1h | T-02.2 |
| T-02.4 packages/database setup | 2h | T-02.3 |
| T-02.5 Configure BullMQ | 2h | T-02.1 |
| T-02.6 Fastify server setup | 3h | T-02.4 |
| T-02.7 Health check endpoint | 1h | T-02.6 |
| T-02.8 pgadmin setup | 30m | T-02.1 |
| T-02.9 mailpit setup | 30m | T-02.1 |
| T-02.10 GitHub Actions CI | 3h | T-02.6 |

---

## Phase 2: Domain & API (Weeks 3-4) — done

### EPIC-03: Domain Layer
**Start:** After EPIC-02
**Duration:** 3-4 days

| Task | Est. | Depends On |
|------|------|------------|
| T-03.1 User entity | 2h | - |
| T-03.2 Resume entity | 3h | - |
| T-03.3 Job entity | 2h | - |
| T-03.4 Application entity + state machine | 4h | - |
| T-03.5 FollowUp entity | 2h | - |
| T-03.6 Recruiter entity | 1h | - |
| T-03.7 SearchProfile entity | 2h | - |
| T-03.8 Notification entity | 1h | - |
| T-03.9 UserFeedback entity | 1h | - |
| T-03.10 Repository interfaces | 3h | T-03.1-T-03.9 |
| T-03.11 Domain events | 2h | T-03.10 |
| T-03.12 Domain error types | 1h | T-03.10 |

### EPIC-04: Backend API (parallel with EPIC-05)
**Start:** After EPIC-03
**Duration:** 4-5 days

| Task | Est. | Depends On |
|------|------|------------|
| T-04.1 User registration | 2h | T-03.1 |
| T-04.2 Login with JWT | 3h | T-04.1 |
| T-04.3 Token refresh | 1h | T-04.2 |
| T-04.4 Auth middleware | 2h | T-04.2 |
| T-04.5 Resume CRUD | 3h | T-03.2 |
| T-04.6 Job listing endpoints | 3h | T-03.3 |
| T-04.7 Application CRUD | 3h | T-03.4 |
| T-04.8 Application status transitions | 2h | T-04.7 |
| T-04.9 Follow-up endpoints | 2h | T-03.5 |
| T-04.10 Recruiter endpoints | 2h | T-03.6 |
| T-04.11 Search profile endpoints | 2h | T-03.7 |
| T-04.12 Notification endpoints | 2h | T-03.8 |
| T-04.13 Zod validation | 3h | T-04.5-T-04.12 |
| T-04.14 Error handling middleware | 2h | T-04.4 |
| T-04.15 Rate limiting | 2h | T-04.14 |

### EPIC-05: AI Layer (parallel with EPIC-04)
**Start:** After EPIC-03
**Duration:** 3-4 days

| Task | Est. | Depends On |
|------|------|------------|
| T-05.1 AIProvider interface | 2h | - |
| T-05.2 OpenAI provider | 4h | T-05.1 |
| T-05.3 Prompt management | 3h | T-05.1 |
| T-05.4 Match analysis prompts | 3h | T-05.3 |
| T-05.5 Follow-up generation | 2h | T-05.3 |
| T-05.6 Resume generation | 3h | T-05.3 |
| T-05.7 Cover letter generation | 2h | T-05.3 |
| T-05.8 Interview questions | 2h | T-05.3 |
| T-05.9 Salary estimation | 2h | T-05.3 |
| T-05.10 AI response validation | 2h | T-05.2 |
| T-05.11 AI error handling | 2h | T-05.2 |

---

## Phase 3: Integrations (Weeks 5-7) — done

### EPIC-06: Job Providers
**Start:** After EPIC-03, EPIC-05
**Duration:** 3-4 days

| Task | Est. | Depends On |
|------|------|------------|
| T-06.1 JobProvider interface | 2h | - |
| T-06.2 Provider registry | 1h | T-06.1 |
| T-06.3 HH.ru provider | 4h | T-06.1 |
| T-06.4 LinkedIn provider | 4h | T-06.1 |
| T-06.5 Habr Career provider | 3h | T-06.1 |
| T-06.6 RemoteOK provider | 2h | T-06.1 |
| T-06.7 Job normalization | 3h | T-06.1 |
| T-06.8 Deduplication | 2h | T-06.7 |
| T-06.9 Provider health checks | 1h | T-06.2 |

### EPIC-07: Job Pipeline
**Start:** After EPIC-04, EPIC-06
**Duration:** 3-4 days

| Task | Est. | Depends On |
|------|------|------------|
| T-07.1 Aggregation worker | 3h | T-06.2 |
| T-07.2 Matching worker | 3h | T-05.4 |
| T-07.3 Pipeline orchestrator | 4h | T-07.1, T-07.2 |
| T-07.4 Job ranking | 3h | T-07.3 |
| T-07.5 Pipeline scheduling | 2h | T-07.3 |
| T-07.6 Pipeline monitoring | 2h | T-07.3 |

### EPIC-08: Telegram Bot (parallel with EPIC-07)
**Start:** After EPIC-04, EPIC-05
**Duration:** 4-5 days

| Task | Est. | Depends On |
|------|------|------------|
| T-08.1 Bot skeleton | 2h | - |
| T-08.2 /start command | 2h | T-08.1 |
| T-08.3 /search command | 3h | T-08.1 |
| T-08.4 /profile command | 2h | T-08.1 |
| T-08.5 /history command | 2h | T-08.1 |
| T-08.6 /settings command | 2h | T-08.1 |
| T-08.7 Job card display | 3h | T-08.3 |
| T-08.8 Apply/Favorite/Ignore buttons | 3h | T-08.7 |
| T-08.9 Generate Resume button | 2h | T-05.6 |
| T-08.10 Generate Cover Letter button | 2h | T-05.7 |
| T-08.11 Generate Interview button | 2h | T-05.8 |
| T-08.12 User linking | 3h | T-08.1 |
| T-08.13 Notification integration | 2h | T-08.1 |

### EPIC-09: Career CRM (parallel with EPIC-07, EPIC-08)
**Start:** After EPIC-04
**Duration:** 3-4 days

| Task | Est. | Depends On |
|------|------|------------|
| T-09.1 Pipeline view | 3h | T-04.7 |
| T-09.2 Status transition logic | 3h | T-04.8 |
| T-09.3 Notes system | 2h | T-04.7 |
| T-09.4 Recruiter management | 2h | T-04.10 |
| T-09.5 Communication history | 2h | T-09.4 |
| T-09.6 Pipeline analytics | 2h | T-09.1 |

### EPIC-10: Follow-up Engine
**Start:** After EPIC-09
**Duration:** 2-3 days

| Task | Est. | Depends On |
|------|------|------------|
| T-10.1 Follow-up scheduler | 3h | T-09.2 |
| T-10.2 Follow-up check worker | 3h | T-10.1 |
| T-10.3 Snooze functionality | 2h | T-10.1 |
| T-10.4 AI message generation | 2h | T-05.5 |
| T-10.5 Notification delivery | 2h | T-10.2 |
| T-10.6 Follow-up history | 1h | T-10.2 |

---

## Phase 4: MVP Integration (Week 8) — done (MVP shipped and exceeded)

### Integration Tasks

| Task | Est. | Depends On |
|------|------|------------|
| End-to-end flow testing | 4h | All epics |
| Bug fixes | 4h | Testing |
| Performance optimization | 3h | Testing |
| Documentation updates | 2h | All epics |
| MVP release preparation | 2h | All tasks |

---

## Phase 5: Dashboard (Weeks 9-10) — done, exceeded

### EPIC-11: Dashboard
**Start:** After MVP
**Duration:** 5-7 days

| Task | Est. | Depends On |
|------|------|------------|
| T-11.1 Layout and navigation | 3h | - |
| T-11.2 Auth pages | 3h | T-11.1 |
| T-11.3 Job listing page | 4h | T-11.1 |
| T-11.4 Job detail page | 3h | T-11.3 |
| T-11.5 Application pipeline (Kanban) | 5h | T-11.1 |
| T-11.6 Resume management | 4h | T-11.1 |
| T-11.7 Settings page | 3h | T-11.1 |
| T-11.8 Analytics dashboard | 4h | T-11.1 |
| T-11.9 Dark mode | 2h | T-11.1 |

---

## Phase 6: Advanced Features (Week 11+) — partial (see epic-breakdown.md status note: recommendations/analytics shipped, learning engine / salary prediction / interview simulator not built)

### EPIC-12: Advanced AI Features
**Start:** After Dashboard
**Duration:** 5-7 days

| Task | Est. | Depends On |
|------|------|------------|
| T-12.1 Learning engine | 5h | - |
| T-12.2 Salary prediction | 4h | T-12.1 |
| T-12.3 Skill recommendations | 4h | T-12.1 |
| T-12.4 Interview simulator | 5h | - |

---

## Critical Path

```
EPIC-00 → EPIC-01 → EPIC-02 → EPIC-03 → EPIC-04 → EPIC-09 → EPIC-10
                                                 ↓
                                              EPIC-05 → EPIC-06 → EPIC-07
                                                 ↓
                                              EPIC-08
```

## Parallel Work Opportunities

1. **EPIC-04 + EPIC-05**: Backend API and AI Layer can be developed in parallel after EPIC-03
2. **EPIC-07 + EPIC-08**: Job Pipeline and Telegram Bot can be developed in parallel
3. **EPIC-09 + EPIC-10**: CRM and Follow-up Engine can be developed in parallel (with some overlap)

## Risk Areas

| Risk | Impact | Mitigation |
|------|--------|------------|
| AI prompt quality | High | Iterate on prompts early, test with real data |
| Provider API changes | Medium | Interface abstraction, provider tests |
| Database performance | Medium | Index optimization, query analysis |
| Telegram API limits | Low | Rate limiting, queue-based sending |
