import { type Page, type Route } from '@playwright/test';

/**
 * Wait for an API response matching the given URL pattern and method.
 * Returns the response object for assertions.
 */
export async function waitForApiResponse(
  page: Page,
  urlPattern: string | RegExp,
  method = 'POST',
  timeout = 45_000,
) {
  return page.waitForResponse(
    (response) => {
      const urlMatch =
        typeof urlPattern === 'string'
          ? response.url().includes(urlPattern)
          : urlPattern.test(response.url());
      return urlMatch && response.request().method() === method;
    },
    { timeout },
  );
}

/**
 * Common API endpoint patterns used across tests.
 */
export const API_ENDPOINTS = {
  AUTH_LOGIN: '/api/v1/auth/login',
  AUTH_REGISTER: '/api/v1/auth/register',
  AUTH_LOGOUT: '/api/v1/auth/logout',
  RESUMES: '/api/v1/resumes',
  SEARCH_PROFILES: '/api/v1/search-profiles',
  INTELLIGENCE_SEARCH: '/api/v1/intelligence/search',
  APPLICATIONS: '/api/v1/applications',
  COMPANIES: '/api/v1/companies',
  PROVIDERS: '/api/v1/providers',
  TELEGRAM: '/api/v1/telegram',
} as const;
