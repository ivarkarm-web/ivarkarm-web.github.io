import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/handpan-app/index.html');
  await expect(page.locator('#hpStage')).toBeVisible();
  await expect(page.locator('.app-modebar')).toBeVisible();
});

test('play mode renders the handpan surface and navigation', async ({ page }) => {
  await expect(page.locator('.hp-title')).toHaveText('Handpan');
  await expect(page.locator('#hpStage')).toHaveAttribute('aria-label', /Handpan/);
  await expect(page.locator('.app-mode[data-mode="play"]')).toHaveClass(/is-active/);
});

test('mode navigation opens learn and loop controls', async ({ page }) => {
  await page.locator('.app-mode[data-mode="learn"]').click();
  await expect(page.locator('#learnPanel')).toBeVisible();
  await expect(page.locator('#lessonList')).toBeVisible();

  await page.locator('.app-mode[data-mode="loop"]').click();
  await expect(page.locator('#loopRecord')).toBeVisible();
  await expect(page.locator('#loopPlay')).toBeVisible();
});

test('scale picker is keyboard accessible', async ({ page }) => {
  const trigger = page.locator('#hpScaleMenuToggle');
  await expect(trigger).toBeVisible();
  await trigger.focus();
  await expect(trigger).toBeFocused();
  await trigger.press('Enter');
  await expect(page.locator('#hpScaleSheet')).not.toHaveAttribute('hidden', '');
});

test('touch-sized layout keeps primary controls inside the viewport', async ({ page }) => {
  const viewport = page.viewportSize();
  expect(viewport).not.toBeNull();
  const rect = await page.locator('#hpStage').boundingBox();
  expect(rect).not.toBeNull();
  expect(rect.width).toBeGreaterThanOrEqual(viewport.width);
  expect(rect.height).toBeGreaterThanOrEqual(viewport.height);
});
