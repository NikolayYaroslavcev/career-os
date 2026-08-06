import { type Page, expect } from '@playwright/test';

/**
 * Navigate to a specific app route and verify the URL.
 */
export async function navigateTo(page: Page, path: string): Promise<void> {
  await page.goto(path);
  await expect(page).toHaveURL(path);
}

/**
 * Wait for any pending loading indicators to disappear.
 * Handles common loading patterns across the app.
 */
export async function waitForPageReady(page: Page, timeout = 30_000): Promise<void> {
  // Wait for common loading spinners to disappear
  await page
    .getByText(/Loading|Analyzing|Uploading/i)
    .waitFor({ state: 'hidden', timeout })
    .catch(() => undefined);
}

/**
 * Common app routes for navigation.
 */
export const ROUTES = {
  HOME: '/',
  LOGIN: '/login',
  REGISTER: '/register',
  DASHBOARD: '/app',
  RESUMES: '/app/resumes',
  SEARCH_PROFILES: '/app/search-profiles',
  INTELLIGENCE: '/app/intelligence',
  APPLICATIONS: '/app/applications',
  FOLLOW_UPS: '/app/follow-ups',
  CAREER_INTELLIGENCE: '/app/career-intelligence',
  RESUME_INTELLIGENCE: '/app/resume-intelligence',
  COMPANY_WATCH: '/app/company-watch',
  PROVIDERS: '/app/settings/providers',
  AI_DASHBOARD: '/app/ai',
  TELEGRAM: '/app/telegram',
  SYNC: '/app/sync',
  SETTINGS: '/app/settings',
  DIAGNOSTICS: '/app/diagnostics',
  SEARCH: '/app/search',
  RECOMMENDATIONS: '/app/recommendations',
} as const;
