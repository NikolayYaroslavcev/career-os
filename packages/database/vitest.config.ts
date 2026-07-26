import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],
    // Real-DB integration tests (src/__integration__/*.integration.test.ts)
    // need a live Postgres and run only via `pnpm test:integration` in CI —
    // excluded here so `pnpm test` stays DB-free for local/offline dev.
    exclude: ['node_modules', 'dist', '.turbo', 'src/**/*.integration.test.ts'],
  },
});
