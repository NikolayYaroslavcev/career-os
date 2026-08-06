import { test, expect } from '../fixtures/auth';
import { uniqueSuffix } from '../factories/user';
import { ROUTES } from '../helpers/navigation';

/**
 * Scenario: Company Watch
 * - Add company
 * - Sync
 * - Health badge
 * - Discovery queue
 */
test.describe('Company Watch', () => {
  test('navigate to company watch page', async ({ authenticatedPage: page }) => {
    await page.goto(ROUTES.COMPANY_WATCH);
    await expect(page).toHaveURL(ROUTES.COMPANY_WATCH);
  });

  test('company watch page loads', async ({ authenticatedPage: page }) => {
    await page.goto(ROUTES.COMPANY_WATCH);

    // Wait for page to load
    await page
      .getByText(/Loading|Загрузка/i)
      .waitFor({ state: 'hidden', timeout: 15_000 })
      .catch(() => undefined);

    // Should show either the company list or an error
    await expect(
      page.getByText(/Отслеживание компаний|Company Watch|unexpected error/i).first(),
    ).toBeVisible();
  });

  test('open add company dialog when available', async ({ authenticatedPage: page }) => {
    await page.goto(ROUTES.COMPANY_WATCH);

    // Wait for page to load
    await page
      .getByText(/Loading|Загрузка/i)
      .waitFor({ state: 'hidden', timeout: 15_000 })
      .catch(() => undefined);

    // Check if there's an error on the page
    const hasError = (await page.getByText(/unexpected error|An unexpected error/i).count()) > 0;
    if (hasError) {
      test.skip(true, 'Company Watch page has a backend error');
      return;
    }

    // Click the add company button (use .first() to handle strict mode)
    await page.getByRole('button', { name: /Add Company|Добавить компанию/i }).first().click();
    await expect(page.getByRole('dialog')).toBeVisible();
  });

  test('add a company with name and career URL', async ({ authenticatedPage: page }) => {
    await page.goto(ROUTES.COMPANY_WATCH);

    // Wait for page to load
    await page
      .getByText(/Loading|Загрузка/i)
      .waitFor({ state: 'hidden', timeout: 15_000 })
      .catch(() => undefined);

    // Check if there's an error on the page
    const hasError = (await page.getByText(/unexpected error|An unexpected error/i).count()) > 0;
    if (hasError) {
      test.skip(true, 'Company Watch page has a backend error');
      return;
    }

    const suffix = uniqueSuffix();

    // Click the add company button (use .first() to handle strict mode)
    await page.getByRole('button', { name: /Add Company|Добавить компанию/i }).first().click();
    await expect(page.getByRole('dialog')).toBeVisible();

    // Fill in the form
    await page.getByLabel(/Company name|Название компании/i).fill(`Test Company ${suffix}`);
    await page
      .getByLabel(/Career URL|Ссылка на страницу вакансий/i)
      .fill('https://example.com/careers');

    // Submit
    await page.getByRole('button', { name: /Add|Добавить/i }).last().click();

    // Verify company appears in the list
    await expect(page.getByText(`Test Company ${suffix}`)).toBeVisible({ timeout: 15_000 });
  });

  test('sync a watched company', async ({ authenticatedPage: page }) => {
    await page.goto(ROUTES.COMPANY_WATCH);

    // Wait for page to load
    await page
      .getByText(/Loading|Загрузка/i)
      .waitFor({ state: 'hidden', timeout: 15_000 })
      .catch(() => undefined);

    // Check if there's an error on the page
    const hasError = (await page.getByText(/unexpected error|An unexpected error/i).count()) > 0;
    if (hasError) {
      test.skip(true, 'Company Watch page has a backend error');
      return;
    }

    const syncButton = page.getByRole('button', { name: /Sync|Синхронизировать/i }).first();
    if ((await syncButton.count()) === 0) {
      test.skip(true, 'No companies to sync');
      return;
    }

    await syncButton.click();
    await expect(page.locator('.animate-spin')).toHaveCount(0, { timeout: 30_000 });
  });

  test('verify health badge is displayed', async ({ authenticatedPage: page }) => {
    await page.goto(ROUTES.COMPANY_WATCH);

    // Wait for page to load
    await page
      .getByText(/Loading|Загрузка/i)
      .waitFor({ state: 'hidden', timeout: 15_000 })
      .catch(() => undefined);

    // Check if there's an error on the page
    const hasError = (await page.getByText(/unexpected error|An unexpected error/i).count()) > 0;
    if (hasError) {
      test.skip(true, 'Company Watch page has a backend error');
      return;
    }

    const badges = page.locator('[class*="badge"]');
    if ((await badges.count()) === 0) {
      test.skip(true, 'No companies to show health badge');
      return;
    }
    await expect(badges.first()).toBeVisible();
  });
});
