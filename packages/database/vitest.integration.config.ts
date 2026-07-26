import { defineConfig } from 'vitest/config';

// Real-Postgres integration tests. Requires DATABASE_URL to point at a
// migrated database (`prisma migrate deploy` must have run first) — see the
// `integration-tests` job in .github/workflows/ci.yml. Every test in this
// suite cleans up the rows it creates, but is still meant to run against a
// throwaway database, not a shared/long-lived one.
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.integration.test.ts'],
    exclude: ['node_modules', 'dist', '.turbo'],
    testTimeout: 20_000,
    hookTimeout: 20_000,
  },
});
