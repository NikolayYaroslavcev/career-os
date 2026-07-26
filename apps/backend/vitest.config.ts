import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],
    // These two hit prisma.vacancy.findMany() directly and assert on real
    // result volume (e.g. "top20Relevant >= 10") — they're manual ranking
    // quality evaluations against a populated, real-world-seeded dev
    // database, not repeatable unit tests. They fail (0 vacancies) against
    // the empty DB CI's `pnpm test` job provisions by design (see ci.yml:
    // "Does not touch a real database"). Run manually against a seeded
    // local DB when validating ranking-quality changes.
    exclude: [
      'node_modules', 'dist', '.turbo',
      'src/services/ranking/multi-profile-validation.test.ts',
      'src/services/ranking/vacancy-ranking-quality.test.ts',
    ],
  },
});
