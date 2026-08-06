import { type Page, expect } from '@playwright/test';
import { BasePage } from './base.page';
import { ROUTES } from '../helpers/navigation';

/**
 * Page object for the Provider Settings page (/app/settings/providers).
 */
export class ProvidersPage extends BasePage {
  constructor(page: Page) {
    super(page);
  }

  async goto(): Promise<void> {
    await this.page.goto(ROUTES.PROVIDERS);
  }

  async waitForDataLoad(): Promise<void> {
    await expect(this.page.getByText('Total Providers')).toBeVisible({ timeout: 15_000 });
  }

  async expectStatsVisible(): Promise<void> {
    await expect(this.page.getByText('Total Providers')).toBeVisible();
    await expect(this.page.getByText('Enabled')).toBeVisible();
    await expect(this.page.getByText('Disabled')).toBeVisible();
  }

  async switchToTelegramTab(): Promise<void> {
    await this.page.getByRole('button', { name: /Telegram Channels/i }).click();
  }

  async switchToProvidersTab(): Promise<void> {
    await this.page.getByRole('button', { name: /Providers \(/i }).click();
  }

  async toggleFirstProvider(): Promise<boolean> {
    const toggleButton = this.page.getByRole('button', { name: /Enable|Disable/i }).first();
    if ((await toggleButton.count()) === 0) {
      return false;
    }
    await toggleButton.click();
    await this.page.waitForTimeout(1000);
    return true;
  }
}
