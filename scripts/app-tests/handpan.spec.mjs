import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/handpan-app/index.html', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#pan')).toBeVisible();
  await expect(page.locator('#instrumentDropdownToggle')).toBeVisible();
  await expect.poll(() => page.evaluate(() => {
    const active = window.PionierCore?.activeInstrument?.();
    return !!active?.audioCtx && !!active?.bus && !!window.PionierCore?.surface?.fields?.length;
  })).toBe(true);
});



test('required core boot failure shows recovery UI and retry reloads successfully', async ({ page }) => {
  let failOnce = true;
  await page.route(/pionier-core\.js\?v=\d+/, async (route) => {
    if (failOnce) {
      failOnce = false;
      await route.fulfill({ status: 503, contentType: 'text/javascript', body: '/* simulated temporary outage */' });
    } else {
      await route.continue();
    }
  });
  await page.reload();
  await expect(page.locator('#appStatus')).toBeVisible();
  await expect(page.locator('#appStatusMessage')).toContainText('could not start');
  await page.locator('#appStatusRetry').click();
  await expect.poll(() => page.evaluate(() => !!window.PionierCore)).toBe(true);
  await expect(page.locator('#appStatus')).toBeHidden();
});

test('audio context unavailability is visible while the app shell remains present', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'AudioContext', { configurable: true, value: undefined });
    Object.defineProperty(window, 'webkitAudioContext', { configurable: true, value: undefined });
  });
  await page.reload();
  await expect(page.locator('#appStatus')).toBeVisible();
  await expect(page.locator('#appStatusMessage')).toContainText('audio output');
  await expect.poll(() => page.evaluate(() => window.PionierCore?.health?.().audioAvailable)).toBe(false);
  await expect(page.locator('#pan')).toBeVisible();
});

test('blocked storage is reported as degraded without breaking Handpan', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'localStorage', { configurable: true, get() { throw new Error('storage blocked by test'); } });
  });
  await page.reload();
  await expect(page.locator('#appStatus')).toBeVisible();
  await expect(page.locator('#appStatusMessage')).toContainText('saved settings');
  await expect.poll(() => page.evaluate(() => window.PionierCore?.activeInstrument?.()?.id)).toBe('handpan');
  await expect.poll(() => page.evaluate(() => window.PionierCore?.health?.().storageAvailable)).toBe(false);
});

test('optional soundscapes module failure leaves core playable and reports degraded state', async ({ page }) => {
  let failOnce = true;
  let intercepted = false;
  await page.route('**/js/soundscapes.js*', async (route) => {
    if (failOnce) {
      failOnce = false;
      intercepted = true;
      await route.fulfill({ status: 503, contentType: 'text/javascript', body: '/* simulated optional module outage */' });
    } else {
      await route.continue();
    }
  });
  await page.reload();
  await expect.poll(() => intercepted).toBe(true);
  await expect(page.locator('#appStatus')).toBeVisible();
  await expect(page.locator('#appStatusMessage')).toContainText('Soundscapes');
  await expect.poll(() => page.evaluate(() => !!window.PionierCore?.activeInstrument?.())).toBe(true);
});
test('viewport keeps browser zoom available while the instrument canvas owns gestures', async ({ page }) => {
  const viewport = await page.locator('meta[name="viewport"]').getAttribute('content');
  expect(viewport).toContain('width=device-width');
  expect(viewport).not.toMatch(/user-scalable\s*=\s*no/i);
  expect(viewport).not.toMatch(/maximum-scale\s*=\s*1(?:\.0)?/i);
  const canvasTouchAction = await page.locator('#pan').evaluate((canvas) => getComputedStyle(canvas).touchAction);
  expect(canvasTouchAction).toBe('none');
});

test('rapid touch taps on scale steppers are not swallowed', async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.startsWith('mobile'), 'touchscreen emulation runs in the mobile projects');
  await expect.poll(() => page.evaluate(() => !!window.PionierCore?.activeInstrument?.())).toBe(true);
  const next = page.locator('#scaleNext');
  await expect(next).toBeVisible();
  const before = await page.evaluate(() => window.PionierCore.activeInstrument().scaleIndex);
  const scaleCount = await page.evaluate(async () => {
    const { HANDPAN_SCALES } = await import('/handpan-app/js/instruments/handpan.js');
    return HANDPAN_SCALES.length;
  });
  for (let i = 0; i < 4; i++) await next.tap();
  await expect.poll(() => page.evaluate(() => window.PionierCore.activeInstrument().scaleIndex))
    .toBe((before + 4) % scaleCount);
});



test('rapid pad strikes each retrigger and release cleanly', async ({ page }) => {
  const result = await page.evaluate(() => {
    const canvas = document.querySelector('#pan');
    const inst = window.PionierCore.activeInstrument();
    const originalHitVector = window.PionierCore.surface.hitVector.bind(window.PionierCore.surface);
    const field = window.PionierCore.surface.fields[0];
    const hit = { ...field, index: field.index ?? 0, x: field.x ?? 0, y: field.y ?? 0, radial: field.radial ?? 0.4, angleRad: field.angleRad ?? 0 };
    window.PionierCore.surface.hitVector = () => hit;
    let on = 0;
    let off = 0;
    const originalOn = inst.noteOn.bind(inst);
    const originalOff = inst.noteOff.bind(inst);
    inst.noteOn = (...args) => { on++; return originalOn(...args); };
    inst.noteOff = (...args) => { off++; return originalOff(...args); };
    const send = (type, pointerId) => canvas.dispatchEvent(new PointerEvent(type, {
      bubbles: true, cancelable: true, pointerId, pointerType: 'touch',
      clientX: canvas.getBoundingClientRect().left + canvas.clientWidth / 2,
      clientY: canvas.getBoundingClientRect().top + canvas.clientHeight / 2,
      button: 0, buttons: type === 'pointerdown' ? 1 : 0, pressure: type === 'pointerdown' ? 0.8 : 0
    }));
    send('pointerdown', 41); send('pointerup', 41);
    send('pointerdown', 42); send('pointerup', 42);
    const counts = { on, off };
    inst.noteOn = originalOn; inst.noteOff = originalOff;
    window.PionierCore.surface.hitVector = originalHitVector;
    return counts;
  });
  expect(result.on).toBe(2);
  expect(result.off).toBe(2);
});

test('multitouch on one pad does not damp the note until the last pointer releases', async ({ page }) => {
  const result = await page.evaluate(() => {
    const canvas = document.querySelector('#pan');
    const inst = window.PionierCore.activeInstrument();
    const originalHitVector = window.PionierCore.surface.hitVector.bind(window.PionierCore.surface);
    const field = window.PionierCore.surface.fields[0];
    const hit = { ...field, index: field.index ?? 0, x: field.x ?? 0, y: field.y ?? 0, radial: field.radial ?? 0.4, angleRad: field.angleRad ?? 0 };
    window.PionierCore.surface.hitVector = () => hit;
    let on = 0;
    let off = 0;
    const originalOn = inst.noteOn.bind(inst);
    const originalOff = inst.noteOff.bind(inst);
    inst.noteOn = (...args) => { on++; return originalOn(...args); };
    inst.noteOff = (...args) => { off++; return originalOff(...args); };
    const send = (type, pointerId) => canvas.dispatchEvent(new PointerEvent(type, {
      bubbles: true, cancelable: true, pointerId, pointerType: 'touch',
      clientX: canvas.getBoundingClientRect().left + canvas.clientWidth / 2,
      clientY: canvas.getBoundingClientRect().top + canvas.clientHeight / 2,
      button: 0, buttons: type === 'pointerdown' ? 1 : 0, pressure: type === 'pointerdown' ? 0.8 : 0
    }));
    send('pointerdown', 51);
    send('pointerdown', 52);
    send('pointerup', 51);
    const offAfterFirstRelease = off;
    send('pointerup', 52);
    const counts = { on, offAfterFirstRelease, off };
    inst.noteOn = originalOn; inst.noteOff = originalOff;
    window.PionierCore.surface.hitVector = originalHitVector;
    return counts;
  });
  expect(result.on).toBe(1);
  expect(result.offAfterFirstRelease).toBe(0);
  expect(result.off).toBe(1);
});
