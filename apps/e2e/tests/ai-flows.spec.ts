import { test, expect } from '../fixtures/auth';
import { ROUTES } from '../helpers/navigation';

/**
 * Scenario: AI Flows
 * Validates UI flows, requests, responses, loading, errors.
 * Does NOT validate LLM content.
 */
test.describe('AI Flows', () => {
  test('navigate to AI Dashboard page', async ({ authenticatedPage: page }) => {
    await page.goto(ROUTES.AI_DASHBOARD);
    await expect(page).toHaveURL(ROUTES.AI_DASHBOARD);
  });

  test('AI Dashboard loads without error', async ({ authenticatedPage: page }) => {
    await page.goto(ROUTES.AI_DASHBOARD);

    await page
      .getByText(/Loading|Загрузка/i)
      .waitFor({ state: 'hidden', timeout: 15_000 })
      .catch(() => undefined);

    await expect(page.getByText(/Failed to load|Не удалось загрузить/i)).toHaveCount(0);
  });

  test('navigate to Resume Intelligence page', async ({ authenticatedPage: page }) => {
    await page.goto(ROUTES.RESUME_INTELLIGENCE);
    await expect(page).toHaveURL(/\/app\/resume-intelligence$/);
  });

  test('navigate to Career Intelligence page', async ({ authenticatedPage: page }) => {
    await page.goto(ROUTES.CAREER_INTELLIGENCE);
    await expect(page).toHaveURL(/\/app\/career-intelligence$/);
  });

  test('intelligence page shows search profile prompt when no profile exists', async ({ authenticatedPage: page }) => {
    await page.goto(ROUTES.INTELLIGENCE);

    await page
      .getByText(/Loading|Загрузка/i)
      .waitFor({ state: 'hidden', timeout: 15_000 })
      .catch(() => undefined);

    const hasFindButton = (await page.getByRole('button', { name: /Find Vacancies|Найти вакансии|Запустить AI-подбор/i }).count()) > 0;
    const hasCreateProfilePrompt = (await page.getByText(/Создайте профиль поиска|Create a search profile/i).count()) > 0;

    expect(hasFindButton || hasCreateProfilePrompt).toBe(true);
  });

  test('intelligence page loads and shows content', async ({ authenticatedPage: page }) => {
    await page.goto(ROUTES.INTELLIGENCE);

    await page
      .getByText(/Loading|Загрузка/i)
      .waitFor({ state: 'hidden', timeout: 15_000 })
      .catch(() => undefined);

    // Use .first() to avoid strict mode violation (multiple h2 headings)
    await expect(page.getByRole('heading', { name: /AI-подбор вакансий|AI Job Matching/i }).first()).toBeVisible();
  });
});
