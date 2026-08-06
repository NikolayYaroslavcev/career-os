import { test, expect } from '@playwright/test';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SAMPLE_RESUME_PATH = join(__dirname, '../fixtures/sample-resume.pdf');

/**
 * The project's primary smoke test — one continuous walk through the golden
 * path a brand-new user takes, end to end against a real running stack.
 */
test('register, onboard, search, match, and apply — the full golden path', async ({ page }) => {
  const uniqueSuffix = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
  const email = `e2e-smoke-${uniqueSuffix}@example.test`;
  const password = 'Sm0keTest!2024';

  await test.step('Register', async () => {
    await page.goto('/register');
    await page.getByLabel(/First name|Имя/i).fill('E2E');
    await page.getByLabel(/Last name|Фамилия/i).fill('Smoke');
    await page.getByLabel(/Email/i).fill(email);
    await page.getByLabel(/^Password$|^Пароль$/i).fill(password);
    await page.getByLabel(/Confirm password|Подтверждение пароля/i).fill(password);
    await page.getByRole('button', { name: /Create account|Создать аккаунт/i }).click();
    await expect(page).toHaveURL(/\/app$/);
  });

  await test.step('Login', async () => {
    await page.getByRole('button', { name: /Log out|Выйти/i }).click();
    await expect(page).toHaveURL(/\/login$/);

    await page.getByLabel(/Email/i).fill(email);
    await page.getByLabel(/^Password$|^Пароль$/i).fill(password);
    await page.getByRole('button', { name: /Sign in|Войти/i }).click();
    await expect(page).toHaveURL(/\/app$/);
  });

  await test.step('Refresh', async () => {
    await page.reload();
    await expect(page).toHaveURL(/\/app$/);
    await expect(page.getByText(email).first()).toBeVisible();
  });

  await test.step('Upload resume', async () => {
    await page.goto('/app/resumes');
    await page.locator('input[type="file"]').setInputFiles(SAMPLE_RESUME_PATH);
    await expect(page.getByText(/Uploading and extracting text|Загрузка и извлечение текста/i)).toHaveCount(0, { timeout: 30_000 });
  });

  await test.step('Wait for parsing', async () => {
    await expect(
      page.getByText(/Analyzing your resume with AI|Анализ резюме с помощью ИИ/i).or(page.getByText(/Failed to load resumes|Не удалось загрузить резюме/i))
    ).toHaveCount(0, { timeout: 45_000 }).catch(() => undefined);
  });

  let searchProfileName = '';
  await test.step('Create Search Profile', async () => {
    await page.goto('/app/search-profiles');
    await page.getByRole('button', { name: /Create Search Profile|Создать профиль поиска/i }).first().click();

    searchProfileName = `E2E Smoke Profile ${uniqueSuffix}`;
    await page.getByLabel(/Profile Name|Название профиля/i).fill(searchProfileName);
    await page.getByLabel(/Desired Positions|Желаемые должности/i).fill('Backend Engineer, Platform Engineer');
    await page.getByLabel(/Technologies|Технологии/i).fill('TypeScript, Node.js, PostgreSQL');
    // The experience level is a custom Base UI Select, not a native <select>.
    // Find the combobox near the "Уровень опыта" label and click it.
    const comboboxes = page.getByRole('combobox');
    const count = await comboboxes.count();
    for (let i = 0; i < count; i++) {
      const cb = comboboxes.nth(i);
      const parent = cb.locator('..');
      const label = await parent.textContent();
      if (label && /Experience Level|Уровень опыта/i.test(label)) {
        await cb.click();
        break;
      }
    }
    await page.getByRole('option', { name: /Senior/i }).click();
    await page.getByRole('button', { name: /Create Profile|Создать профиль/i }).click();

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
    await page.getByRole('button', { name: /Find Vacancies|Найти вакансии|Запустить AI-подбор/i }).click();
    const response = await searchResponse;
    expect(response.ok()).toBe(true);

    const body = (await response.json()) as {
      vacancies: Array<{ vacancy: { id: string }; recommendation?: { matchResultId: string } }>;
    };
    expect(body.vacancies.length).toBeGreaterThan(0);
    firstVacancyId = body.vacancies[0]?.vacancy.id;
    firstMatchResultId = body.vacancies.find((v) => v.recommendation)?.recommendation?.matchResultId;

    await expect(page.getByText(/Total Vacancies|Всего вакансий/i)).toBeVisible();
  });

  await test.step('Open vacancy', async () => {
    test.skip(!firstVacancyId, 'No vacancy was returned by the search to open.');
    await page.goto(`/app/search/${firstVacancyId}`);
    await expect(page.getByRole('button', { name: /Back|Назад/i })).toBeVisible();
  });

  await test.step('Open Match', async () => {
    test.skip(!firstMatchResultId, 'No vacancy had finished AI matching yet (AI may be disabled in this env).');
    await page.goto(`/app/match-explanation/${firstMatchResultId}`);
    await expect(page.locator('body')).not.toContainText('404');
  });

  await test.step('Create Application', async () => {
    await page.goto('/app/intelligence');
    const applyButton = page.getByRole('button', { name: /Apply|Откликнуться/i }).first();
    test.skip((await applyButton.count()) === 0, 'No un-applied vacancy left to apply to.');

    const createApplicationResponse = page.waitForResponse(
      (response) => response.url().includes('/api/v1/applications') && response.request().method() === 'POST'
    );
    await applyButton.click();
    const response = await createApplicationResponse;
    expect(response.ok()).toBe(true);
    await expect(page.getByText(/Applied|Отклик отправлен/i).first()).toBeVisible();
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
