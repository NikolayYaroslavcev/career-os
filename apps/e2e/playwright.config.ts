import { defineConfig, devices } from '@playwright/test';

/**
 * Primary smoke test for the whole platform. Runs against a fully running
 * stack (dashboard + backend + worker + Postgres + Redis) — see the `e2e`
 * job in .github/workflows/ci.yml, which brings the stack up via
 * docker-compose before invoking this config. Locally, point
 * E2E_BASE_URL/E2E_API_URL at your own `docker compose up` stack.
 */
export default defineConfig({
  testDir: './tests',
  timeout: 60_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:3001',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
