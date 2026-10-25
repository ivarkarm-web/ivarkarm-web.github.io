/**
 * Phase 8: After Enter, bottom dock + scale/instrument/root controls must exist.
 * Guards the class of bugs where scripts are in the SW shell but missing from index.
 */
import { test, expect } from '@playwright/test';

async function enterIfNeeded(page) {
  const enter = page.locator('#enterPionier');
  if (await enter.isVisible().catch(() => false)) {
    await enter.click();
    await expect(enter).toBeHidden({ timeout: 8000 }).catch(() => {});
  }
}

test('phase8: Enter → dock, scale, instrument, root, looper visible', async ({ page }) => {
  await page.goto('/handpan-app/');
  await enterIfNeeded(page);
  await expect.poll(() => page.evaluate(() => !!window.PionierCore), { timeout: 15000 }).toBe(true);
  await expect(page.locator('#pan')).toBeVisible();

  await expect.poll(async () => {
    return page.evaluate(() => {
      const dock = document.getElementById('pionierBottomDock');
      if (!dock) return false;
      const style = getComputedStyle(dock);
      return style.display !== 'none' && style.visibility !== 'hidden';
    });
  }, { timeout: 10000 }).toBe(true);

  await expect(page.locator('#scaleLabel')).toBeVisible();
  await expect.poll(async () => {
    return page.evaluate(() => !!document.getElementById('looperRootMenuBtn'));
  }, { timeout: 8000 }).toBe(true);

  const looperBtn = page.locator('#looperBtn');
  await expect(looperBtn).toBeVisible();
  const box = await looperBtn.boundingBox();
  expect(box, 'looper record target').toBeTruthy();
  expect(Math.min(box.width, box.height)).toBeGreaterThanOrEqual(40);
});

test('phase8: critical scripts listed in index resolve on disk path', async ({ page }) => {
  await page.goto('/handpan-app/');
  const missing = await page.evaluate(async () => {
    const scripts = [...document.querySelectorAll('script[src]')].map((s) => s.getAttribute('src'));
    const links = [...document.querySelectorAll('link[rel=stylesheet]')].map((l) => l.getAttribute('href'));
    const urls = [...scripts, ...links].filter((u) => u && u.startsWith('./'));
    const bad = [];
    for (const u of urls) {
      try {
        const r = await fetch(u, { method: 'HEAD', cache: 'no-store' });
        if (!r.ok) bad.push(u + ' → ' + r.status);
      } catch (e) {
        bad.push(u + ' → ' + (e && e.message));
      }
    }
    return bad;
  });
  expect(missing, missing.join('\n')).toEqual([]);
});

test('phase8: selectors and right-side looper actions remain mounted after deferred boot', async ({ page }) => {
  await page.goto('/handpan-app/');
  await enterIfNeeded(page);
  await expect.poll(() => page.evaluate(() => !!window.PionierCore), { timeout: 15000 }).toBe(true);

  // Wait beyond the reported ~1s disappearance window and deferred-module startup.
  await page.waitForTimeout(1800);
  await expect(page.locator('#pan')).toBeVisible();
  await expect(page.locator('#scaleLabel')).toBeVisible();
  await expect(page.locator('#instrumentDropdownToggle')).toBeVisible();

  const dock = page.locator('#pionierBottomDock');
  const toolbar = page.locator('#pionierLooperToolbar');
  await expect(dock).toBeVisible();
  await expect(toolbar).toBeVisible();

  for (const id of ['openSoundscapes', 'fxPanelOpen', 'settingsOpenBtn']) {
    const control = page.locator('#' + id);
    await expect(control, '#' + id + ' should remain visible after deferred boot').toBeVisible();
    await expect.poll(() => control.evaluate((el) => el.parentElement?.id)).toBe('pionierLooperActions');
    const box = await control.boundingBox();
    const viewport = page.viewportSize();
    expect(box, '#' + id + ' should have a layout box').toBeTruthy();
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.y).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(viewport.width + 1);
    expect(box.y + box.height).toBeLessThanOrEqual(viewport.height + 1);
  }
});

