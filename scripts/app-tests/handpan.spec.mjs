import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/handpan-app/index.html');
  await expect(page.locator('#pan')).toBeVisible();
  await expect(page.locator('#instrumentDropdownToggle')).toBeVisible();
  await expect.poll(() => page.evaluate(() => {
    const active = window.PionierCore?.activeInstrument?.();
    return !!active?.audioCtx && !!active?.bus && !!window.PionierCore?.surface?.fields?.length;
  })).toBe(true);
});



test('required core boot failure shows recovery UI and retry reloads successfully', async ({ page }) => {
  let failOnce = true;
  await page.route(/pionier-core\.js\?v=1/, async (route) => {
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
  await page.route(/soundscapes\.js\?v=5/, async (route) => {
    if (failOnce) {
      failOnce = false;
      await route.fulfill({ status: 503, contentType: 'text/javascript', body: '/* simulated optional module outage */' });
    } else {
      await route.continue();
    }
  });
  await page.reload();
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
  await page.locator('#mobileControlsToggle').tap();
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



test('handpan uses owner samples when present, otherwise synth fallback', async ({ page }) => {
  const result = await page.evaluate(async () => {
    const instrument = window.PionierCore?.activeInstrument?.();
    if (!instrument?.sampleBank) return { setup: false };
    await instrument.sampleBank.load();
    const firstZone = instrument.getZones?.()?.[0];
    instrument.noteOn({ velocity: 0.8, pointerId: 9281 }, {
      index: firstZone?.index ?? 0, radial: 0.35, angleRad: 0, nx: 0.5, ny: 0.5
    });
    const voice = instrument.activeVoices.values().next().value;
    const result = {
      setup: true,
      sampleCount: instrument.sampleBank.byMidi.size,
      sampleReady: instrument.sampleBank.ready,
      voiceKind: voice?.kind,
      status: instrument.sampleBank.manifest?.status || null
    };
    instrument.dampAll();
    return result;
  });
  expect(result.setup).toBe(true);
  if (result.sampleCount > 0) {
    // Owner-prototype bank is loaded.
    expect(result.sampleReady).toBe(true);
    expect(result.sampleCount).toBeGreaterThanOrEqual(9);
    expect(['sample', 'synth']).toContain(result.voiceKind);
  } else {
    // Empty bank → procedural synth fallback.
    expect(result.sampleReady).toBe(false);
    expect(result.voiceKind).toBe('synth');
  }
});

test('stale saved instrument selection safely falls back to Handpan', async ({ page }) => {
  await page.evaluate(() => localStorage.setItem('pionier.activeInstrument', 'legacy-removed-instrument'));
  await page.reload();
  await expect(page.locator('#pan')).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.PionierCore?.activeInstrument?.()?.id)).toBe('handpan');
  await expect.poll(() => page.evaluate(() => localStorage.getItem('pionier.activeInstrument'))).toBe('handpan');
});

test('boots the local core without runtime source-fetch errors', async ({ page }) => {
  await expect(page.locator('#instrumentMenu')).toBeAttached();
  await expect(page.locator('#mobileControlDrawer')).toBeAttached();
  await page.locator('#mobileControlsToggle').click();
  await expect(page.locator('#mobileControlDrawer')).toHaveClass(/is-open/);
  await expect(page.locator('#knobMaster')).toBeAttached();
  const boot = await page.evaluate(() => ({
    core: !!window.PionierCore,
    noteCount: window.PionierCore?.noteCount?.(),
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth
  }));
  expect(boot.core).toBe(true);
  expect(boot.noteCount).toBeGreaterThanOrEqual(9);
  expect(boot.scrollWidth).toBeLessThanOrEqual(boot.clientWidth + 1);
});

for (const [instrumentName, instrumentId] of [
  ['Kalimba', 'kalimba'],
  ['Tongue Drum', 'tongue-drum']
]) {
  test(`${instrumentName} selection activates its actual engine`, async ({ page }) => {
    const trigger = page.locator('#instrumentDropdownToggle');
    const menu = page.locator('#instrumentMenu');
    await trigger.click();
    await expect(menu).toBeVisible();
    await menu.getByRole('button', { name: instrumentName, exact: true }).click();
    await expect(trigger).toContainText(instrumentName);
    await expect.poll(() => page.evaluate(() => window.PionierCore?.activeInstrument?.()?.id)).toBe(instrumentId);
    await expect.poll(() => page.evaluate(() => !!window.PionierCore?.activeInstrument?.()?.ready)).toBe(true);
    const voiceCount = await page.evaluate(() => {
      const instrument = window.PionierCore?.activeInstrument?.();
      if (!instrument?.audioCtx || !instrument?.bus) return 0;
      const firstZone = instrument.getZones?.()?.[0];
      const index = firstZone?.index ?? firstZone?.i ?? 0;
      instrument.noteOn({ velocity: 0.8, pointerId: 9201 }, {
        index, radial: 0.35, angleRad: 0, nx: 0.5, ny: 0.5
      });
      const count = instrument.activeVoices?.size ?? 0;
      instrument.dampAll?.();
      return count;
    });
    expect(voiceCount).toBeGreaterThan(0);
  });
}

test('rapid instrument selections resolve in the order the user chose them', async ({ page }) => {
  const result = await page.evaluate(async () => {
    const { InstrumentRegistry } = await import('/handpan-app/js/instrument.js');
    const ctx = window.PionierCore?.activeInstrument?.()?.audioCtx;
    const bus = window.PionierCore?.activeInstrument?.()?.bus;
    const kalimba = InstrumentRegistry.get('kalimba');
    const tongueDrum = InstrumentRegistry.get('tongue-drum');
    if (!ctx || !bus || !kalimba || !tongueDrum) return { setup: false };
    const originalKalimba = kalimba.activate;
    const originalTongueDrum = tongueDrum.activate;
    kalimba.activate = async function (audioCtx, output) {
      await new Promise((resolve) => setTimeout(resolve, 90));
      return originalKalimba.call(this, audioCtx, output);
    };
    tongueDrum.activate = async function (audioCtx, output) {
      await new Promise((resolve) => setTimeout(resolve, 10));
      return originalTongueDrum.call(this, audioCtx, output);
    };
    try {
      await Promise.all([
        InstrumentRegistry.setActive('kalimba', ctx, bus),
        InstrumentRegistry.setActive('tongue-drum', ctx, bus)
      ]);
      return { setup: true, activeId: InstrumentRegistry.activeId };
    } finally {
      kalimba.activate = originalKalimba;
      tongueDrum.activate = originalTongueDrum;
      await InstrumentRegistry.setActive('handpan', ctx, bus);
    }
  });
  expect(result.setup).toBe(true);
  expect(result.activeId).toBe('tongue-drum');
  await expect.poll(() => page.evaluate(() => window.PionierCore?.activeInstrument?.()?.id)).toBe('handpan');
});

test('Handpan can be reselected after switching to another instrument', async ({ page }) => {
  const trigger = page.locator('#instrumentDropdownToggle');
  const menu = page.locator('#instrumentMenu');
  await trigger.click();
  await menu.getByRole('button', { name: 'Kalimba', exact: true }).click();
  await expect.poll(() => page.evaluate(() => window.PionierCore?.activeInstrument?.()?.id)).toBe('kalimba');
  await trigger.click();
  await expect(menu).toBeVisible();
  await menu.getByRole('button', { name: 'Handpan', exact: true }).click();
  await expect(trigger).toContainText('Handpan');
  await expect.poll(() => page.evaluate(() => window.PionierCore?.activeInstrument?.()?.id)).toBe('handpan');
  await expect.poll(() => page.evaluate(() => !!window.PionierCore?.activeInstrument?.()?.ready)).toBe(true);
});

test('effect type menus open and update their selected state', async ({ page }) => {
  await page.locator('#mobileControlsToggle').click();
  await page.locator('.knob-effect-trigger[aria-controls="bubbleComp"]').click();
  const bubble = page.locator('#bubbleComp');
  await expect(bubble).toBeVisible();
  await bubble.getByRole('button', { name: 'Punch', exact: true }).click();
  await expect(bubble.locator('[data-comp="punch"]')).toHaveAttribute('aria-pressed', 'true');
});

test('controls drawer toggles and keeps its expanded state accessible', async ({ page }) => {
  const toggle = page.locator('#mobileControlsToggle');
  const drawer = page.locator('#mobileControlDrawer');
  await toggle.click();
  await expect(drawer).toHaveClass(/is-open/);
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  await toggle.click();
  await expect(drawer).not.toHaveClass(/is-open/);
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
});

test('Soundscapes opens from the app menu and returns to the instrument', async ({ page }) => {
  await page.locator('#topMenuBtn').click();
  await expect(page.locator('#appMenu')).toBeVisible();
  await page.locator('#tabSoundscapes').click();
  const soundscapes = page.locator('#soundscapesPage');
  await expect(soundscapes).toHaveClass(/is-active/);
  await expect(page.locator('#soundscapeAudio')).toBeAttached();
  await expect(page.locator('#soundscapeQueue .soundscape-queue-item')).toHaveCount(8);
  await page.locator('#tabHandpanFromSS').click();
  await expect(soundscapes).not.toHaveClass(/is-active/);
  await expect(page.locator('#pan')).toBeVisible();
});

test('Soundscapes track controls update the selected Bedroom Sessions track', async ({ page }) => {
  await page.locator('#topMenuBtn').click();
  await page.locator('#tabSoundscapes').click();
  await expect(page.locator('#soundscapeTitle')).toContainText('Improvisation 1');
  await page.locator('#soundscapeNext').click();
  await expect(page.locator('#soundscapeTitle')).toContainText('Improvisation 2');
  await page.locator('#soundscapePrev').click();
  await expect(page.locator('#soundscapeTitle')).toContainText('Improvisation 1');
});

test('Soundscapes exposes the User-Created collection without generated ambience beds', async ({ page }) => {
  await page.locator('#topMenuBtn').click();
  await page.locator('#tabSoundscapes').click();
  await page.locator('#soundscapeCommunityTab').click();
  await expect(page.locator('#soundscapeCommunityQueue')).toBeAttached();
  const legacyAmbientPlayer = await page.evaluate(() => !!window.PionierBackdropPlayer);
  expect(legacyAmbientPlayer).toBe(false);
  await expect(page.locator('#ambientFxCanvas')).toHaveCount(0);
});

test('note-count controls add and remove notes without losing the instrument core', async ({ page }) => {
  await expect(page.locator('#notePlusCount')).toHaveText('9/13');
  await page.locator('#notePlus').click();
  await expect(page.locator('#notePlusCount')).toHaveText('10/13');
  await expect(page.locator('#noteMinus')).toBeVisible();
  await page.locator('#noteMinus').click();
  await expect(page.locator('#notePlusCount')).toHaveText('9/13');
  const core = await page.evaluate(() => window.PionierCore.noteCount());
  expect(core).toBe(9);
});


test('mobile instrument and scale pickers open as visible, tappable sheets', async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.startsWith('mobile'), 'mobile picker behavior is tested in touch projects');
  await page.locator('#instrumentDropdownToggle').tap();
  await expect(page.locator('#instrumentMenu')).toBeVisible();
  await expect(page.locator('#instrumentMenu button[role="menuitem"]').first()).toBeVisible();
  await page.locator('#pickerBackdrop').tap({ position: { x: 10, y: 10 } });
  await expect(page.locator('#instrumentMenu')).toBeHidden();

  await page.locator('#scaleLabel').tap();
  await expect(page.locator('#scaleMenu')).toBeVisible();
  await expect(page.locator('#scaleMenu .scale-menu-item').first()).toBeVisible();
  await page.locator('#pickerBackdrop').tap({ position: { x: 10, y: 10 } });
  await expect(page.locator('#scaleMenu')).toBeHidden();
});

test('desktop scale, base-note and octave steppers update the shared handpan state', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  const before = await page.evaluate(() => {
    const h = window.PionierCore.handpan;
    return { scale: h.scaleIndex, root: h.rootIndex, octave: h.octaveOffset };
  });
  await page.locator('#scaleNextDesktop').click();
  await page.locator('#rootNextDesktop').click();
  await page.locator('#octaveNext').click();
  await expect.poll(() => page.evaluate(() => {
    const h = window.PionierCore.handpan;
    return { scale: h.scaleIndex, root: h.rootIndex, octave: h.octaveOffset };
  })).toEqual({ scale: before.scale + 1, root: (before.root + 1) % 12, octave: Math.min(1, before.octave + 1) });
  await page.locator('#scaleLabelDesktop').click();
  await expect(page.locator('#scaleMenu')).toBeVisible();
  await expect(page.locator('#scaleLabelDesktop')).toHaveAttribute('aria-expanded', 'true');
});
