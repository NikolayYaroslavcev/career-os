import { test, expect } from '../fixtures/auth';
import { createUser } from '../factories/user';
import { registerUser, loginUser, logoutUser, expectOnDashboard, expectSessionPersists } from '../helpers/auth';

/**
 * Scenario 1: User Registration -> Login -> Dashboard -> Logout
 *
 * Tests the complete authentication lifecycle as independent steps.
 */
test.describe('Authentication', () => {
  test('register a new user', async ({ page }) => {
    const user = createUser();
    await registerUser(page, user);
    await expectOnDashboard(page);
  });

  test('login with valid credentials', async ({ page }) => {
    const user = createUser();
    await registerUser(page, user);
    await logoutUser(page);
    await loginUser(page, user);
    await expectOnDashboard(page);
  });

  test('session persists across reload', async ({ authenticatedPage, testUser }) => {
    await expectSessionPersists(authenticatedPage, testUser.email);
  });

  test('logout redirects to login page', async ({ authenticatedPage }) => {
    await logoutUser(authenticatedPage);
  });

  test('login rejects invalid credentials', async ({ page }) => {
    const user = createUser();
    await registerUser(page, user);
    await logoutUser(page);

    await page.goto('/login');
    await page.getByLabel(/Email/i).fill(user.email);
    await page.getByLabel(/^Password$|^Пароль$/i).fill('WrongPassword!');
    await page.getByRole('button', { name: /Sign in|Войти/i }).click();

    // Should stay on login page or show error
    await expect(page).toHaveURL(/\/login/);
  });
});
