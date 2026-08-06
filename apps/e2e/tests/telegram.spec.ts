import { test, expect } from '../fixtures/auth';
import { ROUTES } from '../helpers/navigation';

/**
 * Scenario: Telegram
 * - Telegram page
 * - Connection flow
 * - Channel management (in provider settings)
 * - Statistics
 * - Sync page
 */
test.describe('Telegram', () => {
  test('navigate to Telegram page', async ({ authenticatedPage: page }) => {
    await page.goto(ROUTES.TELEGRAM);
    await expect(page).toHaveURL(ROUTES.TELEGRAM);
  });

  test('Telegram page shows connection status', async ({ authenticatedPage: page }) => {
    await page.goto(ROUTES.TELEGRAM);

    await page
      .getByText(/Loading|Загрузка/i)
      .waitFor({ state: 'hidden', timeout: 15_000 })
      .catch(() => undefined);

    await expect(
      page.getByText(/Connected|Not connected|Подключено|Не подключено/i).first(),
    ).toBeVisible();
  });

  test('Telegram page shows connection status card', async ({ authenticatedPage: page }) => {
    await page.goto(ROUTES.TELEGRAM);

    await page
      .getByText(/Loading|Загрузка/i)
      .waitFor({ state: 'hidden', timeout: 15_000 })
      .catch(() => undefined);

    await expect(page.getByText(/Connection Status|Статус подключения/i)).toBeVisible();
  });

  test('generate link code button is available when not connected', async ({ authenticatedPage: page }) => {
    await page.goto(ROUTES.TELEGRAM);

    await page
      .getByText(/Loading|Загрузка/i)
      .waitFor({ state: 'hidden', timeout: 15_000 })
      .catch(() => undefined);

    const notConnected = page.getByText(/Not connected|Не подключено/i);
    if ((await notConnected.count()) > 0) {
      await expect(
        page.getByRole('button', { name: /Generate|Сгенерировать/i }),
      ).toBeVisible();
    }
  });

  test('navigate to Sync page', async ({ authenticatedPage: page }) => {
    await page.goto(ROUTES.SYNC);
    await expect(page).toHaveURL(ROUTES.SYNC);
  });

  test('navigate to Telegram Channels in provider settings', async ({ authenticatedPage: page }) => {
    await page.goto(ROUTES.PROVIDERS);

    await expect(page.getByText(/Total Providers|Всего источников/i)).toBeVisible({ timeout: 15_000 });

    await page.getByRole('button', { name: /Telegram Channels|Каналы Telegram/i }).click();

    await expect(page.getByText(/No Telegram channels|Add Channel|Нет каналов|Добавить канал/i).first()).toBeVisible();
  });
});
