import { test, expect } from '../fixtures/auth';
import { createSearchProfile, uniqueSuffix } from '../factories/user';
import { ROUTES } from '../helpers/navigation';

/**
 * Scenario 3: Create Search Profile -> Search Vacancies
 */
test.describe('Job Search Flow', () => {
  test('create a search profile', async ({ authenticatedPage: page }) => {
    const suffix = uniqueSuffix();
    const profile = createSearchProfile(suffix);

    await page.goto(ROUTES.SEARCH_PROFILES);

    await page
      .getByText(/Loading|Загрузка/i)
      .waitFor({ state: 'hidden', timeout: 15_000 })
      .catch(() => undefined);

    await page.getByRole('button', { name: /Create Search Profile|Создать профиль поиска/i }).first().click();

    await page.getByLabel(/Profile Name|Название профиля/i).fill(profile.name);
    await page.getByLabel(/Desired Positions|Желаемые должности/i).fill(profile.desiredPositions);
    await page.getByLabel(/Technologies|Технологии/i).fill(profile.technologies);

    // The experience level is a custom Base UI Select, not a native <select>.
    // Click the combobox to open the dropdown, then click the option.
    const experienceCombobox = page.getByRole('combobox', { name: /Experience Level|Уровень опыта/i });
    if ((await experienceCombobox.count()) === 0) {
      // Fallback: find the combobox near the "Уровень опыта" label
      const comboboxes = page.getByRole('combobox');
      const count = await comboboxes.count();
      // The experience level combobox is typically the first one in the form
      // (language selector is in the header, not in the form)
      for (let i = 0; i < count; i++) {
        const cb = comboboxes.nth(i);
        const parent = cb.locator('..');
        const label = await parent.textContent();
        if (label && /Experience Level|Уровень опыта/i.test(label)) {
          await cb.click();
          break;
        }
      }
    } else {
      await experienceCombobox.click();
    }

    // Select the option from the dropdown
    await page.getByRole('option', { name: /Senior/i }).click();

    await page.getByRole('button', { name: /Create Profile|Создать профиль/i }).click();

    await expect(page.getByText(profile.name)).toBeVisible({ timeout: 15_000 });
  });

  test('intelligence page shows search profile prompt for new user', async ({ authenticatedPage: page }) => {
    await page.goto(ROUTES.INTELLIGENCE);

    await page
      .getByText(/Loading|Загрузка/i)
      .waitFor({ state: 'hidden', timeout: 15_000 })
      .catch(() => undefined);

    const hasFindButton = (await page.getByRole('button', { name: /Find Vacancies|Найти вакансии|Запустить AI-подбор/i }).count()) > 0;
    const hasCreateProfilePrompt = (await page.getByText(/Создайте профиль поиска|Create a search profile/i).count()) > 0;

    expect(hasFindButton || hasCreateProfilePrompt).toBe(true);
  });

  test('search profiles page loads and shows content', async ({ authenticatedPage: page }) => {
    await page.goto(ROUTES.SEARCH_PROFILES);

    await page
      .getByText(/Loading|Загрузка/i)
      .waitFor({ state: 'hidden', timeout: 15_000 })
      .catch(() => undefined);

    await expect(page.getByRole('heading', { name: /Профили поиска|Search Profiles/i }).first()).toBeVisible();
  });

  test('applications page loads', async ({ authenticatedPage: page }) => {
    await page.goto(ROUTES.APPLICATIONS);

    await page
      .getByText(/Loading|Загрузка/i)
      .waitFor({ state: 'hidden', timeout: 15_000 })
      .catch(() => undefined);

    await expect(page.getByRole('heading', { name: /Отклики|Applications/i }).first()).toBeVisible();
  });
});
