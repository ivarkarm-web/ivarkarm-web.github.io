/**
 * Phase 3 smoke: Enter → instrument → Escape closes scale menu.
 * Keeps a short path for CI without the full handpan suite.
 */
import { test, expect } from '@playwright/test';

async function enterIfNeeded(page) {
  const enter = page.locator('#enterPionier');
  if (await enter.isVisible().catch(() => false)) {
    await enter.click();
    await expect(enter).toBeHidden({ timeout: 5000 }).catch(() => {});
  }
}

test('phase3: Enter, pan ready, scale menu Escape restores focus', async ({ page }) => {
  await page.goto('/handpan-app/');
  await enterIfNeeded(page);
  await expect.poll(() => page.evaluate(() => !!window.PionierCore)).toBe(true);
  await expect(page.locator('#pan')).toBeVisible();

  const scaleToggle = page.locator('#scaleLabel');
  await expect(scaleToggle).toBeVisible();
  await scaleToggle.click();
  const menu = page.locator('#scaleMenu');
  await expect(menu).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(menu).toBeHidden();
  // Focus should return to the scale control after Escape.
  await expect.poll(async () => page.evaluate(() => document.activeElement?.id === 'scaleLabel')).toBe(true);
});

test('phase3: instrument remains after soundscapes network failure message path', async ({ page }) => {
  await page.goto('/handpan-app/');
  await enterIfNeeded(page);
  await expect.poll(() => page.evaluate(() => !!window.PionierCore)).toBe(true);

  // Block archive.org so player shows a clear network status when opened + play attempted.
  await page.route('**archive.org/**', (route) => route.abort());
  await page.locator('#openSoundscapes').click();
  await expect(page.locator('#soundscapesPanel')).toBeVisible();
  await page.locator('#soundscapePlay').click();
  await expect.poll(async () => {
    const t = await page.locator('#soundscapeStatus').textContent();
    return /network|connection|Could not load|Needs network/i.test(t || '');
  }, { timeout: 8000 }).toBe(true);
  await page.keyboard.press('Escape');
  await expect(page.locator('#pan')).toBeVisible();
});
