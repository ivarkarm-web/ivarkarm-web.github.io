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
  await expect(menu.getByRole('button', { name: 'Tongue Drum', exact: true })).toBeVisible();
  await expect(menu.getByRole('button', { name: 'Kalimba', exact: true })).toBeVisible();
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

test('note-count controls add and remove notes without losing the instrument core', async ({ page }) => {
  await expect(page.locator('#notePlusCount')).toHaveText('9/13');
  await page.locator('#notePlus').click();
  await expect(page.locator('#notePlusCount')).toHaveText('10/13');
  await expect(page.locator('#noteMinus')).toBeVisible();
  await page.locator('#noteMinus').click();
  await expect(page.locator('#notePlusCount')).toHaveText('9/13');
  const core = await page.evaluate(() => window.PionierCore.noteCount());
  expect(core).toBe(9);
});

test('rapid pointer strikes do not throw and canvas remains inside the viewport', async ({ page }) => {
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

test('real touch taps can be delivered in quick succession on mobile', async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.startsWith('mobile'), 'touchscreen emulation runs in the mobile project');
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.evaluate(() => {
    window.__pionierStrikeCount = 0;
    window.addEventListener('pionier:learn-note', () => { window.__pionierStrikeCount += 1; });
  });
  const canvas = page.locator('#pan');
  const rect = await canvas.boundingBox();
  expect(rect).not.toBeNull();
  const points = [[0.5,0.5],[0.36,0.36],[0.64,0.36],[0.36,0.64],[0.64,0.64],[0.5,0.5]];
  for (const [dx,dy] of points) {
    await page.touchscreen.tap(rect.x + rect.width * dx, rect.y + rect.height * dy);
  }
  expect(errors).toEqual([]);
  expect(await page.evaluate(() => window.__pionierStrikeCount)).toBeGreaterThan(0);
  await expect(canvas).toBeVisible();
});
