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

test('phase12: rejected AudioWorklet recorder does not falsely enter recording state', async ({ page }) => {
  await page.addInitScript(() => {
    const proto = window.AudioWorklet?.prototype;
    if (!proto) return;
    Object.defineProperty(proto, 'addModule', {
      configurable: true,
      writable: true,
      value() {
        document.documentElement.dataset.workletStubCalls = String(
          Number(document.documentElement.dataset.workletStubCalls || 0) + 1,
        );
        return Promise.reject(new DOMException('Diagnostic forced addModule rejection', 'NetworkError'));
      },
    });
  });

  await page.goto('/handpan-app/');
  await enterIfNeeded(page);
  await expect.poll(() => page.evaluate(() => !!window.PionierCore), { timeout: 15000 }).toBe(true);
  await expect.poll(() => page.evaluate(() => !!window.PionierLooper), { timeout: 15000 }).toBe(true);
  await expect(page.locator('#pan')).toBeVisible();

  const record = page.locator('#looperBtn');
  await expect(record).toBeVisible();
  await record.click();
  await expect.poll(() => page.locator('html').getAttribute('data-worklet-stub-calls'), { timeout: 5000 }).toBe('1');

  // Failed initialization must leave the looper idle, not stuck recording.
  await expect(record).not.toHaveClass(/is-recording/, { timeout: 3000 });
  await expect(record).toBeEnabled();
  await expect(record).toHaveAttribute('title', 'Start loop recording');
  await expect(record).toHaveAttribute('aria-label', 'Start loop recording');
  await expect(page.locator('#appStatus')).toBeVisible();
  await expect(page.locator('#appStatus')).toHaveAttribute('data-state', 'degraded');
  await expect(page.locator('#appStatusMessage')).toHaveText('Loop recording could not start. Reload to retry.');
  await expect(page.locator('#pan')).toBeVisible();
});

test('phase12: clearing during recorder setup cancels the pending start', async ({ page }) => {
  // This case holds AudioWorklet initialization open while the UI boots and the
  // clear action is exercised; allow for startup contention with parallel workers.
  test.setTimeout(30000);

  await page.addInitScript(() => {
    const proto = window.AudioWorklet?.prototype;
    if (!proto) return;
    Object.defineProperty(proto, 'addModule', {
      configurable: true,
      writable: true,
      value() {
        document.documentElement.dataset.workletStubCalls = String(
          Number(document.documentElement.dataset.workletStubCalls || 0) + 1,
        );
        return new Promise((resolve) => {
          document.addEventListener('worklet-module-resolve', resolve, { once: true });
        });
      },
    });
  });

  await page.goto('/handpan-app/');
  await enterIfNeeded(page);
  await expect.poll(() => page.evaluate(() => !!window.PionierCore), { timeout: 15000 }).toBe(true);
  await expect.poll(() => page.evaluate(() => !!window.PionierLooper), { timeout: 15000 }).toBe(true);
  const record = page.locator('#looperBtn');
  await record.click();
  await expect.poll(() => page.locator('html').getAttribute('data-worklet-stub-calls')).toBe('1');

  await page.locator('#looperClearBtn').click();
  await page.evaluate(() => document.dispatchEvent(new Event('worklet-module-resolve')));
  await expect(record).not.toHaveClass(/is-recording/);
  await expect.poll(() => page.evaluate(() => window.PionierLooper.getState().recording)).toBe(false);
  await expect(record).toHaveAttribute('title', 'Start loop recording');
});
