/**
 * Ikibondo E2E smoke tests — Playwright
 *
 * Run with: npx playwright test e2e/smoke.spec.ts
 * Requires: PLAYWRIGHT_BASE_URL, E2E_PARENT_EMAIL, E2E_PARENT_PASSWORD,
 *           E2E_CHW_EMAIL, E2E_CHW_PASSWORD, E2E_NURSE_EMAIL, E2E_NURSE_PASSWORD
 *           env vars pointing at a seeded dev server.
 *
 * Install playwright first: npm i -D @playwright/test && npx playwright install chromium
 */
import { test, expect, type Page } from '@playwright/test';

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000';

// ── Helpers ───────────────────────────────────────────────────────────────────

async function login(page: Page, email: string, password: string) {
  await page.goto(`${BASE_URL}/login`);
  await page.fill('[name="identifier"]', email);
  await page.fill('[name="password"]', password);
  await page.click('button[type="submit"]');
  // Wait for dashboard redirect
  await page.waitForURL(/\/(chw|nurse|supervisor|admin|parent|onboarding)/, { timeout: 10_000 });
}

async function logout(page: Page) {
  // Click user avatar / logout button in topbar
  const avatar = page.locator('[aria-label="Account menu"], [data-testid="user-avatar"]').first();
  if (await avatar.isVisible()) {
    await avatar.click();
    await page.click('text=Sign out', { timeout: 3_000 });
  }
  await page.goto(`${BASE_URL}/login`);
}

// ── Tests ─────────────────────────────────────────────────────────────────────

test.describe('Authentication', () => {
  test('login page renders', async ({ page }) => {
    await page.goto(`${BASE_URL}/login`);
    await expect(page.locator('h1, h2')).toContainText(/sign in|login|welcome/i);
  });

  test('invalid credentials shows error', async ({ page }) => {
    await page.goto(`${BASE_URL}/login`);
    await page.fill('[name="identifier"]', 'bad@example.com');
    await page.fill('[name="password"]', 'wrongpassword');
    await page.click('button[type="submit"]');
    await expect(page.locator('[role="alert"], .error, [data-error]')).toBeVisible({ timeout: 5_000 });
  });
});

test.describe('Parent workflow', () => {
  const email = process.env.E2E_PARENT_EMAIL ?? 'parent@test.ikibondo.rw';
  const password = process.env.E2E_PARENT_PASSWORD ?? 'Test1234!';

  test.skip(!email, 'E2E_PARENT_EMAIL not set');

  test('parent can log in and view children', async ({ page }) => {
    await login(page, email, password);
    await expect(page).toHaveURL(/\/parent|\/onboarding/);
  });

  test('parent can navigate to notifications preferences', async ({ page }) => {
    await login(page, email, password);
    await page.goto(`${BASE_URL}/notifications/preferences`);
    await expect(page.locator('h2')).toContainText(/notification/i);
  });

  test('parent can view consent page', async ({ page }) => {
    await login(page, email, password);
    await page.goto(`${BASE_URL}/parent/consent`);
    await expect(page.locator('h2')).toContainText(/consent/i);
  });
});

test.describe('CHW workflow', () => {
  const email = process.env.E2E_CHW_EMAIL ?? 'chw@test.ikibondo.rw';
  const password = process.env.E2E_CHW_PASSWORD ?? 'Test1234!';

  test.skip(!email, 'E2E_CHW_EMAIL not set');

  test('CHW can log in and view caseload', async ({ page }) => {
    await login(page, email, password);
    await page.goto(`${BASE_URL}/chw/caseload`);
    await expect(page.locator('h2')).toContainText(/caseload/i);
  });

  test('CHW can navigate to requests page', async ({ page }) => {
    await login(page, email, password);
    await page.goto(`${BASE_URL}/chw/requests`);
    await expect(page.locator('h2')).toContainText(/visit request/i);
  });

  test('CHW can navigate to consultations', async ({ page }) => {
    await login(page, email, password);
    await page.goto(`${BASE_URL}/chw/consultations`);
    await expect(page.locator('h2')).toContainText(/consultation/i);
  });
});

test.describe('Nurse workflow', () => {
  const email = process.env.E2E_NURSE_EMAIL ?? 'nurse@test.ikibondo.rw';
  const password = process.env.E2E_NURSE_PASSWORD ?? 'Test1234!';

  test.skip(!email, 'E2E_NURSE_EMAIL not set');

  test('nurse can log in and reach dashboard', async ({ page }) => {
    await login(page, email, password);
    await expect(page).toHaveURL(/\/nurse|\/onboarding/);
  });

  test('nurse can navigate to child registration', async ({ page }) => {
    await login(page, email, password);
    await page.goto(`${BASE_URL}/nurse/register`);
    await expect(page.locator('h2')).toContainText(/register/i);
  });

  test('nurse can view inbox', async ({ page }) => {
    await login(page, email, password);
    await page.goto(`${BASE_URL}/nurse/inbox`);
    await expect(page.locator('h2')).toContainText(/inbox|consultation/i);
  });
});

test.describe('Offline indicator', () => {
  test('sync chip is visible in dashboard', async ({ page, context }) => {
    const email = process.env.E2E_CHW_EMAIL;
    const password = process.env.E2E_CHW_PASSWORD;
    if (!email || !password) test.skip();

    await login(page!, email!, password!);
    // Go offline
    await context.setOffline(true);
    await page.waitForTimeout(500);
    const chip = page.locator('[aria-label*="Offline"], text=Offline, [data-testid="sync-indicator"]');
    await expect(chip.first()).toBeVisible({ timeout: 5_000 });
    // Restore
    await context.setOffline(false);
  });
});
