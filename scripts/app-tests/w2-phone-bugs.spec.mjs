import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/handpan-app/index.html', { waitUntil: 'domcontentloaded' });
  const enter = page.locator('#enterPionier');
  if (await enter.isVisible().catch(() => false)) {
    await enter.click();
    await expect(enter).toBeHidden({ timeout: 8000 });
  }
  await expect.poll(() => page.evaluate(() => window.PionierBootState), { timeout: 15000 }).toBe('ready');
  await expect(page.locator('#pan')).toBeVisible();
  await expect.poll(() => page.evaluate(() => {
    const active = window.PionierCore?.activeInstrument?.();
    return !!active?.audioCtx && !!active?.bus && !!window.PionierCore?.surface?.fields?.length;
  })).toBe(true);
});

test('randomizer is the only way to choose note count and scale/instrument changes preserve it', async ({ page }) => {
  const result = await page.evaluate(async () => {
    const core = window.PionierCore;
    const h = core.handpan;
    const initial = h.noteCount;
    await core.randomizeSetup();
    const random = h.noteCount;
    const { HANDPAN_SCALES } = await import('/handpan-app/js/instruments/handpan.js');
    h.setScaleIndex((h.scaleIndex + 1) % HANDPAN_SCALES.length);
    core.refreshPitch();
    const afterScale = h.noteCount;
    await core.setInstrument('handpan');
    return {
      initial, random, afterScale, afterInstrument: h.noteCount,
      manualControlsHidden: ['notePlusWrap','notePlus','noteMinus','noteCountPrev','noteCountNext','noteCountLabel']
        .every((id) => {
          const el = document.getElementById(id);
          return !el || el.hidden || getComputedStyle(el).display === 'none';
        })
    };
  });
  expect(result.initial).toBe(8);
  expect(result.random).toBeGreaterThanOrEqual(8);
  expect(result.random).toBeLessThanOrEqual(13);
  expect(result.afterScale).toBe(result.random);
  expect(result.afterInstrument).toBe(result.random);
  expect(result.manualControlsHidden).toBe(true);
});

test('changing handpan skin leaves the pan hittable', async ({ page }) => {
  const applied = await page.evaluate(() => {
    const root = document.documentElement;
    const before = root.dataset.skin || 'classic';
    const next = before === 'classic' ? 'bronze' : 'classic';
    root.dataset.skin = next;
    try {
      const raw = localStorage.getItem('pionier.settings');
      const state = raw ? JSON.parse(raw) : {};
      state.skin = next;
      localStorage.setItem('pionier.settings', JSON.stringify(state));
    } catch (_) {}
    try { window.PionierCore?.refreshPitch?.(); } catch (_) {}
    return { before, next, skin: root.dataset.skin };
  });
  expect(applied.skin).toBe(applied.next);
  const pan = page.locator('#pan');
  await expect(pan).toBeVisible();
  const box = await pan.boundingBox();
  expect(box).not.toBeNull();
  await pan.click({ position: { x: box.width / 2, y: box.height / 2 } });
  const playable = await page.evaluate(() => {
    const inst = window.PionierCore?.activeInstrument?.();
    const pe = getComputedStyle(document.getElementById('pan')).pointerEvents;
    return { ok: !!inst && pe !== 'none', id: inst?.id };
  });
  expect(playable.ok).toBe(true);
  expect(playable.id).toBe('handpan');
});

test('core controls expose accessible scale and instrument pickers', async ({ page }) => {
  await expect(page.locator('#instrumentDropdownToggle')).toHaveAttribute('aria-haspopup', 'true');
  await expect(page.locator('#scaleLabel')).toHaveAttribute('aria-haspopup', 'true');
  await expect(page.locator('#rootLabel')).toBeAttached();
  const pe = await page.locator('#pan').evaluate((el) => getComputedStyle(el).pointerEvents);
  expect(pe).not.toBe('none');
});
