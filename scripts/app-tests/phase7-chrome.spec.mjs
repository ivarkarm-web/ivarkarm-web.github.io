/**
 * Phase 7: offline pill + update toast chrome exist and offline flag toggles.
 */
import { test, expect } from '@playwright/test';

test('phase7: network pill and update toast mount from registerSW', async ({ page }) => {
  await page.goto('/handpan-app/', { waitUntil: 'domcontentloaded' });
  await expect.poll(() => page.evaluate(() => !!document.getElementById('pionierNetPill'))).toBe(true);
  await expect.poll(() => page.evaluate(() => !!document.getElementById('pionierUpdateToast'))).toBe(true);
  await expect(page.locator('#pionierUpdateReload')).toHaveText(/Reload/i);
});

test('phase7: offline event shows network pill', async ({ page, context }) => {
  await page.goto('/handpan-app/', { waitUntil: 'domcontentloaded' });
  await expect.poll(() => page.evaluate(() => !!document.getElementById('pionierNetPill'))).toBe(true);
  await context.setOffline(true);
  await page.evaluate(() => window.dispatchEvent(new Event('offline')));
  await expect(page.locator('#pionierNetPill')).toBeVisible();
  await expect(page.locator('#pionierNetPill')).toHaveText(/Offline/i);
  await context.setOffline(false);
  await page.evaluate(() => window.dispatchEvent(new Event('online')));
  await expect(page.locator('#pionierNetPill')).toBeHidden();
});
