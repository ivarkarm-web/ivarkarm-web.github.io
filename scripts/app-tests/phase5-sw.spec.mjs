/**
 * Phase 5: service worker offline shell proof.
 * Runs only in the `sw-desktop` Playwright project (serviceWorkers: allow).
 */
import { test, expect } from '@playwright/test';

async function enterIfNeeded(page) {
  const enter = page.locator('#enterPionier');
  if (await enter.isVisible().catch(() => false)) {
    await enter.click();
    await expect(enter).toBeHidden({ timeout: 5000 }).catch(() => {});
  }
}

test('phase5: service worker activates and shell survives offline reload', async ({ page, context }) => {
  await page.goto('/handpan-app/', { waitUntil: 'domcontentloaded' });

  await expect
    .poll(async () => {
      return page.evaluate(async () => {
        if (!('serviceWorker' in navigator)) return 'no-sw-api';
        try {
          const reg = await navigator.serviceWorker.register('./sw.js', { scope: './' });
          await navigator.serviceWorker.ready;
          if (reg.waiting) reg.waiting.postMessage({ type: 'SKIP_WAITING' });
          return reg.active ? reg.active.state : reg.installing?.state || reg.waiting?.state || 'none';
        } catch (err) {
          return String(err?.message || err);
        }
      });
    }, { timeout: 15000 })
    .toBe('activated');

  await page.waitForTimeout(1500);

  await enterIfNeeded(page);
  await expect.poll(() => page.evaluate(() => !!window.PionierCore)).toBe(true);
  await expect(page.locator('#pan')).toBeVisible();

  await page.goto('/handpan-app/', { waitUntil: 'domcontentloaded' });
  await expect
    .poll(() => page.evaluate(() => !!navigator.serviceWorker.controller), { timeout: 10000 })
    .toBe(true);

  await context.setOffline(true);
  await page.reload({ waitUntil: 'domcontentloaded' });

  await enterIfNeeded(page);
  await expect(page.locator('#pan')).toBeVisible({ timeout: 12000 });
  await expect
    .poll(() => page.evaluate(() => !!window.PionierCore?.handpan || !!window.PionierCore), {
      timeout: 12000,
    })
    .toBe(true);

  await context.setOffline(false);
});
