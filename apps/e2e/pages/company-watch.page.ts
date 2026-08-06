import { type Page, expect } from '@playwright/test';
import { ROUTES } from '../helpers/navigation';

/**
 * Page object for the Company Watch page (/app/company-watch).
 * Encapsulates company management flows.
 */
export class CompanyWatchPage {
  constructor(private page: Page) {}

  async goto(): Promise<void> {
    await this.page.goto(ROUTES.COMPANY_WATCH);
  }

  async openAddDialog(): Promise<void> {
    await this.page
      .getByRole('button', { name: /Add Company|Добавить компанию/i })
      .click();
    await expect(this.page.getByRole('dialog')).toBeVisible();
  }

  async addCompany(name: string, careerUrl: string): Promise<void> {
    await this.openAddDialog();
    await this.page.getByLabel(/Company name|Название компании/i).fill(name);
    await this.page
      .getByLabel(/Career URL|Ссылка на страницу вакансий/i)
      .fill(careerUrl);
    await this.page.getByRole('button', { name: /Add|Добавить/i }).last().click();
    await expect(this.page.getByText(name)).toBeVisible({ timeout: 15_000 });
  }

  async syncFirstCompany(): Promise<boolean> {
    const syncButton = this.page
      .getByRole('button', { name: /Sync|Синхронизировать/i })
      .first();
    if ((await syncButton.count()) === 0) {
      return false;
    }
    await syncButton.click();
    await expect(this.page.locator('.animate-spin')).toHaveCount(0, {
      timeout: 30_000,
    });
    return true;
  }
}
