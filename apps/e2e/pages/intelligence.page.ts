import { type Page, expect } from '@playwright/test';
import { waitForApiResponse, API_ENDPOINTS } from '../helpers/api';
import { ROUTES } from '../helpers/navigation';

/**
 * Page object for the Intelligence page (/app/intelligence).
 * Encapsulates the common search -> get results -> apply flow.
 */
export class IntelligencePage {
  constructor(private page: Page) {}

  async goto(): Promise<void> {
    await this.page.goto(ROUTES.INTELLIGENCE);
  }

  async searchVacancies(): Promise<{
    vacancies: Array<{ vacancy: { id: string }; recommendation?: { matchResultId: string } }>;
  }> {
    const searchResponse = waitForApiResponse(
      this.page,
      API_ENDPOINTS.INTELLIGENCE_SEARCH,
      'POST',
    );
    await this.page.getByRole('button', { name: /Find Vacancies|Найти вакансии/i }).click();
    const response = await searchResponse;
    expect(response.ok()).toBe(true);
    return response.json() as Promise<{
      vacancies: Array<{ vacancy: { id: string }; recommendation?: { matchResultId: string } }>;
    }>;
  }

  async expectResultsVisible(): Promise<void> {
    await expect(this.page.getByText(/Total Vacancies|Всего вакансий/i)).toBeVisible();
  }

  async openVacancy(vacancyId: string): Promise<void> {
    await this.page.goto(`${ROUTES.SEARCH}/${vacancyId}`);
    await expect(this.page.getByRole('button', { name: /Back|Назад/i })).toBeVisible();
  }

  async applyToFirstVacancy(): Promise<boolean> {
    const applyButton = this.page.getByRole('button', { name: /Apply|Откликнуться/i }).first();
    if ((await applyButton.count()) === 0) {
      return false;
    }

    const createResponse = waitForApiResponse(this.page, API_ENDPOINTS.APPLICATIONS, 'POST');
    await applyButton.click();
    const response = await createResponse;
    expect(response.ok()).toBe(true);
    await expect(this.page.getByText(/Applied|Отклик отправлен/i).first()).toBeVisible();
    return true;
  }
}
