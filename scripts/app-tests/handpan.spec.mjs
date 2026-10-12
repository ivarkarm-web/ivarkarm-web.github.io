import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/handpan-app/index.html');
  await expect(page.locator('#pan')).toBeVisible();
  await expect(page.locator('#instrumentDropdownToggle')).toBeVisible();
});

test('boots the local core without runtime source-fetch errors', async ({ page }) => {
  await expect(page.locator('#instrumentMenu')).toBeAttached();
  await expect(page.locator('#mobileControlDrawer')).toBeAttached();
  await expect(page.locator('#knobMaster')).toBeVisible();
  const boot = await page.evaluate(() => ({
    core: !!window.PionierCore,
    noteCount: window.PionierCore?.noteCount?.(),
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth
  }));
  expect(boot.core).toBe(true);
  expect(boot.noteCount).toBeGreaterThanOrEqual(9);
  expect(boot.scrollWidth).toBeLessThanOrEqual(boot.clientWidth + 1);
});

test('instrument menu switches away from Handpan and can return', async ({ page }) => {
  const trigger = page.locator('#instrumentDropdownToggle');
  await trigger.click();
  const menu = page.locator('#instrumentMenu');
  await expect(menu).toBeVisible();
  await expect(menu.locator('button')).toContainText(['Handpan', 'Tongue Drum', 'Kalimba']);
  await menu.getByRole('button', { name: 'Bird', exact: true }).click();
  await expect(trigger).toContainText('Bird');
  await trigger.click();
  await menu.getByRole('button', { name: 'Handpan', exact: true }).click();
  await expect(trigger).toContainText('Handpan');
});

test('effect type menus open and update their selected state', async ({ page }) => {
  await page.locator('.knob-effect-trigger[aria-controls="bubbleComp"]').click();
  const bubble = page.locator('#bubbleComp');
  await expect(bubble).toBeVisible();
  await bubble.getByRole('button', { name: 'Punch', exact: true }).click();
  await expect(bubble.getByRole('button', { name: 'Punch', exact: true })).toHaveAttribute('aria-pressed', 'true');
});

test('controls drawer toggles and keeps its expanded state accessible', async ({ page }) => {
  const toggle = page.locator('#mobileControlsToggle');
  const drawer = page.locator('#mobileControlDrawer');
  await toggle.click();
  await expect(drawer).toHaveClass(/is-open/);
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  await toggle.click();
  await expect(drawer).not.toHaveClass(/is-open/);
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
});

test('soundscapes page can be entered and exited without reloading the instrument', async ({ page }) => {
  const handpan = page.locator('#tabHandpan');
  const soundscapes = page.locator('#tabSoundscapes');
  const pageView = page.locator('#soundscapesPage');
  await expect(handpan).toBeVisible();
  await soundscapes.click();
  await expect(pageView).toHaveClass(/is-active/);
  await page.locator('#tabHandpanFromSS').click();
  await expect(pageView).not.toHaveClass(/is-active/);
  await expect(page.locator('#pan')).toBeVisible();
});

test('rapid touch-sized strikes do not throw and canvas remains inside the viewport', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const canvas = page.locator('#pan');
  const rect = await canvas.boundingBox();
  const viewport = page.viewportSize();
  expect(rect).not.toBeNull();
  expect(viewport).not.toBeNull();
  expect(rect.x).toBeGreaterThanOrEqual(0);
  expect(rect.x + rect.width).toBeLessThanOrEqual(viewport.width + 1);
  const { x, y, width, height } = rect;
  for (const [dx, dy] of [[0.5,0.5],[0.35,0.35],[0.65,0.35],[0.35,0.65],[0.65,0.65],[0.5,0.5]]) {
    await page.mouse.click(x + width * dx, y + height * dy);
  }
  expect(errors).toEqual([]);
});
