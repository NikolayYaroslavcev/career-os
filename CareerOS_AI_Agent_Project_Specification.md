# CareerOS --- AI Career Operating System

## Master Project Specification for AI Agents

Version: 2.0

Status: MVP-Aligned Specification (supersedes v1.0's pipeline description)

> **2026-07-23 status note (added during a documentation accuracy pass, verified against code — not against other docs):** The MVP described in Section 14 has shipped and been exceeded. Most items this document marks "Post-MVP" or "Excluded from MVP" (Section 4.4-4.10, Section 14) are implemented: AI matching, Career CRM, Follow-up Engine, Telegram, resume parsing (PDF only), multiple job providers (20+), notifications. See `CareerOS_AI_Agent_Project_Context.md` for current status and real gaps (Interview Assistant is an empty stub; cover letter and resume tailoring are built but not wired into the dashboard UI). The vision and architecture below remain the accepted design — only the status framing ("Post-MVP" = not yet built) is out of date.

This document is the single source of truth for product vision and MVP
scope. Detailed technical architecture lives in architecture
documentation; historical design decisions live in ADRs. Where this
document marks a feature **Post-MVP**, it is accepted and preserved for
later, not cancelled.

------------------------------------------------------------------------

# 1. Project Vision

CareerOS is an AI-powered Career Operating System.

It is not just a job search bot.

It is not a vacancy parser.

It is not a LinkedIn scraper.

It is a complete AI assistant that manages the user's career lifecycle.

Long-term, the platform should:

-   find relevant vacancies automatically;
-   analyze vacancies using AI;
-   compare vacancies with the user's resume;
-   rank opportunities;
-   manage applications;
-   remind users about follow-ups;
-   generate resumes and cover letters;
-   prepare interviews;
-   learn user preferences over time.

The user should spend minimum time on routine career management.

The AI does repetitive work.

The user makes strategic decisions.

The MVP (Section 13) delivers a small, deliberately narrow slice of
this vision: one provider, one search profile, deterministic
filtering, and a dashboard. Everything else in this document beyond
the MVP is accepted future scope, not current work.

------------------------------------------------------------------------

# 2. Core Product Concept

CareerOS = Personal AI Recruiter + Career CRM + Career Analytics
Platform.

Full product lifecycle (long-term vision):

Sourcing \| Evaluation \| Application \| Follow-up \| Interview \|
Offer \| Career Growth \| Learning

The MVP only implements the **Sourcing** and the start of
**Evaluation** stages (deterministic filtering, save/dismiss). The
remaining stages are Post-MVP.

------------------------------------------------------------------------

# 3. Accepted Product Architecture (High-Level)

The platform is built around four accepted layers. Full technical
detail belongs in architecture documentation; this is the product-level
summary needed to understand how modules in Section 4 fit together.

1.  **Provider SDK** --- provider registry, fetching, mapping,
    normalization, validation, retry, health, incremental sync. This
    is how every vacancy source integrates. There is no separate
    "Discovery" package or module; sourcing is a Provider SDK
    concern.
2.  **Persistence** --- durable storage, cross-run deduplication,
    vacancy lifecycle, canonical entities.
3.  **Application Layer** --- deterministic processing and
    SearchProfile filtering (remote, salary, technologies, include /
    exclude keywords).
4.  **Consumers** --- Dashboard, AI, Notifications, and future
    consumers that read from the Application Layer's output.

Every product module in Section 4 is built on top of these four
layers.

------------------------------------------------------------------------

# 4. Main Product Modules

## 4.1 Vacancy Sourcing --- MVP (single provider)

Purpose:

Collect vacancies through the Provider SDK.

MVP scope: exactly **one** provider.

Post-MVP: additional sources, added as independent providers without
changing business logic:

-   LinkedIn
-   HH
-   Habr Career
-   RemoteOK
-   Wellfound
-   Otta
-   RSS feeds
-   Company career pages
-   Telegram channels

Architecture rule (unchanged, applies at any scale):

Every source must be an independent provider registered with the
Provider SDK. Adding a new source must not require changing business
logic.

------------------------------------------------------------------------

## 4.2 Deterministic Filtering --- MVP

Purpose:

Apply one SearchProfile's deterministic rules to sourced vacancies via
the Application Layer.

Filters (MVP):

-   Remote
-   Salary
-   Technologies
-   Include / Exclude keywords

No AI or ranking is involved in this filtering. It is purely rule
based.

------------------------------------------------------------------------

## 4.3 Dashboard --- MVP

Purpose:

Present filtered vacancies to the user.

MVP scope:

-   list filtered vacancies;
-   outbound link to the original vacancy;
-   save / dismiss actions.

Post-MVP: applications view, CRM view, analytics view, settings
(see modules below).

------------------------------------------------------------------------

## 4.4 AI Matching Engine --- Post-MVP

Responsibilities:

Compare:

-   User resume
-   Vacancy description
-   User preferences
-   Previous feedback

Generate:

-   Match score
-   Reasons
-   Missing skills
-   Strengths
-   Weaknesses
-   Interview probability
-   Salary estimation

------------------------------------------------------------------------

## 4.5 Career CRM --- Post-MVP

CareerOS must eventually manage the complete application pipeline.

Statuses:

Saved

Applied

Waiting

HR Interview

Technical Interview

Final Interview

Offer

Rejected

Archived

------------------------------------------------------------------------

## 4.6 Follow-up Engine --- Post-MVP

After applying, CareerOS must track communication.

Example:

Application created.

After configurable period:

No response.

AI creates reminder:

"Follow up with recruiter."

Features:

-   automatic reminders;
-   follow-up scheduling;
-   AI-generated messages;
-   communication history;
-   snooze;
-   archive.

Example:

Applied \| 5 days \| No response \| AI reminder \| Follow-up message

------------------------------------------------------------------------

## 4.7 Recruiter CRM --- Post-MVP

Store:

-   recruiter name;
-   company;
-   contacts;
-   communication history;
-   notes;
-   interview dates;
-   salary discussions;
-   next actions.

------------------------------------------------------------------------

## 4.8 Resume Engine --- Post-MVP

Support:

-   PDF import;
-   DOCX import;
-   Markdown import.

Extract:

-   experience;
-   projects;
-   skills;
-   technologies;
-   achievements.

Generate:

-   tailored resume;
-   vacancy-specific resume;
-   cover letter.

------------------------------------------------------------------------

## 4.9 Interview Assistant --- Post-MVP

Generate:

-   technical questions;
-   React questions;
-   TypeScript questions;
-   architecture questions;
-   system design questions;
-   behavioral questions;
-   company-specific questions.

------------------------------------------------------------------------

## 4.10 Career Analytics --- Post-MVP

Track:

-   applications;
-   replies;
-   interviews;
-   offers;
-   salary statistics;
-   response rate;
-   success rate.

------------------------------------------------------------------------

# 5. Engineering Principles

Mandatory:

-   Clean Architecture
-   SOLID
-   Domain Driven Design where appropriate
-   Dependency Injection
-   Repository Pattern
-   Adapter Pattern
-   Strategy Pattern
-   Feature-first organization

Rules:

-   Domain must not depend on infrastructure.
-   External services must be replaceable.
-   Every integration must use interfaces.
-   No vendor lock-in.

------------------------------------------------------------------------

# 6. Technology Stack

## Monorepo

Turborepo

Structure:

apps/ - backend - worker - dashboard

packages/ - ai (Post-MVP) - database - providers - notifications
(Post-MVP) - telegram (Post-MVP) - career (Post-MVP) - resume
(Post-MVP) - analytics (Post-MVP) - interview (Post-MVP) - auth -
shared - ui

For MVP, only the packages needed for sourcing (one provider),
persistence, deterministic filtering, and the dashboard are active
work. The remaining packages are scaffolding for accepted Post-MVP
features and are not required to ship the MVP.

------------------------------------------------------------------------

# Backend

Node.js 22+

TypeScript

Fastify

------------------------------------------------------------------------

# Frontend

Next.js 15

React 19

Tailwind CSS

shadcn/ui

TanStack Query

Zustand

React Hook Form

Zod

------------------------------------------------------------------------

# Database

PostgreSQL

Run inside Docker.

ORM:

Prisma

Important:

Prisma must not be used outside infrastructure layer.

------------------------------------------------------------------------

# Queue

BullMQ

Redis

------------------------------------------------------------------------

# AI Layer --- Post-MVP (Excluded from MVP)

Provider abstraction.

Interface:

AIProvider

Supported:

-   OpenAI
-   Anthropic
-   Gemini
-   OpenRouter

Changing AI provider must require configuration only.

------------------------------------------------------------------------

# Notifications --- Post-MVP (Excluded from MVP)

Interface:

NotificationProvider

Implement:

-   Telegram
-   Email
-   Discord
-   Slack

------------------------------------------------------------------------

# 7. Docker Requirements

The whole system must start with:

docker compose up

Containers:

-   backend
-   worker
-   dashboard
-   postgres
-   redis
-   pgadmin

Optional:

-   mailpit

No local database installation.

No local Redis installation.

------------------------------------------------------------------------

# 8. Architecture Rules

The system must follow:

Presentation Layer

↓

Application Layer

↓

Domain Layer

↓

Infrastructure Layer

Dependencies point inward.

This generic layering is the internal structure of each of the four
accepted layers described in Section 3 (Provider SDK, Persistence,
Application Layer, Consumers) --- it is not a competing architecture.

------------------------------------------------------------------------

# 9. Development Workflow

AI Agent must work as:

-   CTO
-   Software Architect
-   Staff Engineer

Not as a code generator.

Workflow:

1.  Analyze requirements.
2.  Research.
3.  Design architecture.
4.  Create ADR if needed.
5.  Create implementation plan.
6.  Implement.
7.  Run lint.
8.  Run typecheck.
9.  Run tests.
10. Review code.
11. Refactor.
12. Update documentation.
13. Create clean commit.

Architecture, MVP boundaries, and documentation strategy are already
decided (see Section 13 and the accepted architecture in Section 3).
Steps 1--3 apply to *implementation* decisions within that accepted
scope, not to re-litigating it.

------------------------------------------------------------------------

# 10. Development Phases

## Phase 0 --- MVP

Create documentation:

-   Vision
-   Requirements
-   Architecture
-   ADR
-   Domain Model
-   Roadmap
-   Coding Standards
-   Guardrails

No code.

------------------------------------------------------------------------

## Phase 1 --- MVP

Bootstrap:

-   Turborepo
-   TypeScript
-   ESLint
-   Prettier
-   Docker
-   CI

------------------------------------------------------------------------

## Phase 2 --- MVP

Infrastructure:

-   PostgreSQL
-   Prisma
-   Redis
-   BullMQ
-   Configuration
-   Logging

------------------------------------------------------------------------

## Phase 3 --- MVP core entities, Post-MVP entities noted

Create:

-   User
-   Job
-   Company
-   SearchProfile
-   Resume (Post-MVP)
-   Application (Post-MVP)
-   Interview (Post-MVP)
-   Notification (Post-MVP)
-   Feedback (Post-MVP)

------------------------------------------------------------------------

## Phase 4 --- MVP

Backend API

Create:

-   authentication;
-   REST API;
-   validation;
-   health checks.

------------------------------------------------------------------------

## Phase 5 --- Post-MVP (Excluded from MVP)

AI Layer

Create AIProvider abstraction.

------------------------------------------------------------------------

## Phase 6 --- MVP: one provider; Post-MVP: additional providers

Job Providers

MVP: implement exactly one provider through the Provider SDK.

Post-MVP: additional providers, e.g.

-   HH
-   LinkedIn (isolated provider)
-   Habr
-   RemoteOK

------------------------------------------------------------------------

## Phase 7 --- MVP

Vacancy Flow

Flow (accepted architecture, see Section 3):

Provider SDK (fetch, map, normalize, validate, retry, health,
incremental sync)

↓

Persistence (durable storage, cross-run deduplication, vacancy
lifecycle, canonical entities)

↓

Application Layer (deterministic SearchProfile filtering: remote,
salary, technologies, include / exclude keywords)

↓

Consumers (Dashboard for MVP; AI, Notifications, future consumers are
Post-MVP)

------------------------------------------------------------------------

## Phase 8 --- Post-MVP (Excluded from MVP)

Telegram Bot

Commands:

/start

/search

/profile

/history

/settings

/resume

/stats

Buttons:

-   Apply
-   Favorite
-   Ignore
-   Generate Resume
-   Generate Cover Letter
-   Generate Interview

------------------------------------------------------------------------

## Phase 9 --- Post-MVP (Excluded from MVP)

Career CRM

Implement:

-   application tracking;
-   statuses;
-   notes;
-   recruiter information.

------------------------------------------------------------------------

## Phase 10 --- Post-MVP (Excluded from MVP)

Follow-up Engine

Implement:

-   scheduler;
-   reminders;
-   AI follow-up generation;
-   notification workflow.

------------------------------------------------------------------------

## Phase 11 --- MVP core, Post-MVP extensions

Dashboard

Next.js interface.

MVP:

-   jobs list (filtered vacancies);
-   outbound link;
-   save / dismiss.

Post-MVP:

-   applications;
-   CRM;
-   analytics;
-   settings.

------------------------------------------------------------------------

## Phase 12 --- Post-MVP (Excluded from MVP)

Advanced AI Features

-   learning engine;
-   salary prediction;
-   skill recommendations;
-   interview simulator.

------------------------------------------------------------------------

# 11. Coding Rules

Forbidden:

-   any type;
-   duplicated logic;
-   TODO in production;
-   FIXME in production;
-   business logic in controllers;
-   direct infrastructure access from domain;
-   direct OpenAI calls from business logic.

Required:

-   strict typing;
-   tests;
-   documentation;
-   clean commits.

------------------------------------------------------------------------

# 12. Definition of Done

A feature is complete only when:

-   architecture is preserved;
-   tests pass;
-   lint passes;
-   typecheck passes;
-   documentation updated;
-   Docker works;
-   no technical debt without decision record.

------------------------------------------------------------------------

# 13. Golden Rules

1.  Architecture before implementation.

2.  Domain before infrastructure.

3.  One Epic at a time.

4.  Every external dependency must be replaceable.

5.  Every feature must reduce manual work.

6.  Never sacrifice architecture for speed.

7.  Build a Career Operating System, not a simple vacancy parser ---
    but ship the MVP first (Section 14).

------------------------------------------------------------------------

# 14. MVP Scope

This was the accepted MVP at the time this document was written. It has
since shipped and been substantially exceeded — see the status note at
the top of this document and `CareerOS_AI_Agent_Project_Context.md` for
current state. The list below is kept as the historical MVP definition,
not as a description of what's excluded today.

## Included (originally) — all shipped

-   one provider → shipped, then extended to 20+ providers;
-   one search profile → shipped;
-   deterministic filtering (remote, salary, technologies, include /
    exclude keywords) → shipped;
-   dashboard → shipped, now the primary UI;
-   outbound link to the original vacancy → shipped;
-   saved / dismissed → shipped.

## "Excluded from MVP" (originally) — actual current status

-   AI → **shipped**, plus a multi-provider resilience/fallback layer beyond original scope (ADR-025, ADR-028)
-   CRM → **shipped** (applications, statuses, recruiter management)
-   Telegram → **shipped** (account linking, digest delivery)
-   Resume parsing → **partially shipped** (PDF only; DOCX/Markdown never built)
-   Automation → partially shipped (follow-up reminders automated; no broader workflow automation)
-   Auto Apply → **not built**
-   Multiple providers → **shipped**, far exceeded (20+ sources)
-   Notifications → **shipped** (Telegram + digest; email delivery in production not verified)

This section originally said "do not build everything immediately, build
a small complete product first." That's done — the product is well past
the small-complete-product stage. Current priorities are elsewhere: see
the "Current Priority" section in `CareerOS_AI_Agent_Project_Context.md`
(wiring up cover letter/resume tailoring, building a real Interview
Assistant, extending the browser extension).

------------------------------------------------------------------------

# Final Instruction For AI Agent

The architecture, MVP boundaries, and documentation strategy in this
document are already decided. Do not re-analyze them or propose
alternatives.

Before writing code:

Read this document completely.

Confirm the change you're making falls inside the MVP (Section 14) or
is explicitly scoped Post-MVP work the user has asked for.

Only then start implementation.

Work as a senior engineering team.

The goal is not to write code quickly.

The goal is to build a maintainable AI Career Operating System,
starting from a small, complete MVP.
