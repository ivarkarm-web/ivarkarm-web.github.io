/**
 * Current-behaviour end-to-end checks (written 2026-10-24 against the vendored core + looper).
 * Guards the failure that bit production: app stuck on "Starting Pionier…" after the welcome screen.
 */
import { test, expect } from '@playwright/test';

async function enter(page) {
  await page.goto('/handpan-app/index.html', { waitUntil: 'domcontentloaded' });
  const enterBtn = page.locator('#enterPionier');
  await expect(enterBtn).toBeVisible();
  await enterBtn.click();
  await page.waitForFunction(() => window.PionierBootState === 'ready' || window.PionierBootState === 'failed', null, { timeout: 15000 });
}

test('boots to ready after Enter with no errors and no remote code', async ({ page }) => {
  const errors = [];
  const external = new Set();
  const origin = new URL(page.url() === 'about:blank' ? 'http://127.0.0.1:4173' : page.url()).origin;
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('request', (r) => { const u = new URL(r.url()); if (u.protocol.startsWith('http') && u.origin !== 'http://127.0.0.1:4173') external.add(u.origin); });

  await enter(page);
  expect(await page.evaluate(() => window.PionierBootState)).toBe('ready');
  await expect(page.locator('#appStatus')).toBeHidden();
  expect(await page.evaluate(() => !!window.PionierCore)).toBe(true);
  expect(errors).toEqual([]);
  expect([...external]).toEqual([]);
  void origin;
});

test('core, looper and FX share one running AudioContext', async ({ page }) => {
  await enter(page);
  await expect.poll(() => page.evaluate(() => window.PionierCore?.getAudioContext?.()?.state), { timeout: 10000 }).toBe('running');
  const same = await page.evaluate(() => window.PionierCore.getAudioContext() === window.HandpanAudio.getAudioContext());
  expect(same).toBe(true);
  expect(await page.evaluate(() => !!window.PionierLooper)).toBe(true);
});

test('recording a loop captures real audio and shows a radial waveform donut', async ({ page }) => {
  await enter(page);
  await expect.poll(() => page.evaluate(() => !!window.PionierLooper), { timeout: 10000 }).toBe(true);
  const rec = page.locator('#looperBtn');
  await rec.click();
  const box = await page.locator('#pan').boundingBox();
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    await page.mouse.move(box.x + box.width / 2 + Math.cos(a) * box.width * 0.28, box.y + box.height / 2 + Math.sin(a) * box.width * 0.28);
    await page.mouse.down(); await page.waitForTimeout(60); await page.mouse.up();
    await page.waitForTimeout(300);
  }
  await rec.click();
  await expect(page.locator('.looper-circle')).toHaveCount(1, { timeout: 5000 });
  const info = await page.evaluate(() => {
    const b = window.PionierLooper.layers[0].buffer;
    const d = b.getChannelData(0);
    let peak = 0;
    for (let i = 0; i < d.length; i++) { const v = Math.abs(d[i]); if (v > peak) peak = v; }
    return { seconds: b.duration, peak };
  });
  expect(info.seconds).toBeGreaterThan(1);
  expect(info.peak).toBeGreaterThan(0.01);
  await expect(page.locator('.looper-circle .looper-circle-wave')).toHaveCount(1);
});
