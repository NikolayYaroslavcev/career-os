# ADR-002: Clean Architecture

## Status

Accepted

## Date

2026-01-15

## Context

CareerOS must be maintainable over years of development. Business logic must not be coupled to frameworks, databases, or external services. New features must be addable without modifying existing code.

## Decision

Implement Clean Architecture with four layers:

1. **Domain** - Business entities, value objects, repository interfaces
2. **Application** - Use cases, services, orchestration
3. **Infrastructure** - Database, external APIs, queue implementations
4. **Presentation** - HTTP handlers, UI components, bot handlers

Dependencies point inward only.

## Layer Responsibilities

### Domain Layer
- Pure TypeScript, zero framework imports
- Entities with business rules
- Value objects for immutable data
- Repository interfaces (not implementations)
- Domain events

### Application Layer
- Use cases that coordinate domain objects
- Transaction boundaries
- Application services
- No infrastructure imports

### Infrastructure Layer
- Implements domain interfaces
- Prisma database access
- External API clients
- Queue producers/consumers
- All framework-specific code

### Presentation Layer
- HTTP request/response handling
- Input validation
- Authentication/authorization
- Thin controllers that delegate to application layer

## Rationale

### Clean Architecture over MVC
- MVC couples business logic to HTTP
- Clean Architecture makes logic testable without HTTP
- Same domain logic can serve API, bot, and CLI

### Clean Architecture over Hexagonal
- Same concept, different naming
- Clean Architecture is more widely understood
- Fits better with existing TypeScript ecosystem

## Consequences

### Positive
- Business logic is framework-agnostic
- Easy to replace database, AI provider, or notification system
- Unit tests don't need HTTP servers or databases
- Clear separation of concerns

### Negative
- More files and interfaces to maintain
- Initial setup is more complex
- Team must understand the pattern

### Mitigations
- Feature-first organization reduces file count
- Code generation for boilerplate
- Documentation and code review enforce patterns

## Enforcement Rules

1. Domain package has zero dependencies on other packages
2. Application layer imports only Domain interfaces
3. Infrastructure implements Domain interfaces
4. Presentation delegates to Application layer
5. No Prisma imports outside `packages/database`
6. No direct AI API calls outside `packages/ai`

## Alternatives Considered

1. **MVC**: Rejected. Couples logic to HTTP framework.
2. **Service Layer only**: Rejected. No clear infrastructure boundary.
3. **Vertical slices**: Considered for future. Clean Architecture for now.
