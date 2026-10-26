import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/handpan-app/index.html', { waitUntil: 'domcontentloaded' });
  // The welcome screen intentionally covers the play surface until the user enters.
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

test('note-count steppers clamp at 8 and 13', async ({ page }) => {
  await expect.poll(() => page.evaluate(() => !!window.PionierCore?.handpan)).toBe(true);
  await page.evaluate(() => {
    window.PionierCore.handpan.setNoteCount(8);
    window.PionierCore.refreshPitch?.();
  });
  await expect(page.locator('#noteCountLabel')).toHaveText('8');
  await page.locator('#noteCountPrev').click();
  await expect.poll(() => page.evaluate(() => window.PionierCore.handpan.noteCount)).toBe(8);
  await expect(page.locator('#noteCountPrev')).toBeDisabled();

  await page.evaluate(() => {
    window.PionierCore.handpan.setNoteCount(13);
    window.PionierCore.refreshPitch?.();
  });
  await expect(page.locator('#noteCountLabel')).toHaveText('13');
  await page.locator('#noteCountNext').click();
  await expect.poll(() => page.evaluate(() => window.PionierCore.handpan.noteCount)).toBe(13);
  await expect(page.locator('#noteCountNext')).toBeDisabled();
});

test('mobile root steppers change the shared base note', async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.startsWith('mobile'), 'mobile control layout only');
  await expect.poll(() => page.evaluate(() => !!window.PionierCore?.handpan)).toBe(true);
  const before = await page.evaluate(() => window.PionierCore.handpan.rootIndex);
  await page.locator('#rootNext').click();
  await expect.poll(() => page.evaluate(() => window.PionierCore.handpan.rootIndex)).toBe((before + 1) % 12);
  await page.locator('#rootPrev').click();
  await expect.poll(() => page.evaluate(() => window.PionierCore.handpan.rootIndex)).toBe(before);
});

test('note-count steppers keep label in sync from default 8', async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.startsWith('mobile'), 'mobile control layout only');
  const start = await page.evaluate(() => window.PionierCore.handpan.noteCount);
  expect(start).toBeGreaterThanOrEqual(8);
  expect(start).toBeLessThanOrEqual(13);
  await expect(page.locator('#noteCountLabel')).toHaveText(String(start));
  await page.locator('#noteCountNext').click();
  await expect(page.locator('#noteCountLabel')).toHaveText(String(Math.min(13, start + 1)));
  await page.locator('#noteCountPrev').click();
  await expect(page.locator('#noteCountLabel')).toHaveText(String(start));
});

test('changing handpan skin leaves the pan hittable', async ({ page }) => {
  await expect.poll(() => page.evaluate(() => !!window.PionierCore?.handpan)).toBe(true);
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
    if (!inst) return { ok: false };
    const pe = getComputedStyle(document.getElementById('pan')).pointerEvents;
    return { ok: pe !== 'none', pointerEvents: pe, id: inst.id };
  });
  expect(playable.ok).toBe(true);
  expect(playable.id).toBe('handpan');
});

test('core controls expose essential accessible names', async ({ page }) => {
  for (const [sel, name] of [
    ['#noteCountPrev', 'Fewer notes'],
    ['#noteCountNext', 'More notes'],
    ['#rootPrev', 'Previous base note'],
    ['#rootNext', 'Next base note']
  ]) {
    await expect(page.locator(sel)).toHaveAttribute('aria-label', name);
  }
  await expect(page.locator('#scaleLabel')).toHaveAttribute('aria-haspopup', 'true');
  const pe = await page.locator('#pan').evaluate((el) => getComputedStyle(el).pointerEvents);
  expect(pe).not.toBe('none');
});
