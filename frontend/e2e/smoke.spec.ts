/**
 * Smoke test: each role signs in once and its main pages open without an error.
 *
 * Needs a seeded stack (backend `manage.py seed_data`, DEBUG on) and these env vars,
 * e.g. for the seed accounts:
 *   E2E_PARENT_EMAIL=parent@ikibondo.rw E2E_PARENT_PASSWORD=parent123
 *   E2E_CHW_EMAIL=chw1@ikibondo.rw      E2E_CHW_PASSWORD=chw123
 *   E2E_NURSE_EMAIL=nurse@ikibondo.rw   E2E_NURSE_PASSWORD=nurse123
 * Sign-in is rate limited (10 per minute), so each role signs in once and reuses the session.
 * Deeper form-by-form checks live in e2e/flows.mjs.
 */
import { test, expect, type Browser, type Page } from '@playwright/test';

test.describe.configure({ mode: 'serial' });

async function signIn(browser: Browser, email: string, password: string): Promise<Page> {
  const page = await browser.newPage();
  await page.goto('/login');
  await page.fill('[name="identifier"]', email);
  await page.fill('[name="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 15_000 });
  return page;
}

async function opensCleanly(page: Page, path: string) {
  await page.goto(path);
  // Some pages poll for updates, so wait for the content rather than a quiet network
  await expect(page.locator('main')).toBeVisible();
  await page.waitForTimeout(800);
  await expect(page).toHaveURL(new RegExp(`${path.replace(/\//g, '\\/')}$`));
  await expect(page.getByText(/something went wrong/i)).toHaveCount(0);
}

test('login page renders and rejects a wrong password', async ({ page }) => {
  await page.goto('/login');
  await expect(page.getByRole('heading').first()).toBeVisible();
  await page.fill('[name="identifier"]', 'nobody@example.com');
  await page.fill('[name="password"]', 'wrong-password-1');
  await page.click('button[type="submit"]');
  await expect(page.getByRole('alert').first()).toBeVisible({ timeout: 5_000 });
});

const ROLES = [
  { role: 'parent', env: 'PARENT', pages: ['/parent', '/parent/vaccines', '/parent/request-visit', '/parent/consent'] },
  { role: 'CHW', env: 'CHW', pages: ['/chw', '/chw/visit', '/chw/requests', '/chw/consultations', '/chw/sync'] },
  { role: 'nurse', env: 'NURSE', pages: ['/nurse', '/nurse/children', '/nurse/register', '/nurse/inbox', '/nurse/vaccines/session'] },
] as const;

for (const { role, env, pages } of ROLES) {
  test(`${role}: main pages open`, async ({ browser }) => {
    const email = process.env[`E2E_${env}_EMAIL`];
    const password = process.env[`E2E_${env}_PASSWORD`];
    test.skip(!email || !password, `Set E2E_${env}_EMAIL and E2E_${env}_PASSWORD`);
    const page = await signIn(browser, email!, password!);
    for (const path of pages) await opensCleanly(page, path);
    await page.close();
  });
}
