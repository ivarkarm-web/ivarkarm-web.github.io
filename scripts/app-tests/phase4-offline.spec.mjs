/**
 * Phase 4: offline-oriented checks (no Google Fonts; shell still boots).
 * SW is blocked by playwright.config — this validates the document + boot path.
 */
import { test, expect } from '@playwright/test';

test('phase4: index does not depend on Google Fonts CDN', async ({ page }) => {
  await page.goto('/handpan-app/');
  const externalFonts = await page.evaluate(() =>
    [...document.querySelectorAll('link[rel="stylesheet"], link[rel="preconnect"]')]
      .map((el) => el.href || el.getAttribute('href') || '')
      .filter((h) => /fonts\.googleapis|fonts\.gstatic/i.test(h))
  );
  expect(externalFonts).toEqual([]);
});

test('phase4: critical offline shell assets are referenced by the app', async ({ page }) => {
  await page.goto('/handpan-app/');
  const enter = page.locator('#enterPionier');
  if (await enter.isVisible().catch(() => false)) await enter.click();
  await expect.poll(() => page.evaluate(() => !!window.PionierCore)).toBe(true);
  await expect(page.locator('#pan')).toBeVisible();
  const health = await page.evaluate(() => window.PionierCore?.health?.() || null);
  expect(health).toBeTruthy();
  expect(health.audioAvailable).toBe(true);
});
