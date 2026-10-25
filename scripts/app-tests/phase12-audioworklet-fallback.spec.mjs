import { test, expect } from '@playwright/test';

test('looper reports unsupported AudioWorklet recording instead of failing silently', async ({ page }) => {
  await page.addInitScript(() => {
    try {
      Object.defineProperty(window, 'AudioWorkletNode', { configurable: true, value: undefined });
      if (window.AudioContext) {
        Object.defineProperty(AudioContext.prototype, 'audioWorklet', {
          configurable: true,
          get: () => undefined
        });
      }
    } catch (_) {}
  });

  await page.goto('/handpan-app/');
  const enter = page.locator('#enterPionier');
  if (await enter.isVisible().catch(() => false)) {
    await enter.click();
    await expect(enter).toBeHidden({ timeout: 8000 }).catch(() => {});
  }

  const record = page.locator('#looperBtn');
  await expect(record).toBeVisible();
  await record.click();
  await expect(record).toBeDisabled();
  await expect(page.locator('#looperRecorderStatus')).toContainText('AudioWorklet support');
});
