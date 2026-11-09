import { test, expect } from '@playwright/test';

async function enterApp(page) {
  await page.goto('/handpan-app/');
  const enter = page.locator('#enterPionier');
  if (await enter.isVisible().catch(() => false)) {
    await enter.click();
    await expect(enter).toBeHidden({ timeout: 8000 }).catch(() => {});
  }
  await expect.poll(() => page.evaluate(() => !!window.PionierTonepad), { timeout: 15000 }).toBe(true);
}

test('TonePad opens, edits and persists a pattern, and switches layers and sounds', async ({ page }) => {
  // This flow performs two app boots, reload persistence, transport and
  // audio scheduling. 45s was not enough on slower local hardware; 120s still
  // fails fast on a genuine hang while allowing slow first paint.
  test.setTimeout(120000);
  await page.addInitScript(() => {
    window.__tonepadOscillatorCount = 0;
    const Audio = window.AudioContext || window.webkitAudioContext;
    if (Audio) {
      const createOscillator = Audio.prototype.createOscillator;
      Audio.prototype.createOscillator = function (...args) {
        window.__tonepadOscillatorCount += 1;
        return createOscillator.apply(this, args);
      };
    }
  });
  await enterApp(page);
  await page.evaluate(() => localStorage.removeItem('pionier-tonepad-v36'));
  await page.reload();
  await enterApp(page);

  const toggle = page.locator('#tonepadToggle');
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-pressed', 'true');
  const canvas = page.locator('#tonepadLayer canvas.tonepad-canvas');
  await expect(canvas).toBeVisible();
  await expect(page.locator('[data-play]')).toHaveText('Play');
  expect(await page.evaluate(() => window.__tonepadOscillatorCount)).toBe(0);

  // Paint the centre of the first square cell using the same laid-out canvas geometry as touch.
  await canvas.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    const dpr = element.width / rect.width;
    const h = element.height;
    const pad = Math.max(4, Math.min(element.width, h) * 0.02);
    const gap = Math.max(1, Math.min(element.width, h) * 0.01);
    const cell = Math.max(1, Math.min(
      (element.width - pad * 2 - gap * 15) / 16,
      (h - pad * 2 - gap * 7) / 8,
    ));
    const gridW = cell * 16 + gap * 15;
    const gridH = cell * 8 + gap * 7;
    const x = rect.left + ((element.width - gridW) / 2 + cell / 2) / dpr;
    const y = rect.top + ((h - gridH) / 2 + cell / 2) / dpr;
    element.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 1, clientX: x, clientY: y }));
    element.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 1, clientX: x, clientY: y }));
  });

  const pattern = await page.evaluate(() => JSON.parse(localStorage.getItem('pionier-tonepad-v36')));
  expect(pattern.layers).toHaveLength(5);
  expect(pattern.layers[0].reduce((sum, cell) => sum + cell, 0)).toBe(1);
  const oscillatorsBeforeTransport = await page.evaluate(() => window.__tonepadOscillatorCount);
  await page.locator('[data-play]').click();
  await expect(page.locator('[data-play]')).toHaveText('Stop');
  await expect.poll(() => page.evaluate(() => window.__tonepadOscillatorCount), { timeout: 5000 })
    .toBeGreaterThan(oscillatorsBeforeTransport);
  await page.locator('.tonepad-layer-btn[data-layer="1"]').click();
  await page.locator('.tonepad-sound-btn[data-sound="kalimba"]').click();
  await expect(page.locator('.tonepad-sound-btn[data-sound="kalimba"]')).toHaveClass(/is-active/);

  await page.locator('[data-play]').click();
  await expect(page.locator('[data-play]')).toHaveText('Play');
  await page.reload();
  await enterApp(page);
  await page.locator('#tonepadToggle').click();
  await expect(page.locator('.tonepad-layer-btn[data-layer="1"]')).toHaveClass(/is-active/);
  await expect(page.locator('.tonepad-sound-btn[data-sound="kalimba"]')).toHaveClass(/is-active/);
  await page.locator('[data-clear]').click();
  const cleared = await page.evaluate(() => JSON.parse(localStorage.getItem('pionier-tonepad-v36')));
  expect(cleared.layers[1].every((cell) => cell === 0)).toBe(true);
  expect(cleared.layerSounds[1]).toBe('kalimba');
});

test('TonePad loads and remains usable when browser storage is unavailable', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      get() { throw new DOMException('storage blocked', 'SecurityError'); },
    });
  });
  await enterApp(page);
  await page.locator('#tonepadToggle').click();
  await expect(page.locator('#tonepadToggle')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#tonepadLayer canvas.tonepad-canvas')).toBeVisible();
});
