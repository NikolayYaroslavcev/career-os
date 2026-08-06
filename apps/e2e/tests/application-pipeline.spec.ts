import { test, expect } from '../fixtures/auth';
import { ROUTES } from '../helpers/navigation';

/**
 * Scenario 4: Application Pipeline
 */
test.describe('Application Pipeline', () => {
  test('navigate to applications page', async ({ authenticatedPage: page }) => {
    await page.goto(ROUTES.APPLICATIONS);
    await expect(page).toHaveURL(ROUTES.APPLICATIONS);
  });

  test('navigate to follow-ups page', async ({ authenticatedPage: page }) => {
    await page.goto(ROUTES.FOLLOW_UPS);
    await expect(page).toHaveURL(ROUTES.FOLLOW_UPS);
  });

  test('applications page loads and shows content', async ({ authenticatedPage: page }) => {
    await page.goto(ROUTES.APPLICATIONS);

    await page
      .getByText(/Loading|Загрузка/i)
      .waitFor({ state: 'hidden', timeout: 15_000 })
      .catch(() => undefined);

    // Use .first() to avoid strict mode violation
    await expect(page.getByRole('heading', { name: /Отклики|Applications/i }).first()).toBeVisible();
  });

  test('follow-ups page loads and shows content', async ({ authenticatedPage: page }) => {
    await page.goto(ROUTES.FOLLOW_UPS);

    await page
      .getByText(/Loading|Загрузка/i)
      .waitFor({ state: 'hidden', timeout: 15_000 })
      .catch(() => undefined);

    // Use .first() to avoid strict mode violation
    await expect(page.getByRole('heading', { name: /Напоминания|Follow-ups/i }).first()).toBeVisible();
  });

  test('view Career Intelligence page', async ({ authenticatedPage: page }) => {
    await page.goto(ROUTES.CAREER_INTELLIGENCE);
    await expect(page).toHaveURL(/\/app\/career-intelligence$/);
  });
});
