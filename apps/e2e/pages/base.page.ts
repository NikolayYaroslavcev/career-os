import { type Page, expect } from '@playwright/test';

/**
 * Base page object with common patterns shared across all pages.
 */
export class BasePage {
  constructor(protected page: Page) {}

  /**
   * Wait for any loading indicators to disappear.
   */
  async waitForLoad(timeout = 15_000): Promise<void> {
    await this.page
      .getByText(/Loading|Analyzing|Uploading/i)
      .waitFor({ state: 'hidden', timeout })
      .catch(() => undefined);
  }

  /**
   * Verify the current URL matches the expected path.
   */
  async expectUrl(path: string | RegExp): Promise<void> {
    await expect(this.page).toHaveURL(path);
  }

  /**
   * Verify no fatal error is displayed.
   */
  async expectNoError(): Promise<void> {
    const errorTexts = [
      'Failed to load',
      'Something went wrong',
      'An error occurred',
    ];
    for (const text of errorTexts) {
      await expect(this.page.getByText(text)).toHaveCount(0);
    }
  }
}
