import { type Page, expect } from '@playwright/test';
import { BasePage } from './base.page';
import { ROUTES } from '../helpers/navigation';

/**
 * Page object for the Telegram page (/app/telegram).
 */
export class TelegramPage extends BasePage {
  constructor(page: Page) {
    super(page);
  }

  async goto(): Promise<void> {
    await this.page.goto(ROUTES.TELEGRAM);
  }

  async waitForLoad(): Promise<void> {
    await super.waitForLoad();
  }

  async expectConnectionStatusVisible(): Promise<void> {
    await expect(
      this.page.getByText(/Connected|Not connected|Подключено|Не подключено/i).first(),
    ).toBeVisible();
  }

  async expectConnectionCardVisible(): Promise<void> {
    await expect(this.page.getByText(/Connection Status|Статус подключения/i)).toBeVisible();
  }

  async expectGenerateCodeButtonVisible(): Promise<void> {
    await expect(
      this.page.getByRole('button', { name: /Generate|Сгенерировать/i }),
    ).toBeVisible();
  }

  async isNotConnected(): Promise<boolean> {
    return (await this.page.getByText(/Not connected|Не подключено/i).count()) > 0;
  }
}
