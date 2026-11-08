/**
 * Phase 5: lightweight accessibility smoke (no axe dependency).
 * Guards landmarks, names, and focus affordances that Phase 3 focus-visible depends on.
 */
import { test, expect } from '@playwright/test';

async function enterIfNeeded(page) {
  const enter = page.locator('#enterPionier');
  if (await enter.isVisible().catch(() => false)) {
    await enter.click();
    await expect(enter)
      .toBeHidden({ timeout: 5000 })
      .catch(() => {});
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
  await expect(page.locator('#openLibrary')).toHaveAttribute('aria-label', /.+/);
  await expect(page.locator('#randomizeSetup')).toHaveAttribute('aria-label', /.+/);
  await expect(page.locator('#looperBtn')).toHaveAttribute('aria-label', /.+/);
});

test('phase5: bundled focus-visible rules are loaded and scale toggle is keyboard operable', async ({
  page,
}) => {
  await page.goto('/handpan-app/');
  await enterIfNeeded(page);

  const hasScaleFocusVisibleRule = await page.evaluate(() =>
    [...document.styleSheets].some((sheet) => {
      try {
        const isAppStylesheet = (sheet.href || '').includes('pionier-controls.css');
        return (
          isAppStylesheet &&
          [...sheet.cssRules].some(
            (rule) =>
              rule.selectorText?.includes(':focus-visible') &&
              (rule.selectorText.includes('#scaleLabel') ||
                rule.selectorText.includes('.scale-dropdown-toggle'))
          )
        );
      } catch (_) {
        return false;
      }
    })
  );
  expect(hasScaleFocusVisibleRule).toBe(true);

  const scale = page.locator('#scaleLabel');
  await scale.focus();
  await expect(scale).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('#scaleMenu')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('#scaleMenu')).toBeHidden();
});

test('phase5: sequencer controls leave the tab order while the panel is closed', async ({
  page,
}) => {
  await page.goto('/handpan-app/');
  await enterIfNeeded(page);
  await expect
    .poll(() => page.evaluate(() => !!window.PionierTonepad), { timeout: 30000 })
    .toBe(true);

  const toggle = page.locator('#tonepadToggle');
  const layer = page.locator('#tonepadLayer');
  const play = page.locator('#tonepadLayer [data-play]');

  await expect(toggle).toHaveAttribute('aria-pressed', 'false');
  await expect(layer).toHaveAttribute('aria-hidden', 'true');
  expect(await layer.evaluate((el) => el.inert)).toBe(true);

  // A closed panel must not accept focus.
  expect(
    await page.evaluate(() => {
      const target = document.querySelector('#tonepadLayer [data-play]');
      target?.focus();
      return document.activeElement?.hasAttribute('data-play') ?? false;
    })
  ).toBe(false);

  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-pressed', 'true');
  await expect(layer).not.toHaveAttribute('aria-hidden');
  expect(await layer.evaluate((el) => el.inert)).toBe(false);

  // Open panel controls are reachable.
  await play.focus();
  await expect(play).toBeFocused();

  // Closing while focus is inside returns focus to the toggle.
  await toggle.click();
  await expect(toggle).toBeFocused();
  await expect(layer).toHaveAttribute('aria-hidden', 'true');
});

test('phase5: loop layer strip is a named group', async ({ page }) => {
  await page.goto('/handpan-app/');
  await enterIfNeeded(page);
  await expect(page.locator('#looperLayers')).toHaveAttribute('role', 'group');
  await expect(page.locator('#looperLayers')).toHaveAttribute('aria-label', /loop layers/i);
});

test('phase5: status region uses polite live region while booting or degraded', async ({
  page,
}) => {
  await page.goto('/handpan-app/');
  const status = page.locator('#appStatus');
  await expect(status).toHaveAttribute('aria-live', /polite|assertive/i);
  const role = await status.getAttribute('role');
  expect(role === 'status' || role === 'alert' || role === null || role === '').toBeTruthy();
});
