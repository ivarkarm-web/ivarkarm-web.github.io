import { test, expect } from '@playwright/test';
import fs from 'node:fs/promises';

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
  // Match the module path independent of its cache-busting query string.
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

test('E Amara uses the owner sample bank and never substitutes synth when samples are missing', async ({ page }) => {
  const setup = await page.evaluate(async () => {
    const instrument = window.PionierCore?.handpan;
    const { HANDPAN_SCALES } = await import('/handpan-app/js/instruments/handpan.js');
    const eamaraIndex = HANDPAN_SCALES.findIndex((scale) => scale.id === 'eamara');
    if (!instrument || eamaraIndex < 0) return { ok: false, reason: 'E Amara scale or handpan missing' };
    instrument.setScaleIndex(eamaraIndex);
    window.PionierCore.refreshPitch();
    if (!instrument.sampleBank) return { ok: false, reason: 'owner sample bank did not initialize' };
    await instrument.sampleBank.load();
    return { ok: true };
  });
  expect(setup.ok, setup.reason).toBe(true);
  await expect.poll(() => page.evaluate(() => !!window.PionierCore?.handpan?.sampleBank?.ready), { timeout: 15000 }).toBe(true);

  const result = await page.evaluate(() => {
    const instrument = window.PionierCore.handpan;
    const firstZone = instrument.getZones?.()?.[0];
    instrument.noteOn({ velocity: 0.8, pointerId: 9281 }, {
      index: firstZone?.index ?? 0, radial: 0.35, angleRad: 0, nx: 0.5, ny: 0.5
    });
    const voice = instrument.activeVoices.values().next().value;
    const data = {
      sampleCount: instrument.sampleBank.byMidi.size,
      sampleReady: instrument.sampleBank.ready,
      voiceKind: voice?.kind,
      voiceCount: instrument.activeVoices.size,
      activeScale: instrument.sampleBank.activeScaleId
    };
    instrument.dampAll();
    return data;
  });
  expect(result.activeScale).toBe('eamara');
  expect(result.sampleReady).toBe(true);
  expect(result.sampleCount).toBeGreaterThanOrEqual(9);
  expect(result.voiceKind).toBe('sample');
  expect(result.voiceCount).toBeGreaterThan(0);
});


test('stale saved instrument selection safely falls back to Handpan', async ({ page }) => {
  await page.evaluate(() => localStorage.setItem('pionier.activeInstrument', 'legacy-removed-instrument'));
  await page.reload();
  await expect(page.locator('#pan')).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.PionierCore?.activeInstrument?.()?.id)).toBe('handpan');
  await expect.poll(() => page.evaluate(() => localStorage.getItem('pionier.activeInstrument'))).toBe('handpan');
});

test('boots the local core without runtime source-fetch errors', async ({ page }, testInfo) => {
  await expect(page.locator('#instrumentMenu')).toBeAttached();
  await expect(page.locator('#mobileControlDrawer')).toBeAttached();
  if (testInfo.project.name.startsWith('mobile')) {
    await expect(page.locator('#mobileControlPanel')).toBeVisible();
  } else {
    await expect(page.locator('#leftSidebar')).toBeVisible();
  }
  await expect(page.locator('#knobMaster')).toBeAttached();
  const boot = await page.evaluate(() => ({
    core: !!window.PionierCore,
    noteCount: window.PionierCore?.noteCount?.(),
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth
  }));
  expect(boot.core).toBe(true);
  expect(boot.noteCount).toBe(8);
  expect(boot.scrollWidth).toBeLessThanOrEqual(boot.clientWidth + 1);
});

for (const [instrumentName, instrumentId] of [
  ['Kalimba', 'kalimba'],
  ['Steel Tongue Drum', 'tongue']
]) {
  test(`${instrumentName} selection activates its actual engine`, async ({ page }) => {
    const trigger = page.locator('#instrumentDropdownToggle');
    const menu = page.locator('#instrumentMenu');
    await trigger.click();
    await expect(menu).toBeVisible();
    await menu.getByRole('menuitem', { name: instrumentName, exact: true }).click();
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
    const tongueDrum = InstrumentRegistry.get('tongue');
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
        InstrumentRegistry.setActive('tongue', ctx, bus)
      ]);
      return { setup: true, activeId: InstrumentRegistry.activeId };
    } finally {
      kalimba.activate = originalKalimba;
      tongueDrum.activate = originalTongueDrum;
      await InstrumentRegistry.setActive('handpan', ctx, bus);
    }
  });
  expect(result.setup).toBe(true);
  expect(result.activeId).toBe('tongue');
  await expect.poll(() => page.evaluate(() => window.PionierCore?.activeInstrument?.()?.id)).toBe('handpan');
});

test('Handpan can be reselected after switching to another instrument', async ({ page }) => {
  const trigger = page.locator('#instrumentDropdownToggle');
  const menu = page.locator('#instrumentMenu');
  await trigger.click();
  await menu.getByRole('menuitem', { name: 'Kalimba', exact: true }).click();
  await expect.poll(() => page.evaluate(() => window.PionierCore?.activeInstrument?.()?.id)).toBe('kalimba');
  await trigger.click();
  await expect(menu).toBeVisible();
  await menu.getByRole('menuitem', { name: 'Handpan', exact: true }).click();
  await expect(trigger).toContainText('Handpan');
  await expect.poll(() => page.evaluate(() => window.PionierCore?.activeInstrument?.()?.id)).toBe('handpan');
  await expect.poll(() => page.evaluate(() => !!window.PionierCore?.activeInstrument?.()?.ready)).toBe(true);
});

test('effect knob advanced-settings control opens its live curve editor', async ({ page }) => {
  await page.locator('#fxPanel').evaluate(el => { el.hidden = false; });
  await page.locator('.fx-settings-shortcut[data-fx-editor-open="filter"]').click();
  await expect(page.locator('#fxEditor')).toBeVisible();
  await expect(page.locator('#fxEditorTitle')).toHaveText('Filter');
  await expect(page.locator('#fxEditorCurve')).toBeVisible();
  await page.locator('#fxEditorPresets .fx-editor-preset-select').click();
  await expect(page.locator('#fxEditorPresets [role="listbox"]')).toBeVisible();
  await expect(page.locator('#fxEditorPresets .fx-preset-option')).toHaveCount(10);
});

test('lowercase s shortcuts open the correct advanced editor for all four effects', async ({ page }) => {
  await page.locator('#fxPanel').evaluate(el => { el.hidden = false; });
  const shortcuts = page.locator('.fx-settings-shortcut[data-fx-editor-open]');
  await expect(shortcuts).toHaveCount(4);
  await expect(shortcuts).toHaveText(['s', 's', 's', 's']);
  const cases = [['compressor', 'Compressor'], ['delay', 'Delay'], ['reverb', 'Reverb'], ['filter', 'Filter']];
  for (const [id, title] of cases) {
    await page.locator('.fx-settings-shortcut[data-fx-editor-open="' + id + '"]').click();
    await expect(page.locator('#fxEditor')).toBeVisible();
    await expect(page.locator('#fxEditorTitle')).toHaveText(title);
    await expect(page.locator('#fxEditorCurve')).toBeVisible();
    await page.locator('#fxEditorClose').click();
  }
});


test('dice randomizer replaces Learn and chooses a new instrument', async ({ page }) => {
  await expect(page.locator('#learnPanel')).toHaveCount(0);
  const before = await page.evaluate(() => window.PionierCore?.activeInstrument?.()?.id);
  await page.locator('#randomizeSetup').click();
  await expect.poll(() => page.evaluate(() => window.PionierCore?.activeInstrument?.()?.id)).not.toBe(before);
  await expect(page.locator('#scaleLabel')).not.toBeEmpty();
});

test('looper timing controls are aligned, count-in toggles, and metronome menu has ten click styles', async ({ page }) => {
  const controls = ['#looperClearBtn','#looperBtn','#looperCountInBtn','#looperMetronomeBtn','#looperBpmBtn'];
  for (const selector of controls) await expect(page.locator(selector)).toBeVisible();
  const sizes = await Promise.all(controls.map(selector => page.locator(selector).boundingBox()));
  for (const size of sizes) {
    expect(size).not.toBeNull();
    expect(Math.abs(size.width - size.height)).toBeLessThanOrEqual(1);
  }
  await page.locator('#looperCountInBtn').click();
  await expect(page.locator('#looperCountInBtn')).toHaveClass(/is-active/);
  await page.locator('#looperCountInBtn').click();
  await expect(page.locator('#looperCountInBtn')).not.toHaveClass(/is-active/);

  await page.locator('#looperCountInBtn').hover();
  await page.mouse.down();
  await page.waitForTimeout(540);
  await expect(page.locator('.looper-timing-menu')).toContainText('Count-in');
  await expect(page.locator('.looper-timing-menu select').first()).toHaveValue('1');
  await page.mouse.up();
  await page.keyboard.press('Escape');
  await page.locator('#looperMetronomeBtn').hover();
  await page.mouse.down();
  await page.waitForTimeout(540);
  await expect(page.locator('.looper-timing-menu')).toBeVisible();
  await expect(page.locator('.looper-click-options .looper-timing-option')).toHaveCount(10);
  await page.mouse.up();
  await page.locator('.looper-click-options').getByRole('button', { name: 'Digital Click' }).click();
  await expect(page.locator('.looper-timing-menu')).toBeVisible();
  await page.keyboard.press('Escape');
  await page.locator('#looperBpmBtn').hover();
  await page.mouse.down();
  await page.waitForTimeout(540);
  await expect(page.locator('.looper-timing-menu')).toContainText('Tempo');
  await expect(page.locator('.looper-bpm-range')).toBeVisible();
  await page.mouse.up();
  await page.keyboard.press('Escape');
  await expect(page.locator('.looper-timing-menu')).toHaveCount(0);
});

test('FX designer fits its responsive layout and opens in the expected position', async ({ page }) => {
  await page.locator('#fxPanel').evaluate(el => { el.hidden = false; });
  await page.locator('.fx-settings-shortcut[data-fx-editor-open="filter"]').click();
  const mainFx = await page.locator('#fxPanel').boundingBox();
  const editor = await page.locator('#fxEditor').boundingBox();
  const viewport = page.viewportSize();
  expect(mainFx).not.toBeNull();
  expect(editor).not.toBeNull();
  expect(editor.x).toBeGreaterThanOrEqual(0);
  expect(editor.x + editor.width).toBeLessThanOrEqual(viewport.width);
  if (viewport.width <= 600) {
    expect(editor.y + editor.height).toBeGreaterThanOrEqual(viewport.height - 2);
  } else {
    expect(editor.width).toBeLessThanOrEqual(620);
    expect(Math.abs(editor.y + editor.height / 2 - viewport.height / 2)).toBeLessThanOrEqual(2);
  }
});

test('Customize opens with a named dialog and dismisses from its backdrop', async ({ page }) => {
  await page.locator('#settingsOpenBtn').click();
  const dialog = page.getByRole('dialog', { name: 'Customize' });
  await expect(dialog).toBeVisible();
  await expect(page.locator('#settingLightMode')).toBeVisible();
  await page.locator('#settingsSheetBackdrop').click({ position: { x: 8, y: 8 } });
  await expect(dialog).toBeHidden();
  await expect(page.locator('#settingsOpenBtn')).toHaveAttribute('aria-expanded', 'false');
});

test('mobile scale controls remain visible without a hidden drawer toggle', async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.startsWith('mobile'), 'portrait layout only');
  await expect(page.locator('#scaleNext')).toBeVisible();
  await expect(page.locator('#looperRootMenuBtn')).toBeVisible();
  await expect(page.locator('#noteCountNext')).toBeHidden();
  await expect(page.locator('#mobileControlsToggle')).toBeHidden();
});

test('Soundscapes opens from the dock and returns to the instrument', async ({ page }) => {
  await page.locator('#openSoundscapes').click();
  const panel = page.locator('#soundscapesPanel');
  await expect(panel).toBeVisible();
  await expect(page.locator('#soundscapeAudio')).toBeAttached();
  await expect(page.locator('#soundscapeQueue .soundscape-queue-item')).toHaveCount(8);
  await page.locator('#closeSoundscapes').click();
  await expect(panel).toBeHidden();
  await expect(page.locator('#pan')).toBeVisible();
});

test('Soundscapes track controls update the selected Bedroom Sessions track', async ({ page }) => {
  await page.locator('#openSoundscapes').click();
  await expect(page.locator('#soundscapesPanel')).toBeVisible();
  await expect(page.locator('#soundscapeTitle')).toContainText('Improvisation 1');
  await page.locator('#soundscapeNext').click();
  await expect(page.locator('#soundscapeTitle')).toContainText('Improvisation 2');
  await page.locator('#soundscapePrev').click();
  await expect(page.locator('#soundscapeTitle')).toContainText('Improvisation 1');
  await page.locator('#closeSoundscapes').click();
});

test('Soundscapes exposes the eight owner recordings without generated ambience beds', async ({ page }) => {
  await page.locator('#openSoundscapes').click();
  await expect(page.locator('#soundscapesPanel')).toBeVisible();
  await expect(page.locator('#soundscapeQueue .soundscape-queue-item')).toHaveCount(8);
  const legacyAmbientPlayer = await page.evaluate(() => !!window.PionierBackdropPlayer);
  expect(legacyAmbientPlayer).toBe(false);
  await expect(page.locator('#ambientFxCanvas')).toHaveAttribute('aria-hidden', 'true');
  await page.locator('#closeSoundscapes').click();
});


test('note count starts at eight; randomizer chooses 8–13 and scale/instrument changes preserve it', async ({ page }) => {
  const result = await page.evaluate(async () => {
    const core = window.PionierCore;
    const handpan = core.handpan;
    const initial = handpan.noteCount;
    await core.randomizeSetup();
    const randomized = handpan.noteCount;
    const { HANDPAN_SCALES } = await import('/handpan-app/js/instruments/handpan.js');
    handpan.setScaleIndex((handpan.scaleIndex + 1) % HANDPAN_SCALES.length);
    core.refreshPitch();
    const afterScale = handpan.noteCount;
    await core.setInstrument('handpan');
    return { initial, randomized, afterScale, afterInstrument: handpan.noteCount };
  });
  expect(result.initial).toBe(8);
  expect(result.randomized).toBeGreaterThanOrEqual(8);
  expect(result.randomized).toBeLessThanOrEqual(13);
  expect(result.afterScale).toBe(result.randomized);
  expect(result.afterInstrument).toBe(result.randomized);
});


test('mobile instrument and scale pickers open and dismiss on outside tap', async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.startsWith('mobile'), 'mobile picker behavior is tested in touch projects');
  await page.locator('#instrumentDropdownToggle').tap();
  await expect(page.locator('#instrumentMenu')).toBeVisible();
  await expect(page.locator('#instrumentMenu button[role="menuitem"]').first()).toBeVisible();
  await page.mouse.click(10, 10);
  await expect(page.locator('#instrumentMenu')).toBeHidden();

  await page.locator('#scaleLabel').tap();
  await expect(page.locator('#scaleMenu')).toBeVisible();
  await expect(page.locator('#scaleMenu .scale-menu-item').first()).toBeVisible();
  await page.mouse.click(10, 10);
  await expect(page.locator('#scaleMenu')).toBeHidden();

  const touchAction = await page.locator('#pan').evaluate((canvas) => getComputedStyle(canvas).pointerEvents);
  expect(touchAction).not.toBe('none');
  await expect(page.locator('#noteCountNext')).toBeHidden();
  await expect.poll(() => page.evaluate(() => window.PionierCore.handpan.noteCount)).toBe(8);
});

test('desktop scale and base-note selectors update the shared handpan state', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name.startsWith('mobile'), 'desktop control layout only');
  await page.setViewportSize({ width: 1280, height: 800 });
  const before = await page.evaluate(() => ({
    scale: window.PionierCore.handpan.scaleIndex,
    root: window.PionierCore.handpan.rootIndex,
    scaleCount: window.HANDPAN_SCALES.length
  }));
  await page.locator('#scaleNext').click();
  await expect.poll(() => page.evaluate(() => window.PionierCore.handpan.scaleIndex)).toBe((before.scale + 1) % before.scaleCount);
  await page.locator('#scaleLabel').click();
  await expect(page.locator('#scaleMenu')).toBeVisible();
  await expect(page.locator('#scaleLabel')).toHaveAttribute('aria-expanded', 'true');
  await page.locator('#looperRootMenuBtn').click();
  await expect(page.locator('#looperRootMenu')).toBeVisible();
  const targetRoot = (before.root + 1) % 12;
  await page.locator('#looperRootMenu button[role="option"]').nth(targetRoot).click();
  await expect.poll(() => page.evaluate(() => window.PionierCore.handpan.rootIndex)).toBe(targetRoot);
});


test('Loop Studio is reachable and seven-layer controls fit the viewport', async ({ page }) => {
  await expect.poll(() => page.evaluate(() => !!window.PionierLooper)).toBe(true);
  await expect(page.locator('#pionierBottomDock')).toBeVisible();
  await expect(page.locator('#pionierLooperToolbar')).toBeVisible();
  await expect(page.locator('#looperBtn')).toBeVisible();
  await expect(page.locator('#looperExportBtn')).toBeDisabled();
  const state = await page.evaluate(() => window.PionierLooper.getState());
  expect(state.maxLayers).toBe(7);
  const bounds = await page.locator('#looperBtn').boundingBox();
  const viewport = page.viewportSize();
  expect(bounds).not.toBeNull();
  expect(bounds.x).toBeGreaterThanOrEqual(0);
  expect(bounds.y).toBeGreaterThanOrEqual(0);
  expect(bounds.x + bounds.width).toBeLessThanOrEqual(viewport.width);
  expect(bounds.y + bounds.height).toBeLessThanOrEqual(viewport.height);
});

test('Loop Studio exports a valid WAV mix after a track exists', async ({ page }) => {
  await expect.poll(() => page.evaluate(() => !!window.PionierLooper)).toBe(true);
  await page.evaluate(() => {
    const ctx = window.PionierCore.activeInstrument().audioCtx;
    const length = Math.floor(ctx.sampleRate * 0.12);
    const buffer = ctx.createBuffer(2, length, ctx.sampleRate);
    for (let channel = 0; channel < 2; channel++) {
      const data = buffer.getChannelData(channel);
      for (let i = 0; i < data.length; i++) data[i] = Math.sin(2 * Math.PI * 220 * i / ctx.sampleRate) * 0.15;
    }
    window.PionierLooper.layers.push({
      buffer, level: 0.8, pan: 0, offset: 0, muted: false, solo: false, paused: false
    });
    window.PionierLooper.refresh();
  });
  const downloadPromise = page.waitForEvent('download');
  await page.locator('#looperExportBtn').click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe('pionier-loop.wav');
  const filePath = await download.path();
  const wav = await fs.readFile(filePath);
  expect(wav.subarray(0, 4).toString('ascii')).toBe('RIFF');
  expect(wav.subarray(8, 12).toString('ascii')).toBe('WAVE');
  expect(wav.readUInt16LE(20)).toBe(1);
  expect(wav.readUInt16LE(22)).toBe(2);
  expect(wav.readUInt16LE(34)).toBe(16);
  expect(wav.readUInt32LE(40)).toBe(wav.length - 44);
  expect(wav.length).toBeGreaterThan(44);
});


test('Loop Studio records and overdubs a second independent track', async ({ page }) => {
  await expect.poll(() => page.evaluate(() => !!window.PionierLooper)).toBe(true);
  const record = page.locator('#looperBtn');
  const strike = () => page.evaluate(async () => {
    const core = window.PionierCore;
    const instrument = core.handpan;
    const field = core.surface.fields[0];
    instrument.noteOn({ velocity: 0.9, pressure: 0.9 }, { ...field, index: field.index ?? 0 });
    await new Promise(resolve => setTimeout(resolve, 80));
    instrument.dampAll();
  });
  await record.click();
  await page.waitForFunction(() => window.PionierLooper.getState().recording);
  await strike();
  await page.waitForTimeout(240);
  await record.click();
  await expect.poll(() => page.evaluate(() => window.PionierLooper.getState().layerCount)).toBe(1);

  await record.click();
  await page.waitForFunction(() => window.PionierLooper.getState().recording);
  await expect(record).toHaveAttribute('data-recording-layer', '2');
  await expect(record).toHaveClass(/is-recording/);
  await strike();
  await page.waitForTimeout(80);
  await record.click();
  await expect.poll(() => page.evaluate(() => window.PionierLooper.getState().layerCount)).toBe(2);
  const layers = await page.evaluate(() => window.PionierLooper.layers.map(layer => {
    const samples = layer.buffer.getChannelData(0);
    let peak = 0;
    for (let i = 0; i < samples.length; i++) peak = Math.max(peak, Math.abs(samples[i]));
    return { duration: layer.buffer.duration, peak };
  }));
  expect(layers).toHaveLength(2);
  expect(layers.every(layer => Number.isFinite(layer.duration) && layer.duration > 0.1)).toBe(true);
  expect(layers.every(layer => layer.peak > 0.01)).toBe(true);
});

test('Loop Studio records seven synchronized layers, blocks an eighth, and preserves master controls', async ({ page }) => {
  test.setTimeout(60000);
  await expect.poll(() => page.evaluate(() => !!window.PionierLooper)).toBe(true);
  const record = page.locator('#looperBtn');
  const strike = (holdMs = 70) => page.evaluate(async (duration) => {
    const core = window.PionierCore;
    const instrument = core.handpan;
    const field = core.surface.fields[0];
    instrument.noteOn({ velocity: 0.95, pressure: 0.95 }, { ...field, index: field.index ?? 0 });
    await new Promise(resolve => setTimeout(resolve, duration));
    instrument.dampAll();
  }, holdMs);

  for (let target = 1; target <= 7; target++) {
    await record.click();
    await page.waitForFunction(() => window.PionierLooper.getState().recording);
    if (target > 1) {
      await expect(record).toHaveAttribute('data-recording-layer', String(target));
      await expect(record).toHaveClass(/is-recording/);
    }
    await strike();
    if (target === 1) await page.waitForTimeout(240);
    else await page.waitForTimeout(35);
    await record.click();
    await expect.poll(() => page.evaluate(() => window.PionierLooper.getState().layerCount), { timeout: 5000 }).toBe(target);
  }

  const beforeEditing = await page.evaluate(() => {
    const state = window.PionierLooper.getState();
    const masterDuration = window.PionierLooper.layers[0].buffer.duration;
    return {
      state,
      masterDuration,
      transport: window.PionierLooper.getTransportState(),
      layers: window.PionierLooper.layers.map(layer => {
        const samples = layer.buffer.getChannelData(0);
        let peak = 0;
        for (let i = 0; i < samples.length; i++) peak = Math.max(peak, Math.abs(samples[i]));
        return {
          duration: layer.buffer.duration,
          peak,
          playing: !layer.paused && !!layer.source,
          startOffset: layer.startedAt - window.PionierLooper.layers[0].startedAt,
        };
      }),
      masterClass: document.querySelector('.looper-circle')?.className,
      masterLabel: document.querySelector('.looper-circle')?.getAttribute('aria-label'),
    };
  });
  expect(beforeEditing.state.maxLayers).toBe(7);
  expect(beforeEditing.state.layerCount).toBe(7);
  expect(beforeEditing.transport.hasMaster).toBe(true);
  expect(beforeEditing.layers).toHaveLength(7);
  expect(beforeEditing.layers.every(layer => layer.peak > 0.01 && layer.playing)).toBe(true);
  expect(beforeEditing.masterClass).toContain('is-master');
  expect(beforeEditing.masterLabel).toBe('Layer 1, master');
  for (const layer of beforeEditing.layers) {
    const multiples = layer.duration / beforeEditing.masterDuration;
    expect(Math.abs(multiples - Math.round(multiples))).toBeLessThan(0.001);
    const phase = ((layer.startOffset % beforeEditing.masterDuration) + beforeEditing.masterDuration) % beforeEditing.masterDuration;
    expect(Math.min(phase, beforeEditing.masterDuration - phase)).toBeLessThan(0.025);
  }

  const circles = page.locator('.looper-circle');
  await expect(circles).toHaveCount(7);
  for (let i = 0; i < 7; i++) await expect(circles.nth(i)).toHaveAccessibleName(i === 0 ? 'Layer 1, master' : 'Layer ' + (i + 1));
  await expect(record).toBeDisabled();
  await expect(record).toHaveAttribute('aria-label', 'Max layers (7)');
  await record.evaluate(button => {
    const init = { bubbles: true, cancelable: true, pointerId: 902, pointerType: 'mouse', button: 0 };
    button.dispatchEvent(new PointerEvent('pointerdown', { ...init, buttons: 1 }));
    button.dispatchEvent(new PointerEvent('pointerup', { ...init, buttons: 0 }));
  });
  await page.waitForTimeout(100);
  await expect.poll(() => page.evaluate(() => window.PionierLooper.getState().layerCount)).toBe(7);

  await circles.nth(6).click();
  await expect.poll(() => page.evaluate(() => window.PionierLooper.layers[6].paused)).toBe(true);
  await circles.nth(6).click();
  await expect.poll(() => page.evaluate(() => !window.PionierLooper.layers[6].paused && !!window.PionierLooper.layers[6].source)).toBe(true);

  const masterDuration = beforeEditing.masterDuration;
  await circles.nth(6).hover();
  await page.mouse.down();
  await page.waitForTimeout(520);
  await page.mouse.up();
  await expect(page.locator('.looper-track-panel')).toHaveAttribute('aria-label', 'Track 7 controls');
  await expect.poll(() => page.evaluate(() => window.PionierLooper.getState().layerCount)).toBe(7);
  await page.locator('.looper-track-delete').click();
  await expect.poll(() => page.evaluate(() => window.PionierLooper.getState().layerCount)).toBe(6);
  const afterDeleteTransport = await page.evaluate(() => ({
    duration: window.PionierLooper.getTransportState().duration,
    hasMaster: window.PionierLooper.getTransportState().hasMaster,
    paused: window.PionierLooper.layers[0].paused,
  }));
  expect(afterDeleteTransport.duration).toBe(masterDuration);
  expect(afterDeleteTransport.hasMaster).toBe(true);
  expect(afterDeleteTransport.paused).toBe(false);

  await page.locator('#looperClearBtn').click();
  await expect.poll(() => page.evaluate(() => window.PionierLooper.getState().layerCount)).toBe(0);
  await expect.poll(() => page.evaluate(() => window.PionierLooper.getTransportState().hasMaster)).toBe(false);
  await expect(record).toBeEnabled();
});

test('Loop Studio keeps a second layer when the recorder flushes one valid chunk', async ({ page }) => {
  await page.addInitScript(() => {
    const NativeAudioWorkletNode = window.AudioWorkletNode;
    window.__limitLooperRecorderToOneNonSilentChunk = false;
    window.__looperCapturedNonSilentChunks = 0;
    window.AudioWorkletNode = class extends NativeAudioWorkletNode {
      constructor(...args) {
        super(...args);
        const port = this.port;
        let handler = null;
        let listener = null;
        Object.defineProperty(port, 'onmessage', {
          configurable: true,
          get: () => handler,
          set: (next) => {
            handler = next;
            if (listener) return;
            listener = (event) => {
              const data = event.data;
              if (data?.left && window.__limitLooperRecorderToOneNonSilentChunk
                && window.PionierLooper?.getState().recording) {
                let peak = 0;
                for (let i = 0; i < data.left.length; i++) peak = Math.max(peak, Math.abs(data.left[i]));
                if (peak <= 0.01 || window.__looperCapturedNonSilentChunks) return;
                window.__looperCapturedNonSilentChunks += 1;
              }
              handler?.call(port, event);
            };
            port.addEventListener('message', listener);
            port.start();
          }
        });
      }
    };
  });
  await page.reload({ waitUntil: 'domcontentloaded' });
  const enter = page.locator('#enterPionier');
  if (await enter.isVisible().catch(() => false)) await enter.click();
  await expect.poll(() => page.evaluate(() => window.PionierBootState), { timeout: 15000 }).toBe('ready');

  const record = page.locator('#looperBtn');
  const pressRecord = () => page.evaluate(() => {
    const button = document.querySelector('#looperBtn');
    const init = { bubbles: true, cancelable: true, pointerId: 901, pointerType: 'mouse', button: 0 };
    button.dispatchEvent(new PointerEvent('pointerdown', { ...init, buttons: 1 }));
    button.dispatchEvent(new PointerEvent('pointerup', { ...init, buttons: 0 }));
  });
  const strike = (holdMs) => page.evaluate(async (duration) => {
    const core = window.PionierCore;
    const instrument = core.handpan;
    const field = core.surface.fields[0];
    const index = field.index ?? 0;
    instrument.noteOn({ velocity: 0.9, pressure: 0.9 }, { ...field, index });
    await new Promise(resolve => setTimeout(resolve, duration));
    instrument.dampAll();
  }, holdMs);

  await pressRecord();
  await page.waitForFunction(() => window.PionierLooper.getState().recording);
  await strike(160);
  await page.waitForTimeout(260);
  await pressRecord();
  await expect.poll(() => page.evaluate(() => window.PionierLooper.getState().layerCount)).toBe(1);

  await page.evaluate(() => { window.__limitLooperRecorderToOneNonSilentChunk = true; });
  await pressRecord();
  await page.waitForFunction(() => window.PionierLooper.getState().recording, null, { polling: 'raf' });
  await strike(240);
  await pressRecord();
  await expect.poll(() => page.evaluate(() => {
    const state = window.PionierLooper.getState();
    return !state.recording && !state.pendingLoopStop;
  }), { timeout: 2000 }).toBe(true);

  const result = await page.evaluate(() => {
    const layer = window.PionierLooper.layers[1];
    if (!layer) return { layerCount: window.PionierLooper.getState().layerCount, capturedChunks: window.__looperCapturedNonSilentChunks };
    const data = layer.buffer.getChannelData(0);
    let peak = 0;
    for (let i = 0; i < data.length; i++) peak = Math.max(peak, Math.abs(data[i]));
    return { layerCount: window.PionierLooper.getState().layerCount, capturedChunks: window.__looperCapturedNonSilentChunks, duration: layer.buffer.duration, peak };
  });
  expect(result.capturedChunks).toBe(1);
  expect(result.layerCount).toBe(2);
  expect(result.duration).toBeGreaterThan(0);
  expect(result.peak).toBeGreaterThan(0.01);
});
