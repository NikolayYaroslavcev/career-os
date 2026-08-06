import { type Page, expect } from '@playwright/test';
import { BasePage } from './base.page';
import { ROUTES } from '../helpers/navigation';

/**
 * Page object for the AI Dashboard page (/app/ai).
 */
export class AIDashboardPage extends BasePage {
  constructor(page: Page) {
    super(page);
  }

  async goto(): Promise<void> {
    await this.page.goto(ROUTES.AI_DASHBOARD);
  }

  async waitForLoad(): Promise<void> {
    await super.waitForLoad();
  }

  async expectNoFatalError(): Promise<void> {
    await expect(this.page.getByText('Failed to load AI dashboard data')).toHaveCount(0);
  }
}
