import { test, expect } from '../fixtures/auth';
import { ROUTES } from '../helpers/navigation';

/**
 * Scenario: Provider Settings
 */
test.describe('Provider Settings', () => {
  test('navigate to provider settings page', async ({ authenticatedPage: page }) => {
    await page.goto(ROUTES.PROVIDERS);
    await expect(page).toHaveURL(ROUTES.PROVIDERS);
    await expect(page.getByRole('heading', { name: /Provider Settings|Настройки источников/i }).first()).toBeVisible();
  });

  test('display provider tabs', async ({ authenticatedPage: page }) => {
    await page.goto(ROUTES.PROVIDERS);

    // Wait for page to load
    await page
      .getByText(/Loading|Загрузка/i)
      .waitFor({ state: 'hidden', timeout: 15_000 })
      .catch(() => undefined);

    // Should show Providers and Telegram Channels tabs
    await expect(page.getByRole('button', { name: /Providers \(|Источники \(/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Telegram Channels|Каналы Telegram/i })).toBeVisible();
  });

  test('display provider cards with status', async ({ authenticatedPage: page }) => {
    await page.goto(ROUTES.PROVIDERS);

    await page
      .getByText(/Loading|Загрузка/i)
      .waitFor({ state: 'hidden', timeout: 15_000 })
      .catch(() => undefined);

    // Check if there are provider cards or empty state
    const providerCards = page.locator('[class*="card"]');
    const hasCards = (await providerCards.count()) > 0;
    const hasEmptyState = (await page.getByText(/No providers|Нет источников/i).count()) > 0;

    expect(hasCards || hasEmptyState).toBe(true);
  });

  test('toggle provider enabled/disabled', async ({ authenticatedPage: page }) => {
    await page.goto(ROUTES.PROVIDERS);

    await page
      .getByText(/Loading|Загрузка/i)
      .waitFor({ state: 'hidden', timeout: 15_000 })
      .catch(() => undefined);

    const toggleButton = page.getByRole('button', { name: /Enable|Disable|Включить|Отключить/i }).first();
    if ((await toggleButton.count()) === 0) {
      test.skip(true, 'No toggle buttons available');
      return;
    }

    await toggleButton.click();
    await page.waitForTimeout(1000);
  });

  test('sync a provider', async ({ authenticatedPage: page }) => {
    await page.goto(ROUTES.PROVIDERS);

    await page
      .getByText(/Loading|Загрузка/i)
      .waitFor({ state: 'hidden', timeout: 15_000 })
      .catch(() => undefined);

    // Find a sync button that is not disabled
    const syncButtons = page.getByRole('button').filter({ has: page.locator('[class*="lucide-zap"]') });
    const count = await syncButtons.count();
    let enabledSyncButton = null;

    for (let i = 0; i < count; i++) {
      const btn = syncButtons.nth(i);
      if (await btn.isEnabled()) {
        enabledSyncButton = btn;
        break;
      }
    }

    if (!enabledSyncButton) {
      test.skip(true, 'No enabled sync buttons available');
      return;
    }

    await enabledSyncButton.click();
    await page.waitForTimeout(2000);
  });

  test('switch between Providers and Telegram tabs', async ({ authenticatedPage: page }) => {
    await page.goto(ROUTES.PROVIDERS);

    await page
      .getByText(/Loading|Загрузка/i)
      .waitFor({ state: 'hidden', timeout: 15_000 })
      .catch(() => undefined);

    // Click Telegram tab
    const telegramTab = page.getByRole('button', { name: /Telegram Channels|Каналы Telegram/i });
    await telegramTab.click();

    // Verify tab is clickable and page doesn't crash
    await page.waitForTimeout(500);

    // Switch back to Providers tab
    await page.getByRole('button', { name: /Providers \(|Источники \(/i }).click();
    await page.waitForTimeout(500);
  });
});
