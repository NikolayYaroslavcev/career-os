# CareerOS Product Requirements

## Product Vision

CareerOS is a career workspace that operates continuously on behalf of the user. It handles repetitive career management tasks so the user can focus on strategic decisions.

## Target Users

### Primary: Active Job Seekers
- Developers actively looking for new positions
- Want to maximize opportunities while minimizing time spent
- Need to manage multiple applications simultaneously

### Secondary: Passive Career Managers
- Employed professionals monitoring market opportunities
- Want to stay informed about relevant positions
- Need periodic career document updates

## Core Product Principles

1. **AI does the grunt work** - Users make decisions, not data entry
2. **Continuous operation** - The system works even when the user is offline
3. **Progressive learning** - The system improves recommendations over time
4. **Privacy first** - User data stays under user control
5. **Replaceable components** - No vendor lock-in at any layer

## Functional Requirements

### FR-01: Job Discovery

**Priority:** Critical (MVP)

| ID | Requirement | Acceptance Criteria |
|----|-------------|---------------------|
| FR-01.1 | Aggregate jobs from multiple sources | System fetches from configured providers daily |
| FR-01.2 | Normalize vacancy data | All sources produce consistent Job entity |
| FR-01.3 | Deduplicate vacancies | Same job from multiple sources appears once |
| FR-01.4 | Search by criteria | Users can filter by title, location, salary, remote |
| FR-01.5 | Add new providers without code changes | Adding provider requires only config + adapter |

**Sources (MVP):** HH.ru, LinkedIn, Habr Career
**Sources (Future):** Wellfound, Otta, RSS, Telegram channels, company career pages

### FR-02: AI Matching Engine

**Priority:** Critical (MVP)

| ID | Requirement | Acceptance Criteria |
|----|-------------|---------------------|
| FR-02.1 | Compare vacancy against resume | Returns match score 0-100 |
| FR-02.2 | Identify missing skills | Lists skills in vacancy not in resume |
| FR-02.3 | Identify strengths | Lists strong matches |
| FR-02.4 | Generate match explanation | Human-readable reason for score |
| FR-02.5 | Estimate salary range | Based on vacancy data and market |
| FR-02.6 | Rank vacancies | Sort by match score with explanation |
| FR-02.7 | Learn from feedback | Improve ranking based on user actions |

### FR-03: Career CRM

**Priority:** Critical (MVP)

| ID | Requirement | Acceptance Criteria |
|----|-------------|---------------------|
| FR-03.1 | Track application statuses | Full pipeline: Saved -> Applied -> Interview -> Offer/Rejected |
| FR-03.2 | Store company information | Name, industry, size, website |
| FR-03.3 | Store recruiter information | Name, contact, role, communication history |
| FR-03.4 | Add notes to applications | Free-text notes per application |
| FR-03.5 | Track communication | Log all interactions with dates |
| FR-03.6 | View pipeline dashboard | Visual Kanban of all applications |

**Application Statuses:**
- `saved` - Bookmarked for later review
- `applied` - Application submitted
- `waiting` - Awaiting response
- `hr_interview` - HR screening scheduled/completed
- `technical_interview` - Technical round scheduled/completed
- `final_interview` - Final round scheduled/completed
- `offer` - Offer received
- `rejected` - Application rejected
- `archived` - No longer active

### FR-04: Follow-up Engine

**Priority:** High (MVP)

| ID | Requirement | Acceptance Criteria |
|----|-------------|---------------------|
| FR-04.1 | Auto-schedule follow-ups | After N days with no response, create reminder |
| FR-04.2 | Generate follow-up messages | AI writes contextual follow-up text |
| FR-04.3 | Send notifications | Telegram/email when follow-up is due |
| FR-04.4 | Snooze reminders | User can postpone follow-up |
| FR-04.5 | Track follow-up history | Log all follow-up attempts |

**Flow:** Applied -> 5 days -> No response -> AI reminder -> Follow-up message

### FR-05: Resume Engine

**Priority:** High (MVP)

| ID | Requirement | Acceptance Criteria |
|----|-------------|---------------------|
| FR-05.1 | Import resume from PDF | Extracts text and structure |
| FR-05.2 | Import resume from DOCX | Extracts text and structure |
| FR-05.3 | Import resume from Markdown | Parses structured markdown |
| FR-05.4 | Extract experience, skills, projects | Structured data from unstructured resume |
| FR-05.5 | Generate tailored resume | Customize resume for specific vacancy |
| FR-05.6 | Generate cover letter | Write vacancy-specific cover letter |

### FR-06: Interview Assistant

**Priority:** Medium (Phase 2)

| ID | Requirement | Acceptance Criteria |
|----|-------------|---------------------|
| FR-06.1 | Generate technical questions | Based on vacancy requirements |
| FR-06.2 | Generate behavioral questions | STAR format questions |
| FR-06.3 | Generate company-specific questions | Based on company research |
| FR-06.4 | Provide answer suggestions | AI-generated answer outlines |

### FR-07: Career Analytics

**Priority:** Medium (Phase 2)

| ID | Requirement | Acceptance Criteria |
|----|-------------|---------------------|
| FR-07.1 | Track application metrics | Count by status, time in each stage |
| FR-07.2 | Calculate response rate | Applications vs responses |
| FR-07.3 | Calculate success rate | Applications vs offers |
| FR-07.4 | Salary statistics | Average, min, max for matched positions |
| FR-07.5 | Skill demand analysis | Most requested skills in matched jobs |

### FR-08: Notification System

**Priority:** High (MVP)

| ID | Requirement | Acceptance Criteria |
|----|-------------|---------------------|
| FR-08.1 | Send via Telegram | New jobs, reminders, updates |
| FR-08.2 | Send via Email | Weekly digest, important updates |
| FR-08.3 | User-configurable channels | Choose which events go where |
| FR-08.4 | Notification preferences | Quiet hours, frequency limits |

### FR-09: Authentication & Authorization

**Priority:** Critical (MVP)

| ID | Requirement | Acceptance Criteria |
|----|-------------|---------------------|
| FR-09.1 | User registration | Email + password |
| FR-09.2 | User login | JWT-based authentication |
| FR-09.3 | Telegram bot binding | Link Telegram account to user |
| FR-09.4 | Data isolation | Users can only access their own data |

## Non-Functional Requirements

### NFR-01: Performance

| ID | Requirement | Target |
|----|-------------|--------|
| NFR-01.1 | API response time | < 200ms for reads, < 500ms for writes |
| NFR-01.2 | AI matching latency | < 5s per vacancy analysis |
| NFR-01.3 | Job aggregation | Process 1000 vacancies in < 10min |
| NFR-01.4 | Dashboard load | < 2s initial load |

### NFR-02: Scalability

| ID | Requirement | Target |
|----|-------------|--------|
| NFR-02.1 | Concurrent users | Support 1000+ users |
| NFR-02.2 | Job volume | Handle 100K+ vacancies |
| NFR-02.3 | Horizontal scaling | Worker instances can scale independently |

### NFR-03: Reliability

| ID | Requirement | Target |
|----|-------------|--------|
| NFR-03.1 | Uptime | 99.5% availability |
| NFR-03.2 | Data durability | No data loss on failures |
| NFR-03.3 | Graceful degradation | Core features work if AI is down |

### NFR-04: Security

| ID | Requirement | Target |
|----|-------------|--------|
| NFR-04.1 | Authentication | JWT with refresh tokens |
| NFR-04.2 | Authorization | Row-level security |
| NFR-04.3 | Input validation | All inputs validated with Zod |
| NFR-04.4 | Secrets management | Environment variables only |
| NFR-04.5 | API security | Rate limiting, CORS, helmet |

### NFR-05: Maintainability

| ID | Requirement | Target |
|----|-------------|--------|
| NFR-05.1 | Code coverage | > 80% for business logic |
| NFR-05.2 | Documentation | All ADRs documented |
| NFR-05.3 | Type safety | Strict TypeScript, no `any` |
| NFR-05.4 | Architecture | Clean Architecture layers respected |

## User Stories

### Epic 01: Job Discovery

**US-01.1:** As a job seeker, I want to connect my HH.ru account so that jobs from that platform appear in my feed.

**US-01.2:** As a job seeker, I want to set search criteria (title, location, salary, remote) so that I only see relevant positions.

**US-01.3:** As a job seeker, I want to see a daily digest of new matching jobs so that I don't miss opportunities.

### Epic 02: AI Matching

**US-02.1:** As a job seeker, I want to see how well each vacancy matches my resume so that I can prioritize applications.

**US-02.2:** As a job seeker, I want to understand why a job scored high or low so that I can make informed decisions.

**US-02.3:** As a job seeker, I want the system to learn from my saves and ignores so that recommendations improve.

### Epic 03: Career CRM

**US-03.1:** As a job seeker, I want to track all my applications in one place so that I know where I stand with each company.

**US-03.2:** As a job seeker, I want to add notes to applications so that I remember context for interviews.

**US-03.3:** As a job seeker, I want to see a Kanban view of my pipeline so that I understand my overall progress.

### Epic 04: Follow-up

**US-04.1:** As a job seeker, I want automatic reminders to follow up so that I don't lose opportunities due to forgetfulness.

**US-04.2:** As a job seeker, I want AI-generated follow-up messages so that I can respond quickly.

### Epic 05: Resume

**US-05.1:** As a job seeker, I want to upload my resume so that the system can analyze and match it against vacancies.

**US-05.2:** As a job seeker, I want to generate a tailored resume for a specific vacancy so that I increase my chances.

### Epic 06: Telegram Bot

**US-06.1:** As a job seeker, I want to receive job alerts via Telegram so that I'm notified immediately.

**US-06.2:** As a job seeker, I want to interact with the bot via commands (/search, /profile, /stats) so that I can manage my career from my phone.

## Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Daily active users | 100+ within 3 months | Login count |
| Jobs processed daily | 5000+ | Worker logs |
| Match accuracy | > 70% user agreement | Feedback ratio |
| Follow-up completion | 80% of reminders acted on | Reminder status |
| Time saved per user | 2+ hours/day | User survey |
