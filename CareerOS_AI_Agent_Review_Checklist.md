# CareerOS AI Agent Review Checklist

## Purpose

Mandatory checklist for reviewing every completed task, Epic, or
release.

AI agents must use this document before marking work as completed.

The goal:

-   maintain architecture quality;
-   prevent technical debt;
-   keep the system scalable.

------------------------------------------------------------------------

# 1. Architecture Review

## Domain

Check:

-   Is business logic located in the Domain layer?
-   Does Domain avoid infrastructure dependencies?
-   Are responsibilities correctly separated?

------------------------------------------------------------------------

## Dependencies

Check:

-   Are dependencies pointing inward?
-   Are interfaces used correctly?
-   Is coupling minimized?

------------------------------------------------------------------------

## Extensibility

Check:

-   Can this module be replaced?
-   Can this feature be extended?
-   Does it support future requirements?

------------------------------------------------------------------------

# 2. Code Quality Review

Check:

-   Is TypeScript strict?
-   Is there any usage?
-   Is code duplicated?
-   Are names clear?
-   Are functions focused?
-   Are modules maintainable?

------------------------------------------------------------------------

# 3. SOLID Review

## Single Responsibility

Each module has one reason to change.

## Open Closed Principle

New behavior should be added without modifying existing logic.

## Liskov Substitution

Implementations must respect interfaces.

## Interface Segregation

Interfaces should not contain unnecessary methods.

## Dependency Inversion

High-level logic depends on abstractions.

------------------------------------------------------------------------

# 4. Testing Review

Check:

## Unit Tests

Business logic covered.

## Integration Tests

External interactions covered.

## Edge Cases

Failures handled.

## Regression

Existing functionality preserved.

------------------------------------------------------------------------

# 5. Security Review

Check:

Authentication

Authorization

Validation

Secrets

Sensitive data

Dependencies

External inputs

------------------------------------------------------------------------

# 6. Database Review

Check:

Schema design

Indexes

Migrations

Queries

Performance

Transactions

Data consistency

------------------------------------------------------------------------

# 7. API Review

Check:

Contracts

Validation

Error handling

Documentation

Backward compatibility

------------------------------------------------------------------------

# 8. Performance Review

Check:

Database efficiency

Caching

Memory usage

Network calls

Large payloads

Background processing

------------------------------------------------------------------------

# 9. AI Feature Review

For AI features check:

-   Provider abstraction exists.
-   Prompts are documented.
-   AI output is validated.
-   Failures are handled.
-   Cost is considered.
-   Results are reproducible.

------------------------------------------------------------------------

# 10. Documentation Review

Update:

-   README
-   Architecture docs
-   ADR
-   API docs
-   Task status

------------------------------------------------------------------------

# 11. Deployment Review

Check:

-   Docker works.
-   Environment variables documented.
-   Migration process works.
-   Health checks pass.
-   CI passes.

------------------------------------------------------------------------

# 12. Final AI Self Review

Before completing:

Answer:

## What changed?

Describe implementation.

## Why this approach?

Explain architectural reasoning.

## What alternatives existed?

Explain rejected approaches.

## What risks remain?

List possible future issues.

## What is the next recommended step?

Provide continuation plan.

------------------------------------------------------------------------

# Completion Criteria

A task can be completed only when:

-   Architecture review passed.
-   Code review passed.
-   Security review passed.
-   Tests passed.
-   Documentation updated.
-   No unresolved critical issues exist.

------------------------------------------------------------------------

# Golden Review Rule

The question is not:

"Does the code work?"

The question is:

"Will this code still be correct, understandable and maintainable after
years of development?"
