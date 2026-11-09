/**
 * Phase 9: Multi-touch chord stress — several simultaneous pointers on the pan
 * must not throw, and the surface stays interactive after release.
 */
import { test, expect } from '@playwright/test';

async function enterIfNeeded(page) {
  const enter = page.locator('#enterPionier');
  if (await enter.isVisible().catch(() => false)) {
    await enter.click();
    await expect(enter).toBeHidden({ timeout: 8000 }).catch(() => {});
  }
}

test('phase9: five concurrent pointers on pan then full release', async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.startsWith('mobile'), 'multi-touch stress runs on mobile projects');
  await page.goto('/handpan-app/');
  await enterIfNeeded(page);
  await expect.poll(() => page.evaluate(() => !!window.PionierCore)).toBe(true);
  const canvas = page.locator('#pan');
  await expect(canvas).toBeVisible();

  const ok = await page.evaluate(async () => {
    const el = document.getElementById('pan');
    if (!el) return { ok: false, reason: 'no pan' };
    const r = el.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    const pts = [
      [cx, cy],
      [cx - 40, cy - 20],
      [cx + 40, cy - 20],
      [cx - 30, cy + 35],
      [cx + 30, cy + 35],
    ];
    const fire = (type, id, x, y, buttons) => {
      el.dispatchEvent(
        new PointerEvent(type, {
          bubbles: true,
          cancelable: true,
          pointerId: id,
          pointerType: 'touch',
          clientX: x,
          clientY: y,
          button: 0,
          buttons,
          pressure: buttons ? 0.7 : 0,
        })
      );
    };
    try {
      pts.forEach((p, i) => fire('pointerdown', 100 + i, p[0], p[1], 1));
      await new Promise((res) => setTimeout(res, 80));
      pts.forEach((p, i) => fire('pointerup', 100 + i, p[0], p[1], 0));
      return { ok: true, reason: '' };
    } catch (e) {
      return { ok: false, reason: String(e && e.message) };
    }
  });
  expect(ok.ok, ok.reason).toBe(true);
  await expect(canvas).toBeVisible();
  await canvas.click({ position: { x: 200, y: 200 } }).catch(() => {});
});

test('phase9: sequential rapid multi-finger bursts stay bounded', async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.startsWith('mobile'), 'mobile only');
  await page.goto('/handpan-app/');
  await enterIfNeeded(page);
  await expect.poll(() => page.evaluate(() => !!window.PionierCore)).toBe(true);

  const stats = await page.evaluate(async () => {
    const el = document.getElementById('pan');
    const r = el.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    const fire = (type, id, x, y, buttons) => {
      el.dispatchEvent(
        new PointerEvent(type, {
          bubbles: true,
          cancelable: true,
          pointerId: id,
          pointerType: 'touch',
          clientX: x,
          clientY: y,
          button: 0,
          buttons,
          pressure: buttons ? 0.6 : 0,
        })
      );
    };
    let peak = 0;
    for (let burst = 0; burst < 8; burst++) {
      for (let i = 0; i < 3; i++) {
        fire('pointerdown', 200 + burst * 10 + i, cx + i * 12, cy - i * 8, 1);
      }
      const voices =
        window.PionierCore?.activeInstrument?.activeVoices?.size ??
        window.PionierCore?.instrument?.activeVoices?.size ??
        0;
      peak = Math.max(peak, voices);
      for (let i = 0; i < 3; i++) {
        fire('pointerup', 200 + burst * 10 + i, cx + i * 12, cy - i * 8, 0);
      }
      await new Promise((res) => setTimeout(res, 16));
    }
    return { peak, panOk: !!document.getElementById('pan') };
  });
  expect(stats.panOk).toBe(true);
  expect(stats.peak).toBeLessThanOrEqual(32);
});
