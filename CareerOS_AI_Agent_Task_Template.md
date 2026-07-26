# CareerOS AI Agent Task Template

## Purpose

This document defines the mandatory template for every development task
in CareerOS.

AI agents must use this structure before implementing any feature.

The goal is to ensure:

-   clear requirements;
-   correct architecture;
-   predictable implementation;
-   high quality;
-   easy review.

------------------------------------------------------------------------

# Task Information

## Task ID

Example:

TASK-001

------------------------------------------------------------------------

## Title

Short and descriptive task name.

Example:

Implement vacancy matching service.

------------------------------------------------------------------------

## Epic

The Epic this task belongs to.

Example:

EPIC-03 AI Engine

------------------------------------------------------------------------

## Priority

Options:

-   Critical
-   High
-   Medium
-   Low

------------------------------------------------------------------------

## Status

Options:

-   Planned
-   In Progress
-   Review
-   Completed

------------------------------------------------------------------------

# Context

Describe:

-   Why this task exists.
-   What problem it solves.
-   How it fits into CareerOS.

Example:

Users need to understand how suitable a vacancy is before applying.

------------------------------------------------------------------------

# Goal

Describe the expected outcome.

Example:

Create an AI-powered service that compares a vacancy with a user's
resume and returns a compatibility score.

------------------------------------------------------------------------

# Requirements

## Functional Requirements

List what the system must do.

Example:

-   Accept vacancy data.
-   Accept resume profile.
-   Generate match score.
-   Return explanation.

------------------------------------------------------------------------

## Non Functional Requirements

Include:

-   Performance.
-   Security.
-   Scalability.
-   Maintainability.

------------------------------------------------------------------------

# Architecture Impact

Answer:

Does this change:

-   Domain?
-   Infrastructure?
-   API?
-   Database?
-   External providers?
-   UI?

If yes:

Create ADR.

------------------------------------------------------------------------

# Affected Modules

Example:

apps/backend

packages/ai

packages/career

packages/database

------------------------------------------------------------------------

# Existing Architecture Check

Before coding answer:

## Can existing functionality be reused?

Yes/No

Explanation.

------------------------------------------------------------------------

## Does this introduce duplication?

Yes/No

Explanation.

------------------------------------------------------------------------

## Does this violate project principles?

Yes/No

Explanation.

------------------------------------------------------------------------

# Implementation Plan

Describe step by step.

Example:

1.  Create interface.
2.  Create service.
3.  Add repository.
4.  Add tests.
5.  Connect API.

------------------------------------------------------------------------

# Database Changes

If needed describe:

-   New tables.
-   New fields.
-   Migrations.
-   Indexes.

------------------------------------------------------------------------

# API Changes

Describe:

-   Endpoints.
-   Requests.
-   Responses.
-   Validation.

------------------------------------------------------------------------

# External Integrations

Describe:

-   New providers.
-   New APIs.
-   Configuration changes.

------------------------------------------------------------------------

# Testing Plan

Required tests:

## Unit Tests

What should be tested.

------------------------------------------------------------------------

## Integration Tests

What should be tested.

------------------------------------------------------------------------

## Edge Cases

List possible failures.

------------------------------------------------------------------------

# Security Review

Check:

-   Authentication.
-   Authorization.
-   Validation.
-   Secrets.
-   Data exposure.

------------------------------------------------------------------------

# Performance Review

Check:

-   Database queries.
-   Caching.
-   Memory usage.
-   Network calls.

------------------------------------------------------------------------

# Acceptance Criteria

The task is complete only when:

Example:

-   [ ] Feature implemented.
-   [ ] Tests added.
-   [ ] Lint passes.
-   [ ] Typecheck passes.
-   [ ] Documentation updated.
-   [ ] No architecture violations.
-   [ ] Clean commit created.

------------------------------------------------------------------------

# Final Review

Before completion AI must answer:

1.  What changed?
2.  Why was this solution chosen?
3.  What alternatives were considered?
4.  What risks remain?
5.  What should be done next?

------------------------------------------------------------------------

# Commit Message

Format:

type(scope): description

Examples:

feat(ai): add vacancy matching engine

fix(worker): prevent duplicate notifications

refactor(domain): extract application service

------------------------------------------------------------------------

# Rule

No task can start implementation until this document is completed.
