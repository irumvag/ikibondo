/**
 * Offline visit capture: a CHW with no signal logs a visit, it is kept on the
 * phone, and it uploads by itself when the connection returns.
 *
 * Needs a running stack and a CHW who has at least one assigned family:
 *   E2E_CHW_EMAIL, E2E_CHW_PASSWORD, PLAYWRIGHT_BASE_URL (default http://localhost:3000)
 */
import { test, expect } from '@playwright/test';

const email = process.env.E2E_CHW_EMAIL;
const password = process.env.E2E_CHW_PASSWORD;

test.skip(!email || !password, 'Set E2E_CHW_EMAIL and E2E_CHW_PASSWORD to run offline tests');

test('visit logged offline is queued, then synced when back online', async ({ page, context }) => {
  await page.goto('/login');
  await page.fill('[name="identifier"]', email!);
  await page.fill('[name="password"]', password!);
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/chw/);

  // Load the caseload once while online so it is stored on the device
  await page.goto('/chw/visit');
  // Family rows show "N child(ren)"; expanding one reveals its children's "Log visit" buttons
  const firstFamily = page.getByText(/\d+ child(ren)?$/).first();
  await expect(firstFamily).toBeVisible({ timeout: 15_000 });
  await firstFamily.click();
  await page.getByRole('button', { name: /log visit/i }).first().click();

  await context.setOffline(true);
  await page.getByLabel('Weight (kg)').fill('7.4');
  await page.getByLabel('Height (cm)').fill('68');
  await page.getByLabel('MUAC (cm)').fill('11.2');
  await page.getByRole('button', { name: /save & get risk score/i }).click();

  await expect(page.getByText('Saved on this phone')).toBeVisible();
  // Field triage works with no signal
  await expect(page.getByText(/red band/i)).toBeVisible();

  await page.goto('/chw/sync').catch(() => { /* navigation is served from the offline cache */ });
  await expect(page.getByText(/1 record waiting to upload/i)).toBeVisible();

  await context.setOffline(false);
  await page.evaluate(() => window.dispatchEvent(new Event('online')));
  await expect(page.getByText(/all records are synced/i)).toBeVisible({ timeout: 15_000 });
});
