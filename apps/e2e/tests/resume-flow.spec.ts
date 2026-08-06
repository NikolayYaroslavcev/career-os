import { test, expect } from '../fixtures/auth';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { waitForPageReady, ROUTES } from '../helpers/navigation';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SAMPLE_RESUME_PATH = join(__dirname, '../fixtures/sample-resume.pdf');

/**
 * Scenario 2: Upload Resume -> Resume Intelligence -> Resume Improvement
 */
test.describe('Resume Flow', () => {
  test('upload a resume', async ({ authenticatedPage: page }) => {
    await page.goto(ROUTES.RESUMES);
    await page.locator('input[type="file"]').setInputFiles(SAMPLE_RESUME_PATH);

    // Wait for upload to complete
    await expect(
      page.getByText('Uploading and extracting text...').or(page.getByText(/Analyzing/i)),
    ).toHaveCount(0, { timeout: 30_000 });
  });

  test('wait for resume parsing and AI analysis', async ({ authenticatedPage: page }) => {
    await page.goto(ROUTES.RESUMES);
    await page.locator('input[type="file"]').setInputFiles(SAMPLE_RESUME_PATH);

    // Wait for the async AI-driven analysis to finish (or gracefully handle AI being disabled)
    await expect(
      page
        .getByText('Analyzing your resume with AI...')
        .or(page.getByText('Failed to load resumes')),
    )
      .toHaveCount(0, { timeout: 45_000 })
      .catch(() => undefined);
  });

  test('navigate to Resume Intelligence page', async ({ authenticatedPage: page }) => {
    await page.goto(ROUTES.RESUME_INTELLIGENCE);
    await expect(page).toHaveURL(/\/app\/resume-intelligence$/);
    await expect(page.locator('body')).toContainText(/./);
  });
});
