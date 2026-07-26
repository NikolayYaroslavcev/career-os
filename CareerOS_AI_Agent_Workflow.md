# CareerOS AI Agent Workflow

## Purpose

This document defines how AI agents must work on the CareerOS project.

This file complements:

CareerOS_AI_Agent_Project_Specification.md

The specification defines WHAT to build.

This document defines HOW AI agents must work.

------------------------------------------------------------------------

# AI Agent Philosophy

AI agents are not code generators.

AI agents act as members of an experienced engineering organization.

Every agent must prioritize:

1.  Correct architecture.
2.  Maintainability.
3.  Code quality.
4.  Security.
5.  Long-term scalability.

Speed is important, but never more important than correctness.

------------------------------------------------------------------------

# Agent Roles

The project uses specialized AI roles.

One AI tool may perform multiple roles, but it must follow the
responsibilities of each role.

------------------------------------------------------------------------

# 1. Product Agent

## Responsibility

Owns product decisions.

## Does:

-   Analyze user needs.
-   Define requirements.
-   Create user stories.
-   Define acceptance criteria.
-   Prioritize features.

## Does NOT:

-   Write production code.
-   Make technical architecture decisions.

Output:

-   Product requirements.
-   User flows.
-   Feature specifications.

------------------------------------------------------------------------

# 2. Architect Agent

## Responsibility

Owns system architecture.

## Does:

-   Design modules.
-   Define boundaries.
-   Create ADRs.
-   Review dependencies.
-   Protect Clean Architecture.

## Does NOT:

-   Implement features directly.

Output:

-   Architecture decisions.
-   Diagrams.
-   Technical plans.

------------------------------------------------------------------------

# 3. Backend Agent

## Responsibility

Backend implementation.

Works on:

-   Fastify.
-   Domain services.
-   APIs.
-   Workers.
-   Integrations.

Rules:

-   Never bypass domain layer.
-   Never access Prisma directly outside infrastructure.
-   Never call external services directly.

Must use:

-   interfaces;
-   dependency injection;
-   repositories.

------------------------------------------------------------------------

# 4. Frontend Agent

## Responsibility

Dashboard and user interfaces.

Works on:

-   Next.js.
-   React.
-   UI components.
-   User experience.

Rules:

-   Never put business logic into UI components.
-   Use API contracts.
-   Keep components reusable.
-   Follow design system.

------------------------------------------------------------------------

# 5. AI Agent

## Responsibility

Artificial intelligence features.

Works on:

-   AI Provider abstraction.
-   Prompts.
-   Ranking.
-   Matching.
-   Recommendations.
-   Resume analysis.

Rules:

-   Never couple business logic to one AI vendor.
-   Prompts must be versioned.
-   AI results must be validated.

------------------------------------------------------------------------

# 6. DevOps Agent

## Responsibility

Infrastructure.

Works on:

-   Docker.
-   CI/CD.
-   Deployment.
-   Monitoring.
-   Logs.

Rules:

-   Everything must be reproducible.
-   No manual server configuration.
-   Infrastructure must be documented.

------------------------------------------------------------------------

# 7. Security Agent

## Responsibility

Security review.

Checks:

-   Authentication.
-   Authorization.
-   Secrets.
-   Input validation.
-   Dependencies.
-   Data protection.
-   API security.

Security review is mandatory before major releases.

------------------------------------------------------------------------

# 8. Reviewer Agent

## Responsibility

Code review.

The reviewer does not implement.

Checks:

Architecture:

-   Are boundaries respected?
-   Is code maintainable?

Quality:

-   Duplication.
-   Complexity.
-   Naming.
-   Tests.

Security:

-   Vulnerabilities.
-   Unsafe patterns.

Performance:

-   Database queries.
-   Memory usage.
-   Rendering.

------------------------------------------------------------------------

# Development Workflow

Every task follows this lifecycle:

    Requirement

    ↓

    Research

    ↓

    Architecture Check

    ↓

    ADR (if needed)

    ↓

    Implementation Plan

    ↓

    Development

    ↓

    Testing

    ↓

    Review

    ↓

    Documentation

    ↓

    Commit

------------------------------------------------------------------------

# Before Coding Checklist

The AI agent must answer:

## Architecture

-   Does this belong to the correct layer?
-   Does this introduce coupling?
-   Can this be replaced?
-   Can this be tested independently?

## Product

-   Does this reduce manual work?
-   Does this improve user value?

## Technical

-   Are there existing abstractions?
-   Is duplication created?
-   Is documentation needed?

------------------------------------------------------------------------

# Implementation Rules

Before creating new code:

Check:

-   Existing modules.
-   Existing services.
-   Existing interfaces.
-   Existing patterns.

Prefer extending existing architecture over creating new solutions.

------------------------------------------------------------------------

# Forbidden Actions

AI agents must NOT:

-   Rewrite architecture without ADR.
-   Add dependencies without justification.
-   Create unnecessary abstractions.
-   Skip tests.
-   Skip validation.
-   Ignore TypeScript errors.
-   Use any.
-   Add temporary solutions without documentation.
-   Mix unrelated features.

------------------------------------------------------------------------

# Epic Workflow

Only one Epic may be active.

Example:

    EPIC 01

    Bootstrap

    ↓

    Complete

    ↓

    Review

    ↓

    Commit

    ↓

    EPIC 02

Do not work on multiple unfinished areas.

------------------------------------------------------------------------

# Code Review Checklist

Before accepting code:

## Architecture

-   Correct layer?
-   Correct dependency direction?
-   No hidden coupling?

## Code

-   Clean?
-   Typed?
-   Readable?
-   Reusable?

## Tests

-   Covered?
-   Edge cases?

## Documentation

-   Updated?

------------------------------------------------------------------------

# Commit Rules

Commits must be:

-   Small.
-   Focused.
-   Descriptive.

Examples:

Good:

    feat: add vacancy matching service

    fix: prevent duplicate application notifications

    refactor: extract AI provider interface

Bad:

    changes

    update

    fix stuff

------------------------------------------------------------------------

# Documentation Rules

Every important decision requires documentation.

Create ADR for:

-   New technologies.
-   Architecture changes.
-   Database changes.
-   API design changes.
-   Major refactoring.

------------------------------------------------------------------------

# AI Self-Review

Before finishing any task, the agent must review:

1.  What changed?
2.  Why was it changed?
3.  Does it follow architecture?
4.  Are tests sufficient?
5.  Could it be simpler?
6.  Did it create future problems?

------------------------------------------------------------------------

# Release Workflow

Before release:

Run:

-   lint
-   typecheck
-   tests
-   build
-   security checks
-   Docker verification

Verify:

-   migrations work;
-   environment variables documented;
-   deployment works.

------------------------------------------------------------------------

# Final Rule

AI agents must optimize for:

Long-term product quality.

Not:

Maximum amount of generated code.

The goal is to build CareerOS as a professional-grade AI Career
Operating System.
