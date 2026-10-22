/**
 * Phase 5: lightweight accessibility smoke (no axe dependency).
 * Guards landmarks, names, and focus affordances that Phase 3 focus-visible depends on.
 */
import { test, expect } from '@playwright/test';

async function enterIfNeeded(page) {
  const enter = page.locator('#enterPionier');
  if (await enter.isVisible().catch(() => false)) {
    await enter.click();
    await expect(enter).toBeHidden({ timeout: 5000 }).catch(() => {});
  }
}

test('phase5: document language and primary controls have accessible names', async ({ page }) => {
  await page.goto('/handpan-app/');
  await expect(page.locator('html')).toHaveAttribute('lang', /en/i);

  const enter = page.locator('#enterPionier');
  if (await enter.isVisible().catch(() => false)) {
    const label = ((await enter.innerText()) || '').trim();
    expect(label.length).toBeGreaterThan(0);
    await enter.click();
  }

  await expect(page.locator('#pan')).toHaveAttribute('aria-label', /handpan|instrument/i);
  await expect(page.locator('#scaleLabel')).toHaveAttribute('aria-haspopup', /true/i);
  await expect(page.locator('#instrumentDropdownToggle')).toHaveAttribute('aria-haspopup', /true/i);
  await expect(page.locator('#openSoundscapes')).toHaveAttribute('aria-label', /.+/);
  await expect(page.locator('#randomizeSetup')).toHaveAttribute('aria-label', /.+/);
  await expect(page.locator('#looperBtn')).toHaveAttribute('aria-label', /.+/);
});

test('phase5: focus-visible stylesheet is loaded and scale toggle is keyboard operable', async ({ page }) => {
  await page.goto('/handpan-app/');
  await enterIfNeeded(page);

  const hasFocusVisibleSheet = await page.evaluate(() =>
    [...document.styleSheets].some((sheet) => {
      try {
        return (sheet.href || '').includes('focus-visible.css');
      } catch (_) {
        return false;
      }
    })
  );
  expect(hasFocusVisibleSheet).toBe(true);

  const scale = page.locator('#scaleLabel');
  await scale.focus();
  await expect(scale).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('#scaleMenu')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('#scaleMenu')).toBeHidden();
});

test('phase5: status region uses polite live region while booting or degraded', async ({ page }) => {
  await page.goto('/handpan-app/');
  const status = page.locator('#appStatus');
  await expect(status).toHaveAttribute('aria-live', /polite|assertive/i);
  const role = await status.getAttribute('role');
  expect(role === 'status' || role === 'alert' || role === null || role === '').toBeTruthy();
});
