/**
 * Phase 10: narrow-screen looper targets stay reachable with seven layers.
 * Regression guard for the visible dock (the legacy looper rail is hidden after boot).
 */
import { test, expect } from '@playwright/test';

async function enterIfNeeded(page) {
  const enter = page.locator('#enterPionier');
  if (await enter.isVisible().catch(() => false)) {
    await enter.click();
    await expect(enter).toBeHidden({ timeout: 8000 }).catch(() => {});
  }
}

test('phase10: mobile dock exposes 44px Clear/Record targets and seven layer targets', async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.startsWith('mobile'), 'mobile viewport regression');

  await page.goto('/handpan-app/');
  await enterIfNeeded(page);
  await expect.poll(() => page.evaluate(() => !!window.PionierCore), { timeout: 15000 }).toBe(true);
  await expect.poll(() => page.evaluate(() => {
    return document.getElementById('looperClearBtn')?.parentElement?.id === 'pionierLooperControls'
      && document.getElementById('looperLayers')?.parentElement?.id === 'pionierTrackRow';
  }), { timeout: 10000 }).toBe(true);

  const metrics = await page.evaluate(() => {
    const trackRow = document.getElementById('pionierTrackRow');
    const toolbar = document.getElementById('pionierLooperToolbar');
    const record = document.getElementById('looperBtn');
    const clear = document.getElementById('looperClearBtn');
    const layers = document.getElementById('looperLayers');
    if (!trackRow || !toolbar || !record || !clear || !layers) return { error: 'missing visible dock element' };

    // Probe the real CSS with seven layer buttons before the first recording.
    const probes = Array.from({ length: 7 }, (_, index) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'looper-circle';
      button.setAttribute('aria-label', 'Layer probe ' + (index + 1));
      layers.appendChild(button);
      return button;
    });

    const rect = (el) => {
      const box = el.getBoundingClientRect();
      return { width: box.width, height: box.height, left: box.left, right: box.right, top: box.top, bottom: box.bottom };
    };
    const result = {
      trackRow: rect(trackRow),
      toolbar: rect(toolbar),
      record: rect(record),
      clear: rect(clear),
      layers: rect(layers),
      layerButtons: probes.map(rect),
      layerClientWidth: layers.clientWidth,
      layerScrollWidth: layers.scrollWidth,
      viewportWidth: window.innerWidth,
    };
    probes.forEach((button) => button.remove());
    return result;
  });

  expect(metrics.error).toBeUndefined();
  expect(metrics.record.width).toBeGreaterThanOrEqual(44);
  expect(metrics.record.height).toBeGreaterThanOrEqual(44);
  expect(metrics.clear.width).toBeGreaterThanOrEqual(44);
  expect(metrics.clear.height).toBeGreaterThanOrEqual(44);
  expect(metrics.trackRow.height).toBeGreaterThanOrEqual(44);
  expect(metrics.layerButtons).toHaveLength(7);
  for (const [index, button] of metrics.layerButtons.entries()) {
    expect(button.width, 'layer ' + (index + 1) + ' width').toBeGreaterThanOrEqual(44);
    expect(button.height, 'layer ' + (index + 1) + ' height').toBeGreaterThanOrEqual(44);
    expect(button.left, 'layer ' + (index + 1) + ' left edge').toBeGreaterThanOrEqual(metrics.layers.left - 1);
    expect(button.right, 'layer ' + (index + 1) + ' right edge').toBeLessThanOrEqual(metrics.layers.right + 1);
  }
  expect(metrics.layerScrollWidth).toBeLessThanOrEqual(metrics.layerClientWidth + 1);
});
