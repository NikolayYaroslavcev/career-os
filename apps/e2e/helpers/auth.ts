import { type Page, type BrowserContext, expect } from '@playwright/test';
import type { TestUser } from '../factories/user';

const BASE_URL = process.env.E2E_BASE_URL ?? 'http://localhost:3001';

/**
 * Register a new user via the UI. Assumes the user is on / or can navigate to /register.
 * Returns after the redirect to /app.
 * Supports both English and Russian locales.
 */
export async function registerUser(page: Page, user: TestUser): Promise<void> {
  await page.goto('/register');
  await page.getByLabel(/First name|Имя/i).fill(user.firstName);
  await page.getByLabel(/Last name|Фамилия/i).fill(user.lastName);
  await page.getByLabel(/Email/i).fill(user.email);
  await page.getByLabel(/^Password$|^Пароль$/i).fill(user.password);
  await page.getByLabel(/Confirm password|Подтверждение пароля/i).fill(user.password);
  await page.getByRole('button', { name: /Create account|Создать аккаунт/i }).click();
  await expect(page).toHaveURL(/\/app$/);
}

/**
 * Login via the UI. Navigates to /login and submits credentials.
 * Supports both English and Russian locales.
 */
export async function loginUser(page: Page, user: TestUser): Promise<void> {
  await page.goto('/login');
  await page.getByLabel(/Email/i).fill(user.email);
  await page.getByLabel(/^Password$|^Пароль$/i).fill(user.password);
  await page.getByRole('button', { name: /Sign in|Войти/i }).click();
  await expect(page).toHaveURL(/\/app$/);
}

/**
 * Logout via the UI. Clicks the logout button in the app shell.
 * Supports both English and Russian locales.
 */
export async function logoutUser(page: Page): Promise<void> {
  await page.getByRole('button', { name: /Log out|Выйти/i }).click();
  await expect(page).toHaveURL(/\/login$/);
}

/**
 * Full auth setup: register, then log out and log back in.
 * This exercises both registration and login paths and leaves the user
 * authenticated on /app.
 */
export async function setupAuthenticatedUser(page: Page, user: TestUser): Promise<void> {
  await registerUser(page, user);
  await logoutUser(page);
  await loginUser(page, user);
}

/**
 * Save authentication state (cookies + localStorage) to a file.
 * Used with Playwright's storageState for shared auth across tests.
 */
export async function saveAuthState(context: BrowserContext, path: string): Promise<void> {
  await context.storageState({ path });
}

/**
 * Verify the user is on the dashboard (authenticated).
 */
export async function expectOnDashboard(page: Page): Promise<void> {
  await expect(page).toHaveURL(/\/app$/);
}

/**
 * Verify session persists across reload.
 */
export async function expectSessionPersists(page: Page, email: string): Promise<void> {
  await page.reload();
  await expect(page).toHaveURL(/\/app$/);
  await expect(page.getByText(email).first()).toBeVisible();
}
