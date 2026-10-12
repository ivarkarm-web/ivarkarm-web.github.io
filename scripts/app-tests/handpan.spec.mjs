import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/handpan-app/index.html');
  await expect(page.locator('#pan')).toBeVisible();
  await expect(page.locator('#instrumentDropdownToggle')).toBeVisible();
});

test('boots the local core without runtime source-fetch errors', async ({ page }) => {
  await expect(page.locator('#instrumentMenu')).toBeAttached();
  await expect(page.locator('#mobileControlDrawer')).toBeAttached();
  await page.locator('#mobileControlsToggle').click();
  await expect(page.locator('#mobileControlDrawer')).toHaveClass(/is-open/);
  await expect(page.locator('#knobMaster')).toBeAttached();
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
  await page.locator('#mobileControlsToggle').click();
  await page.locator('.knob-effect-trigger[aria-controls="bubbleComp"]').click();
  const bubble = page.locator('#bubbleComp');
  await expect(bubble).toBeVisible();
  await bubble.getByRole('button', { name: 'Punch', exact: true }).click();
  await expect(bubble.locator('[data-comp="punch"]')).toHaveAttribute('aria-pressed', 'true');
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

test('Soundscapes swipe transition opens and returns without reloading the instrument', async ({ page }) => {
  const canvas = page.locator('#pan');
  const rect = await canvas.boundingBox();
  expect(rect).not.toBeNull();
  const x = rect.x + rect.width * 0.72;
  const y = rect.y + rect.height * 0.5;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x - 150, y + 2, { steps: 8 });
  await page.mouse.up();
  const soundscapes = page.locator('#soundscapesPage');
  await expect(soundscapes).toHaveClass(/is-active/);
  await expect(page.locator('#app')).toHaveClass(/soundscapes-away/);
  await expect(page.locator('#mandalaWrap canvas')).toBeAttached();
  const stage = await page.locator('.soundscapes-stage').boundingBox();
  const sx = stage.x + stage.width * 0.5;
  const sy = stage.y + stage.height * 0.18;
  await page.mouse.move(sx, sy);
  await page.mouse.down();
  await page.mouse.move(sx + 150, sy + 2, { steps: 8 });
  await page.mouse.up();
  await expect(soundscapes).not.toHaveClass(/is-active/);
  await expect(page.locator('#app')).not.toHaveClass(/soundscapes-away/);
  await expect(page.locator('#pan')).toBeVisible();
});

test('Soundscapes shortcut opens the player and the back control returns', async ({ page }) => {
  await page.locator('#openSoundscapes').click();
  await expect(page.locator('#soundscapesPage')).toHaveClass(/is-active/);
  await page.locator('#backToHandpan').click();
  await expect(page.locator('#soundscapesPage')).not.toHaveClass(/is-active/);
  await expect(page.locator('#pan')).toBeVisible();
});

test('Soundscapes reuses the FX drawer and exposes track playback controls', async ({ page }) => {
  await page.locator('#mobileControlsToggle').click();
  await expect(page.locator('#mobileControlDrawer')).toHaveClass(/is-open/);
  await expect(page.locator('#knobMaster')).toBeAttached();
  await expect(page.locator('#soundscapeVolume')).toBeAttached();
  await expect(page.locator('#soundscapePlayback')).toBeAttached();
  await expect(page.locator('#mandalaPreviousTrack')).toBeAttached();
  await expect(page.locator('#mandalaNextTrack')).toBeAttached();
  await expect(page.locator('#mandalaPlay')).toBeAttached();
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
