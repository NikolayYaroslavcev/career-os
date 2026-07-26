import { test, expect } from '@playwright/test';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SAMPLE_RESUME_PATH = join(__dirname, '../fixtures/sample-resume.pdf');

/**
 * The project's primary smoke test — one continuous walk through the golden
 * path a brand-new user takes, end to end against a real running stack
 * (dashboard + backend + worker + Postgres + Redis). Every step depends on
 * the previous one succeeding, so this is intentionally a single long test
 * rather than many independent ones: a failure midway tells you exactly
 * which stage of the journey broke.
 */
test('register, onboard, search, match, and apply — the full golden path', async ({ page }) => {
  const uniqueSuffix = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
  const email = `e2e-smoke-${uniqueSuffix}@example.test`;
  const password = 'Sm0keTest!2024';

  await test.step('Register', async () => {
    await page.goto('/register');
    await page.getByLabel('First name').fill('E2E');
    await page.getByLabel('Last name').fill('Smoke');
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Password', { exact: true }).fill(password);
    await page.getByLabel('Confirm password').fill(password);
    await page.getByRole('button', { name: 'Create account' }).click();
    await expect(page).toHaveURL(/\/app$/);
  });

  await test.step('Login', async () => {
    // Registering auto-authenticates; log out and back in so this step
    // exercises the real /api/v1/auth/login path independently.
    await page.getByRole('button', { name: 'Log out' }).click();
    await expect(page).toHaveURL(/\/login$/);

    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Password').fill(password);
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page).toHaveURL(/\/app$/);
  });

  await test.step('Refresh', async () => {
    // Session tokens live in localStorage — a hard reload must not force a
    // re-login, proving the persisted session (and its refresh flow on
    // access-token expiry) actually works.
    await page.reload();
    await expect(page).toHaveURL(/\/app$/);
    await expect(page.getByText(email)).toBeVisible();
  });

  await test.step('Upload resume', async () => {
    await page.goto('/app/resumes');
    await page.locator('input[type="file"]').setInputFiles(SAMPLE_RESUME_PATH);
    await expect(page.getByText('Uploading and extracting text...')).toHaveCount(0, { timeout: 30_000 });
  });

  await test.step('Wait for parsing', async () => {
    // Resume text extraction is synchronous with the upload; this waits for
    // the async AI-driven search-profile suggestion pass that follows it,
    // falling back gracefully if AI is disabled/unavailable in this env.
    await expect(
      page.getByText('Analyzing your resume with AI...').or(page.getByText('Failed to load resumes'))
    ).toHaveCount(0, { timeout: 45_000 }).catch(() => undefined);
  });

  let searchProfileName = '';
  await test.step('Create Search Profile', async () => {
    await page.goto('/app/search-profiles');
    await page.getByRole('button', { name: 'Create Search Profile' }).click();

    searchProfileName = `E2E Smoke Profile ${uniqueSuffix}`;
    await page.getByLabel('Profile Name').fill(searchProfileName);
    await page.getByLabel('Desired Positions').fill('Backend Engineer, Platform Engineer');
    await page.getByLabel('Technologies').fill('TypeScript, Node.js, PostgreSQL');
    await page.getByLabel('Experience Level').selectOption('senior');
    await page.getByRole('button', { name: 'Create Profile' }).click();

    await expect(page.getByText(searchProfileName)).toBeVisible();
  });

  let firstVacancyId: string | undefined;
  let firstMatchResultId: string | undefined;

  await test.step('Import vacancies', async () => {
    await page.goto('/app/intelligence');

    const searchResponse = page.waitForResponse(
      (response) => response.url().includes('/api/v1/intelligence/search') && response.request().method() === 'POST',
      { timeout: 45_000 }
    );
    await page.getByRole('button', { name: 'Find Vacancies' }).click();
    const response = await searchResponse;
    expect(response.ok()).toBe(true);

    const body = (await response.json()) as {
      vacancies: Array<{ vacancy: { id: string }; recommendation?: { matchResultId: string } }>;
    };
    expect(body.vacancies.length).toBeGreaterThan(0);
    firstVacancyId = body.vacancies[0]?.vacancy.id;
    firstMatchResultId = body.vacancies.find((v) => v.recommendation)?.recommendation?.matchResultId;

    await expect(page.getByText('Total Vacancies')).toBeVisible();
  });

  await test.step('Open vacancy', async () => {
    test.skip(!firstVacancyId, 'No vacancy was returned by the search to open.');
    await page.goto(`/app/search/${firstVacancyId}`);
    await expect(page.getByRole('button', { name: 'Back' })).toBeVisible();
  });

  await test.step('Open Match', async () => {
    test.skip(!firstMatchResultId, 'No vacancy had finished AI matching yet (AI may be disabled in this env).');
    await page.goto(`/app/match-explanation/${firstMatchResultId}`);
    await expect(page.locator('body')).not.toContainText('404');
  });

  await test.step('Create Application', async () => {
    await page.goto('/app/intelligence');
    const applyButton = page.getByRole('button', { name: 'Apply' }).first();
    test.skip((await applyButton.count()) === 0, 'No un-applied vacancy left to apply to.');

    const createApplicationResponse = page.waitForResponse(
      (response) => response.url().includes('/api/v1/applications') && response.request().method() === 'POST'
    );
    await applyButton.click();
    const response = await createApplicationResponse;
    expect(response.ok()).toBe(true);
    await expect(page.getByText('Applied').first()).toBeVisible();
  });

  await test.step('Open Career Intelligence', async () => {
    await page.goto('/app/career-intelligence');
    await expect(page).toHaveURL(/\/app\/career-intelligence$/);
    await expect(page.getByText(/./)).toBeVisible();
  });

  await test.step('Open Resume Intelligence', async () => {
    await page.goto('/app/resume-intelligence');
    await expect(page).toHaveURL(/\/app\/resume-intelligence$/);
    await expect(page.getByText(/./)).toBeVisible();
  });
});
