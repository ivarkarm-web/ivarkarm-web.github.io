import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/handpan-app/index.html');
  await expect(page.locator('#pan')).toBeVisible();
  await expect.poll(() => page.evaluate(() => {
    const active = window.PionierCore?.activeInstrument?.();
    return !!active?.audioCtx && !!active?.bus && !!window.PionierCore?.surface?.fields?.length;
  })).toBe(true);
});

test('200 rapid strikes stop superseded oscillators and preserve the newest voice', async ({ page }) => {
  test.setTimeout(90_000);
  await page.addInitScript(() => {
    window.__voiceNodeAudit = { created: 0, ended: 0 };
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC?.prototype?.createOscillator) return;
    const original = AC.prototype.createOscillator;
    AC.prototype.createOscillator = function (...args) {
      const node = original.apply(this, args);
      window.__voiceNodeAudit.created++;
      node.addEventListener('ended', () => { window.__voiceNodeAudit.ended++; });
      return node;
    };
  });
  await page.reload();
  await expect.poll(() => page.evaluate(() => {
    const inst = window.PionierCore?.activeInstrument?.();
    return !!inst?.audioCtx && !!inst?.bus && !!window.__voiceNodeAudit;
  }), { timeout: 20_000 }).toBe(true);
  await page.locator('#pan').click({ position: { x: 40, y: 40 } });
  await expect.poll(() => page.evaluate(() => {
    const ctx = window.PionierCore?.activeInstrument?.()?.audioCtx;
    return ctx?.state === 'running' || ctx?.state === 'suspended';
  }), { timeout: 15_000 }).toBe(true);
  await page.evaluate(async () => {
    const ctx = window.PionierCore.activeInstrument().audioCtx;
    if (ctx && ctx.state !== 'running') {
      try { await ctx.resume(); } catch (_) {}
    }
  });
  const result = await page.evaluate(async () => {
    const inst = window.PionierCore.activeInstrument();
    const audit = window.__voiceNodeAudit;
    const beforeCreated = audit.created;
    const beforeEnded = audit.ended;
    const zone = { index: 0, radial: 0.42, angleRad: 0 };
    let newest = null;
    for (let i = 0; i < 200; i++) {
      inst.noteOn({ velocity: 0.65, pressure: 0.6, pointerId: i + 1000 }, zone);
      newest = inst.activeVoices.get(0);
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
    const newestPreserved = inst.activeVoices.get(0) === newest;
    const peakVoices = inst.activeVoices.size;
    inst.dampAll();
    const deadline = performance.now() + 4000;
    while (performance.now() < deadline) {
      if (audit.ended - beforeEnded >= audit.created - beforeCreated && inst.activeVoices.size === 0) break;
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    return {
      newestPreserved,
      peakVoices,
      created: audit.created - beforeCreated,
      ended: audit.ended - beforeEnded,
      remainingVoices: inst.activeVoices.size
    };
  });
  expect(result.newestPreserved).toBe(true);
  expect(result.peakVoices).toBe(1);
  expect(result.created).toBeGreaterThan(0);
  expect(result.ended).toBe(result.created);
  expect(result.remainingVoices).toBe(0);
});
