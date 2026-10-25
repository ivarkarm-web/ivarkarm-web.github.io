/**
 * Phase 12: looper recorder degrades safely when AudioWorklet module loading fails.
 * The instrument surface must remain usable and the record control must not claim
 * that a recording started when the recorder cannot initialize.
 */
import { test, expect } from '@playwright/test';

async function enterIfNeeded(page) {
  const enter = page.locator('#enterPionier');
  if (await enter.isVisible().catch(() => false)) {
    await enter.click();
    await expect(enter).toBeHidden({ timeout: 8000 }).catch(() => {});
  }
}

test('phase12: blocked AudioWorklet recorder does not falsely enter recording state', async ({ page }) => {
  let workletRequestBlocked = false;
  await page.route('**/looper-recorder-worklet.js*', async (route) => {
    workletRequestBlocked = true;
    await route.abort('failed');
  });

  await page.goto('/handpan-app/');
  await enterIfNeeded(page);
  await expect.poll(() => page.evaluate(() => !!window.PionierCore), { timeout: 15000 }).toBe(true);
  await expect(page.locator('#pan')).toBeVisible();

  const record = page.locator('#looperBtn');
  await expect(record).toBeVisible();
  await record.click();
  await expect.poll(() => workletRequestBlocked, { timeout: 5000 }).toBe(true);

  // The rejected worklet module should leave the looper idle, not stuck recording.
  await expect(record).not.toHaveClass(/is-recording/, { timeout: 3000 });
  await expect(page.locator('#pan')).toBeVisible();
  await expect(page.locator('#appStatus')).not.toHaveAttribute('data-state', 'failed');
});
