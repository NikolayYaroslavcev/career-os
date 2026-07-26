# CareerOS AI Agent Project Context

## Purpose

This document provides persistent project context for AI agents.

It is designed to be read at the beginning of every AI development
session.

This file explains:

-   what the project is;
-   why it exists;
-   current architecture decisions;
-   current development status;
-   active priorities;
-   important constraints.

This document does not replace:

-   Project Specification;
-   AI Workflow;
-   ADR documents.

It provides fast context.

------------------------------------------------------------------------

# Project Name

CareerOS

AI Career Operating System

------------------------------------------------------------------------

# Project Summary

CareerOS is an AI-powered career management platform.

The goal is to create a personal AI career assistant that works
continuously for the user.

The system should:

-   discover job opportunities;
-   analyze vacancies;
-   compare them with the user's experience;
-   rank opportunities;
-   manage applications;
-   remind about follow-ups;
-   generate career documents;
-   prepare interviews;
-   analyze career progress.

CareerOS is a career operating system, not a simple job aggregator.

------------------------------------------------------------------------

# Main Product Idea

The user should not spend hours searching for jobs.

The AI should handle repetitive work.

The user should only make important decisions.

The system continuously improves based on:

-   user preferences;
-   saved jobs;
-   ignored jobs;
-   applications;
-   interviews;
-   offers.

------------------------------------------------------------------------

# Current Product Vision

CareerOS consists of several major systems.

## Job Intelligence

Collect and understand vacancies.

## AI Matching

Determine how well a vacancy matches the user.

## Career CRM

Manage applications and communication.

## Follow-up Engine

Automatically remind the user to contact companies.

## Resume Intelligence

Generate and optimize career documents.

## Interview Assistant

Prepare for interviews.

## Analytics

Understand career progress.

------------------------------------------------------------------------

# Core Architecture Rules

These decisions are considered fundamental.

## Domain First

The business domain is the center of the system.

Infrastructure is replaceable.

------------------------------------------------------------------------

## Provider Based Architecture

External systems must be adapters.

Examples:

Job providers:

-   LinkedIn
-   HH
-   Habr
-   RemoteOK

AI providers:

-   OpenAI
-   Anthropic
-   Gemini

Notification providers:

-   Telegram
-   Email
-   Discord

------------------------------------------------------------------------

## Replaceability Rule

Any external dependency must be replaceable without changing business
logic.

------------------------------------------------------------------------

# Technology Stack

## Monorepo

Turborepo

------------------------------------------------------------------------

## Backend

Node.js 22+

TypeScript

Fastify

------------------------------------------------------------------------

## Frontend

Next.js 15

React 19

Tailwind CSS

shadcn/ui

------------------------------------------------------------------------

## Database

PostgreSQL

Prisma ORM

------------------------------------------------------------------------

## Queue

Redis

BullMQ

------------------------------------------------------------------------

## Infrastructure

Docker Compose

CI/CD

------------------------------------------------------------------------

# Repository Structure

Actual (2026-07-23, verified against the filesystem — this replaces the old "Expected" placeholder list, which undercounted both apps and packages):

career-os/

apps/

- backend/
- worker/
- dashboard/
- extension/ (browser extension, not in the original plan)
- e2e/

packages/

- ai/
- ai-orchestrator/ (resilience/fallback layer, ADR-025/ADR-028)
- database/
- providers/
- notifications/
- telegram/
- career/ (the DDD domain layer — entities, value objects, events, repository interfaces)
- resume/ (thin — most resume logic lives in `apps/backend/src/services`)
- analytics/
- interview/ (empty stub — see Known Gaps above)
- company-watch/
- extension-shared/
- test-utils/
- auth/
- shared/

docs/ (see `docs/README.md` for the intended hierarchy)

adr/ (root-level ADRs 001-030; there is also a separate `docs/adr/` with a different, older ADR-001-010 numbering — the two are not reconciled)

tasks/

epics/ (EPIC-01 through EPIC-17, with a gap: EPIC-16/17 files were added retroactively during this doc fix, see those files' Status sections)

There is no `packages/ui/` — shared UI primitives, if any, live inside `apps/dashboard`.

------------------------------------------------------------------------

# Current Development Status

> **Corrected 2026-07-23.** This section previously read "Phase: Foundation planning" / "Not Started: Implementation," which was stale — verified against actual code, not against other docs (several other planning docs in this repo made the same false claim and have been corrected alongside this one). See `docs/ROADMAP.md` and `epics/*.md` for per-epic detail.

## Phase

Active development, well past MVP. EPIC-01 through EPIC-13 are implemented (several beyond original scope), plus EPIC-16 and EPIC-17 (search decoupling and diagnostics, see ADR-026/ADR-027).

## Completed

-   Monorepo, Docker, CI (EPIC-01/02).
-   Full DDD domain layer (EPIC-03).
-   Backend API with auth (EPIC-04).
-   AI provider abstraction + resilience/fallback orchestrator, 5 providers (EPIC-05, ADR-025, ADR-028).
-   20+ job providers (EPIC-06, ADR-030) — far beyond the original 3-provider plan.
-   Career CRM: applications, statuses, recruiter management (EPIC-07).
-   Follow-up engine with Telegram/digest delivery (EPIC-08).
-   Job aggregation/matching/ranking pipeline (EPIC-09), decoupled from the search request path (EPIC-16) with added diagnostics (EPIC-17).
-   Telegram bot with account linking and digest delivery (EPIC-10).
-   Resume upload + AI structured extraction, PDF only (EPIC-11, partial).
-   Next.js dashboard as the primary UI (EPIC-12).
-   Career analytics / recommendations (EPIC-13, partial — see below).
-   Browser extension core detect-and-save flow (`apps/extension`, ADR-008) — not in the original epic list.

## Known Gaps (verified against code, not docs)

-   **Interview Assistant** — `packages/interview` is an empty stub; the `Interview` domain entity exists but there's no AI question generation and no dashboard route.
-   **Cover letter & resume tailoring** — both are fully built (backend services + dashboard components) but neither is linked from any route, so they're unreachable to users.
-   **Resume import** — PDF only; DOCX and Markdown from the original plan were never implemented.
-   **Learning engine, salary prediction, interview simulator** — not built.

------------------------------------------------------------------------

# Current Priority

Given the state above, the highest-leverage next steps are:

1.  Wire the already-built cover letter and resume tailoring components into the dashboard (e.g. from the application detail view) — this is UI routing, not new feature work.
2.  Build a real Interview Assistant on top of the existing `Interview` domain entity and AI orchestrator.
3.  Extend the browser extension panel to show AI match score and trigger cover-letter generation inline.
4.  Give follow-up reminders a dedicated dashboard view instead of only surfacing via Telegram/digest.

Architecture is already established — new work should extend it, not re-litigate it (see Golden Rules in the Specification).

------------------------------------------------------------------------

# MVP Goal

The first usable version should include:

-   Docker environment.
-   Backend.
-   PostgreSQL.
-   Prisma.
-   Redis.
-   Worker.
-   Telegram bot.
-   Resume parsing.
-   AI vacancy matching.
-   Job provider integration.
-   Career CRM.
-   Follow-up reminders.

------------------------------------------------------------------------

# Future Versions

## Version 0.2 — shipped

Dashboard.

## Version 0.3 — shipped

Analytics, browser extension (core flow only — see Known Gaps).

## Version 0.4 — not started

Learning engine.

## Version 1.0 — not reached

Complete CareerOS platform. Blocked mainly by the Known Gaps above (interview prep, unwired cover letter/resume tailoring), not by the items in this version list.

------------------------------------------------------------------------

# Important Product Differentiators

The system should not only find jobs.

It should manage the entire career process.

Unique features:

-   AI recruiter assistant.
-   Career CRM.
-   Follow-up automation.
-   Resume optimization.
-   Interview preparation.
-   Career analytics.

------------------------------------------------------------------------

# AI Agent Instructions

Before every task:

Read:

1.  CareerOS_AI_Agent_Project_Specification.md
2.  CareerOS_AI_Agent_Workflow.md
3.  CareerOS_AI_Agent_Project_Context.md

Then determine:

-   current phase;
-   allowed actions;
-   architecture constraints.

------------------------------------------------------------------------

# Do Not

Never:

-   rewrite architecture without ADR;
-   add technologies without decision;
-   skip documentation;
-   mix unrelated features;
-   create temporary solutions without tracking;
-   optimize only for speed.

------------------------------------------------------------------------

# Always

Always:

-   preserve architecture;
-   write maintainable code;
-   create tests;
-   update documentation;
-   keep changes focused;
-   create clean commits.

------------------------------------------------------------------------

# Session Handoff Rules

At the end of every development session update:

-   Current status.
-   Completed tasks.
-   Active tasks.
-   Decisions made.
-   Problems discovered.
-   Next recommended action.

This ensures continuity between AI sessions.

------------------------------------------------------------------------

# Final Reminder

CareerOS is not a collection of features.

It is a long-term AI career platform.

Every decision should move the project closer to becoming a reliable AI
assistant that improves the user's career.
