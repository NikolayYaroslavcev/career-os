# ADR-021: Testing Strategy

## Status

Accepted

## Date

2025-07-15

## Context

EPIC-04 review identified that tests require manual PostgreSQL and Redis setup, blocking CI and developer onboarding. Tests currently depend on real infrastructure, making `pnpm test` fail without Docker containers running. We need a testing strategy that provides:

- Unit tests that run without any external dependencies
- Integration tests that use containerized infrastructure
- Consistent test utilities across all packages
- Fast feedback loop for developers

## Decision

We adopt a two-tier testing strategy:

### Tier 1: Unit Tests (default)

Unit tests mock external dependencies (database, Redis) using vi.mock(). The `@careeros/test-utils` package provides:

- `createTestApp()` - builds a Fastify instance with mocked services
- `createMockPrismaClient()` - returns a typed mock of PrismaClient
- `createMockRedis()` - returns a mock Redis client
- `createMockAuthProvider()` - returns a mock auth provider
- Repository mocks for each domain repository interface

Unit tests use `vitest` with `--passWithNoTests` and run via `pnpm test`.

### Tier 2: Integration Tests (opt-in)

Integration tests use Docker Compose for PostgreSQL and Redis. They are gated behind the `INTEGRATION_TEST` environment variable and use the existing `docker-compose.yml`.

Integration test files use the `*.integration.test.ts` naming convention and are excluded from the default test run.

## Consequences

### Positive

- `pnpm test` passes without any infrastructure running
- Fast test execution (< 5 seconds for unit tests)
- Clear separation between unit and integration concerns
- Test utilities are reusable across all packages
- CI can run unit tests on every commit

### Negative

- Unit tests cannot catch real database schema mismatches
- Integration tests require Docker (adds CI complexity)
- Mock maintenance overhead when interfaces change

### Mitigations

- Integration tests run nightly or on release branches
- Type-safe mocks catch interface changes at compile time
- Repository integration tests validate real queries against testcontainers

## Test File Organization

```
packages/
  test-utils/
    src/
      mock-prisma.ts        # PrismaClient mock factory
      mock-redis.ts         # Redis mock factory
      mock-auth.ts          # AuthProvider mock factory
      test-app.ts           # Fastify test app builder
      index.ts              # Public API
apps/
  backend/
    src/
      routes/
        routes.test.ts      # Unit tests (default)
        routes.integration.test.ts  # Integration tests (opt-in)
```

## Test Naming Convention

- `*.test.ts` - Unit tests (mocked dependencies)
- `*.integration.test.ts` - Integration tests (real infrastructure)

## References

- [Vitest Mocking Guide](https://vitest.dev/guide/mocking.html)
- [Testcontainers](https://testcontainers.com/)
- [Fastify Testing](https://fastify.dev/docs/latest/Guides/Testing/)
