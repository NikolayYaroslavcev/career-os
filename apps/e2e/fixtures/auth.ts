import { test as base, type Page, type BrowserContext } from '@playwright/test';
import { type TestUser } from '../factories/user';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

const __dirname = dirname(fileURLToPath(import.meta.url));
const STORAGE_STATE_PATH = join(__dirname, '../test-data/.auth/state.json');
const ADMIN_STORAGE_STATE_PATH = join(__dirname, '../test-data/.auth/state-admin.json');
// apps/e2e/fixtures -> repo root
const REPO_ROOT = join(__dirname, '../../..');
const BASE_URL = process.env.E2E_BASE_URL ?? 'http://localhost:3001';
const API_URL = process.env.E2E_API_URL ?? 'http://localhost:3000';

const FIXED_USER: TestUser = {
  firstName: 'E2E',
  lastName: 'Tester',
  email: 'e2e-fixed-user@example.test',
  password: 'TestPass!2024',
};

const FIXED_ADMIN_USER: TestUser = {
  firstName: 'E2E',
  lastName: 'Admin',
  email: 'e2e-fixed-admin@example.test',
  password: 'TestPass!2024',
};

// There is no self-service "assign role" API (by design — see
// apps/backend/src/scripts/promote-user-to-admin.ts). Role changes are a
// deliberate, out-of-band operation, so the admin fixture shells out to
// that exact script rather than writing to the database itself — same
// path a human operator uses, run against the host-exposed Postgres port
// the full docker-compose stack publishes.
async function promoteToAdmin(email: string): Promise<void> {
  await execFileAsync(
    'pnpm',
    ['--filter', '@careeros/backend', 'exec', 'tsx', 'src/scripts/promote-user-to-admin.ts', email],
    { cwd: REPO_ROOT, shell: true }
  );
}

interface AuthFixtures {
  testUser: TestUser;
  authenticatedPage: Page;
  authenticatedAdminPage: Page;
}

export const test = base.extend<AuthFixtures>({
  testUser: async ({}, use: (u: TestUser) => Promise<void>) => {
    await use(FIXED_USER);
  },

  authenticatedPage: async ({ browser, playwright }, use: (p: Page) => Promise<void>) => {
    let context: BrowserContext;

    if (existsSync(STORAGE_STATE_PATH)) {
      // Reuse saved state (cookies + localStorage)
      context = await browser.newContext({ storageState: STORAGE_STATE_PATH });
    } else {
      // Register via API
      const api = await playwright.request.newContext({ baseURL: API_URL });
      await api.post('/api/v1/auth/register', {
        data: { firstName: FIXED_USER.firstName, lastName: FIXED_USER.lastName, email: FIXED_USER.email, password: FIXED_USER.password },
      }).catch(() => {});
      await api.dispose();

      // Login via UI to get proper session
      context = await browser.newContext();
      const page = await context.newPage();
      await page.goto(`${BASE_URL}/login`);
      await page.waitForLoadState('domcontentloaded');
      await page.getByLabel(/Email/i).fill(FIXED_USER.email);
      await page.getByLabel(/^Password$|^Пароль$/i).fill(FIXED_USER.password);
      await page.getByRole('button', { name: /Sign in|Войти/i }).click();
      await page.waitForURL(/\/app/, { timeout: 15_000 });

      // Save state
      const dir = dirname(STORAGE_STATE_PATH);
      if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
      await context.storageState({ path: STORAGE_STATE_PATH });
    }

    const page = await context.newPage();
    await page.goto(`${BASE_URL}/app`);
    await page.waitForLoadState('domcontentloaded');

    await use(page);
    await context.close();
  },

  authenticatedAdminPage: async ({ browser, playwright }, use: (p: Page) => Promise<void>) => {
    let context: BrowserContext;

    if (existsSync(ADMIN_STORAGE_STATE_PATH)) {
      // Reuse saved state (cookies + localStorage)
      context = await browser.newContext({ storageState: ADMIN_STORAGE_STATE_PATH });
    } else {
      // Register via API
      const api = await playwright.request.newContext({ baseURL: API_URL });
      await api.post('/api/v1/auth/register', {
        data: {
          firstName: FIXED_ADMIN_USER.firstName,
          lastName: FIXED_ADMIN_USER.lastName,
          email: FIXED_ADMIN_USER.email,
          password: FIXED_ADMIN_USER.password,
        },
      }).catch(() => {});
      await api.dispose();

      // Grant ADMIN before logging in, so the freshly-issued JWT carries it
      await promoteToAdmin(FIXED_ADMIN_USER.email);

      // Login via UI to get proper session
      context = await browser.newContext();
      const page = await context.newPage();
      await page.goto(`${BASE_URL}/login`);
      await page.waitForLoadState('domcontentloaded');
      await page.getByLabel(/Email/i).fill(FIXED_ADMIN_USER.email);
      await page.getByLabel(/^Password$|^Пароль$/i).fill(FIXED_ADMIN_USER.password);
      await page.getByRole('button', { name: /Sign in|Войти/i }).click();
      await page.waitForURL(/\/app/, { timeout: 15_000 });

      // Save state
      const dir = dirname(ADMIN_STORAGE_STATE_PATH);
      if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
      await context.storageState({ path: ADMIN_STORAGE_STATE_PATH });
    }

    const page = await context.newPage();
    await page.goto(`${BASE_URL}/app`);
    await page.waitForLoadState('domcontentloaded');

    await use(page);
    await context.close();
  },
});

export { expect } from '@playwright/test';
