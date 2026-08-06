import { test as base, type Page, type BrowserContext } from '@playwright/test';
import { type TestUser } from '../factories/user';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const STORAGE_STATE_PATH = join(__dirname, '../test-data/.auth/state.json');
const BASE_URL = process.env.E2E_BASE_URL ?? 'http://localhost:3001';
const API_URL = process.env.E2E_API_URL ?? 'http://localhost:3000';

const FIXED_USER: TestUser = {
  firstName: 'E2E',
  lastName: 'Tester',
  email: 'e2e-fixed-user@example.test',
  password: 'TestPass!2024',
};

interface AuthFixtures {
  testUser: TestUser;
  authenticatedPage: Page;
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
});

export { expect } from '@playwright/test';
