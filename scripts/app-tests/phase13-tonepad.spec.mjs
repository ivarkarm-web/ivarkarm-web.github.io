import { test, expect } from '@playwright/test';
import { dismissStorageNoticeIfNeeded } from './support/storage-notice.mjs';

async function enterApp(page) {
  await page.goto('/handpan-app/');
  await dismissStorageNoticeIfNeeded(page);
  const enter = page.locator('#enterPionier');
  if (await enter.isVisible().catch(() => false)) {
    await enter.click();
    await expect(enter).toBeHidden({ timeout: 8000 }).catch(() => {});
  }
  await expect.poll(() => page.evaluate(() => !!window.PionierTonepad), { timeout: 15000 }).toBe(true);
}

test('TonePad opens, edits and persists a pattern, and switches layers and sounds', async ({ page }) => {
  // This flow performs two app boots, reload persistence, transport and
  // audio scheduling. 120s fails fast on a genuine hang while allowing slow first paint.
  test.setTimeout(120000);
  await page.addInitScript(() => {
    // Global AudioContext instrumentation counts all app audio (boot/ambient/etc.),
    // so tests must compare deltas from a baseline captured immediately before the
    // TonePad action under test — never assume zero at full-app boot.
    window.__tonepadOscillatorCount = 0;
    window.__tonepadBufferSourceCount = 0;
    const Audio = window.AudioContext || window.webkitAudioContext;
    if (Audio) {
      const createOscillator = Audio.prototype.createOscillator;
      Audio.prototype.createOscillator = function (...args) {
        window.__tonepadOscillatorCount += 1;
        return createOscillator.apply(this, args);
      };
      const createBufferSource = Audio.prototype.createBufferSource;
      Audio.prototype.createBufferSource = function (...args) {
        window.__tonepadBufferSourceCount += 1;
        return createBufferSource.apply(this, args);
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
  const playBtn = page.locator('[data-play]');
  await expect(playBtn).toHaveAttribute('aria-label', 'Play');

  // Paint the centre of a safe interior cell (col 2,row 2) using laid-out canvas geometry.
  // Avoids edge-swipe rejection (40px) on narrow viewports; realistic pointer fields for touch/mobile.
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
    const col = 2, row = 2;
    const x = rect.left + ((element.width - gridW) / 2 + col * (cell + gap) + cell / 2) / dpr;
    const y = rect.top + ((h - gridH) / 2 + row * (cell + gap) + cell / 2) / dpr;
    const base = { bubbles: true, cancelable: true, pointerId: 1, pointerType: 'touch', isPrimary: true, clientX: x, clientY: y, width: 1, height: 1, pressure: 0.5 };
    element.dispatchEvent(new PointerEvent('pointerdown', { ...base, button: 0, buttons: 1 }));
    element.dispatchEvent(new PointerEvent('pointerup', { ...base, button: 0, buttons: 0 }));
  });

  const pattern = await page.evaluate(() => JSON.parse(localStorage.getItem('pionier-tonepad-v36')));
  expect(pattern.layers).toHaveLength(5);
  expect(pattern.layers[0].reduce((sum, cell) => sum + cell, 0)).toBe(1);
  // Baseline captured immediately before TonePad transport starts (not at boot),
  // so unrelated app audio cannot make this assertion brittle.
  const sourcesBeforeTransport = await page.evaluate(() => (window.__tonepadOscillatorCount || 0) + (window.__tonepadBufferSourceCount || 0));
  await playBtn.click();
  await expect(playBtn).toHaveAttribute('aria-label', 'Stop');
  await expect.poll(() => page.evaluate(() => (window.__tonepadOscillatorCount || 0) + (window.__tonepadBufferSourceCount || 0)), { timeout: 5000 })
    .toBeGreaterThan(sourcesBeforeTransport);
  await page.locator('.tonepad-layer-btn[data-layer="1"]').click();
  const soundSelect = page.locator('[data-sound-select]');
  await soundSelect.selectOption('kalimba');
  await expect(soundSelect).toHaveValue('kalimba');

  await playBtn.click();
  await expect(playBtn).toHaveAttribute('aria-label', 'Play');
  await page.reload();
  await enterApp(page);
  await page.locator('#tonepadToggle').click();
  await expect(page.locator('.tonepad-layer-btn[data-layer="1"]')).toHaveClass(/is-active/);
  await expect(page.locator('[data-sound-select]')).toHaveValue('kalimba');
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

test('TonePad plays all five layers simultaneously with per-layer config and no rotation', async ({ page }) => {
  test.setTimeout(120000);
  await page.addInitScript(() => {
    // Counts/timestamps all WebAudio scheduled sources (oscillator + buffer).
    // Simultaneity is proven by burst density, not by total count alone: this
    // pattern places 1 melodic + 1 drum note per layer on the same hit columns
    // (5 layers => 10 sources per hit). Rotation would create <=2 per hit.
    window.__tonepadSourceCount = 0;
    window.__tonepadSourceTimes = [];
    const pushSource = () => {
      window.__tonepadSourceCount += 1;
      window.__tonepadSourceTimes.push(performance.now());
    };
    const Audio = window.AudioContext || window.webkitAudioContext;
    if (Audio) {
      const createOscillator = Audio.prototype.createOscillator;
      Audio.prototype.createOscillator = function (...args) { pushSource(); return createOscillator.apply(this, args); };
      const createBufferSource = Audio.prototype.createBufferSource;
      Audio.prototype.createBufferSource = function (...args) { pushSource(); return createBufferSource.apply(this, args); };
    }
    // Inject a dense 5-layer pattern before app reads it
    try {
      const COLS = 16;
      const layers = Array.from({ length: 5 }, () => Array(128).fill(0));
      const drumLayersArr = Array.from({ length: 5 }, () => Array(128).fill(0));
      // deterministic: notes on every 4th column for all 5 layers (row 0 melodic + row 0 drum)
      for (let li = 0; li < 5; li++) {
        for (const c of [0, 4, 8, 12]) { layers[li][0 * COLS + c] = 1; drumLayersArr[li][0 * COLS + c] = 1; }
      }
      localStorage.setItem('pionier-tonepad-v36', JSON.stringify({
        layers,
        layerSounds: ['bloom', 'handpan', 'kalimba', 'marimba', 'bell'],
        velocity: 0.7, probability: 1, humanize: 0, activeLayer: 0,
        layerModes: ['melodic', 'melodic', 'drum', 'drum', 'melodic'],
        drumLayers: drumLayersArr,
        drumKits: ['classic', 'deep', 'punchy', 'lofi', 'tribal'],
        fxMelodic: Array.from({ length: 5 }, () => ({ reverb: 0.1, delay: 0.0, tone: 0.5, decay: 0.5, shimmer: 0.0 })),
        fxDrum: Array.from({ length: 5 }, (_, i) => ({ tune: 0.5, decay: 0.5, drive: 0.0, space: 0.0, swing: i === 0 ? 0.4 : 0.0 })),
        version: 48
      }));
    } catch (_) {}
  });
  await enterApp(page);
  await page.locator('#tonepadToggle').click();
  await expect(page.locator('#tonepadToggle')).toHaveAttribute('aria-pressed', 'true');
  const playBtn = page.locator('[data-play]');
  await expect(playBtn).toHaveAttribute('aria-label', 'Play');
  // Baseline immediately before TonePad transport (not app boot).
  const s0 = await page.evaluate(() => (window.__tonepadSourceTimes || []).length);
  await playBtn.click();
  await expect(playBtn).toHaveAttribute('aria-label', 'Stop');
  await page.waitForTimeout(1500);

  const burst = await page.evaluate((startIdx) => {
    const t = (window.__tonepadSourceTimes || []).slice(startIdx);
    let maxInWindow = 0;
    let j = 0;
    for (let i = 0; i < t.length; i++) {
      while (j < t.length && t[j] - t[i] <= 120) j++;
      const n = j - i;
      if (n > maxInWindow) maxInWindow = n;
    }
    return { delta: t.length, maxInWindow120ms: maxInWindow };
  }, s0);
  // All 5 layers populated => 10 sources per simultaneous hit column (1 melodic + 1 drum × 5).
  // A rotation would schedule at most 2 per hit column. Burst >= 6 in 120ms proves multi-layer simultaneity.
  expect(burst.delta).toBeGreaterThan(8);
  expect(burst.maxInWindow120ms).toBeGreaterThanOrEqual(6);

  // verify persistence has all five layers/config (per-layer sounds, kits, FX, independent swing)
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('pionier-tonepad-v36')));
  expect(saved.layers).toHaveLength(5);
  expect(saved.drumLayers).toHaveLength(5);
  expect(saved.layerSounds).toEqual(['bloom', 'handpan', 'kalimba', 'marimba', 'bell']);
  expect(saved.drumKits).toEqual(['classic', 'deep', 'punchy', 'lofi', 'tribal']);
  expect(saved.fxDrum[0].swing).toBe(0.4);
  expect(saved.fxDrum[1].swing).toBe(0);

  // Changing the selected editing layer must not stop playback; clearing one layer must not interrupt others.
  await page.locator('.tonepad-layer-btn[data-layer="2"]').click(); // select/edit drum layer 2 while playing
  await expect(playBtn).toHaveAttribute('aria-label', 'Stop');
  await page.locator('[data-clear]').click();
  await expect(playBtn).toHaveAttribute('aria-label', 'Stop');
  const saved2 = await page.evaluate(() => JSON.parse(localStorage.getItem('pionier-tonepad-v36')));
  expect(saved2.drumLayers[2].every((c) => c === 0)).toBe(true);
  expect(saved2.drumLayers[0].some((c) => c === 1)).toBe(true);
  expect(saved2.drumLayers[1].some((c) => c === 1)).toBe(true);
  expect(saved2.drumLayers[3].some((c) => c === 1)).toBe(true);
  expect(saved2.layers[0].some((c) => c === 1)).toBe(true); // melodic layers unaffected

  await playBtn.click();
  await expect(playBtn).toHaveAttribute('aria-label', 'Play');
});
