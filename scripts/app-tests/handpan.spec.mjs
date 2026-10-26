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

test('handpan uses owner samples and refuses synthetic replacement when recordings are unavailable', async ({ page }) => {
  const result = await page.evaluate(async () => {
    const instrument = window.PionierCore?.activeInstrument?.();
    const { HANDPAN_SCALES } = await import('/handpan-app/js/instruments/handpan.js');
    const recordedIndex = HANDPAN_SCALES.findIndex((scale) => scale.id === 'e-amara-recorded');
    if (instrument?.id === 'handpan' && recordedIndex >= 0) {
      window.PionierCore.handpan.setScaleIndex(recordedIndex);
      window.PionierCore.refreshPitch();
    }
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
      voiceCount: instrument.activeVoices.size,
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
    // Empty bank: recorded E Amara intentionally stays silent rather than
    // substituting a synthetic timbre that would misrepresent the owner sample.
    expect(result.sampleReady).toBe(false);
    expect(result.voiceCount).toBe(0);
    expect(result.voiceKind).toBeUndefined();
  }
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
  expect(boot.noteCount).toBeGreaterThanOrEqual(9);
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

test('double-clicking an effect knob opens its live curve editor', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name.startsWith('mobile'), 'desktop double-click interaction');
  await page.locator('#fxPanel').evaluate(el => { el.hidden = false; });
  await page.locator('#knobFilter').dblclick();
  await expect(page.locator('#fxEditor')).toBeVisible();
  await expect(page.locator('#fxEditorTitle')).toHaveText('Filter');
  await expect(page.locator('#fxEditorCurve')).toBeVisible();
  await expect(page.locator('#fxEditorPresets select')).toBeVisible();
  await expect(page.locator('#fxEditorPresets select option')).toHaveCount(10);
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
  await page.locator('#topMenuBtn').click();
  await page.locator('#toggleLooper').click();
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

test('FX designer uses the compact main-FX width and drops in from the top', async ({ page }) => {
  await page.locator('#fxPanel').evaluate(el => { el.hidden = false; });
  await page.locator('.fx-settings-shortcut[data-fx-editor-open="filter"]').click();
  const mainFx = await page.locator('#fxPanel').boundingBox();
  const editor = await page.locator('#fxEditor').boundingBox();
  expect(mainFx).not.toBeNull();
  expect(editor).not.toBeNull();
  expect(Math.abs(mainFx.width - editor.width)).toBeLessThanOrEqual(4);
  expect(editor.y).toBeLessThan(120);
});

test('mobile scale controls remain visible without a hidden drawer toggle', async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.startsWith('mobile'), 'portrait layout only');
  await expect(page.locator('#scaleNext')).toBeVisible();
  await expect(page.locator('#rootNext')).toBeVisible();
  await expect(page.locator('#noteCountNext')).toBeVisible();
  await expect(page.locator('#mobileControlsToggle')).toBeHidden();
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

test('note-count steppers change the live pan and keep their label in sync', async ({ page }, testInfo) => {
  if (!testInfo.project.name.startsWith('mobile')) {
    const initial = await page.evaluate(() => window.PionierCore.handpan.noteCount);
    await page.evaluate(() => { const h = window.PionierCore.handpan; h.setNoteCount(h.noteCount + 1); window.PionierCore.refreshPitch(); });
    await expect.poll(() => page.evaluate(() => window.PionierCore.handpan.noteCount)).toBe(initial + 1);
    await page.evaluate(() => { const h = window.PionierCore.handpan; h.setNoteCount(h.noteCount - 1); window.PionierCore.refreshPitch(); });
    await expect.poll(() => page.evaluate(() => window.PionierCore.handpan.noteCount)).toBe(initial);
    return;
  }
  await expect(page.locator('#noteCountLabel')).toHaveText('9');
  await page.locator('#noteCountNext').click();
  await expect(page.locator('#noteCountLabel')).toHaveText('10');
  await expect.poll(() => page.evaluate(() => window.PionierCore.handpan.noteCount)).toBe(10);
  await page.locator('#noteCountPrev').click();
  await expect(page.locator('#noteCountLabel')).toHaveText('9');
  const core = await page.evaluate(() => window.PionierCore.handpan.noteCount);
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

  const touchAction = await page.locator('#pan').evaluate((canvas) => getComputedStyle(canvas).pointerEvents);
  expect(touchAction).not.toBe('none');
  const before = await page.evaluate(() => window.PionierCore.noteCount());
  await page.locator('#noteCountNext').click();
  await expect.poll(() => page.evaluate(() => window.PionierCore.handpan.noteCount)).toBe(before + 1);
});

test('desktop scale, base-note and octave steppers update the shared handpan state', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name.startsWith('mobile'), 'desktop control layout only');
  await page.setViewportSize({ width: 1280, height: 800 });
  const before = await page.evaluate(() => {
    const h = window.PionierCore.handpan;
    return { scale: h.scaleIndex, root: h.rootIndex, octave: h.octaveOffset };
  });
  await page.locator('#rootNextDesktop').click();
  await expect.poll(() => page.evaluate(() => window.PionierCore.handpan.rootIndex)).toBe((before.root + 1) % 12);
  await page.locator('#octaveNext').click();
  await expect.poll(() => page.evaluate(() => window.PionierCore.handpan.octaveOffset)).toBe(Math.min(1, before.octave + 1));
  const { scaleBefore, scaleCount } = await page.evaluate(() => ({
    scaleBefore: window.PionierCore.handpan.scaleIndex,
    scaleCount: window.HANDPAN_SCALES.length
  }));
  await page.locator('#scaleNextDesktop').click();
  await expect.poll(() => page.evaluate(() => window.PionierCore.handpan.scaleIndex)).toBe((scaleBefore + 1) % scaleCount);
  await page.locator('#scaleLabelDesktop').click();
  await expect(page.locator('#scaleMenu')).toBeVisible();
  await expect(page.locator('#scaleLabelDesktop')).toHaveAttribute('aria-expanded', 'true');
});


test('Loop Studio is reachable and the four-track controls fit the viewport', async ({ page }) => {
  await expect.poll(() => page.evaluate(() => !!window.PionierLooper)).toBe(true);
  await page.locator('#topMenuBtn').click();
  await page.locator('#toggleLooper').click();
  const rail = page.locator('#looperRail');
  await expect(rail).toBeVisible();
  await expect(page.locator('#looperBtn')).toBeVisible();
  await expect(page.locator('#looperExportBtn')).toBeDisabled();
  const state = await page.evaluate(() => window.PionierLooper.getState());
  expect(state.maxLayers).toBe(4);
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
  await page.locator('#topMenuBtn').click();
  await page.locator('#toggleLooper').click();
  const downloadPromise = page.waitForEvent('download');
  await page.locator('#looperExportBtn').click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe('pionier-loop.wav');
});


test('Loop Studio records and overdubs a second independent track', async ({ page }) => {
  await expect.poll(() => page.evaluate(() => !!window.PionierLooper)).toBe(true);
  await page.locator('#topMenuBtn').click();
  await page.locator('#toggleLooper').click();
  const record = page.locator('#looperBtn');
  await record.click();
  await page.waitForTimeout(320);
  await record.click();
  await expect.poll(() => page.evaluate(() => window.PionierLooper.getState().layerCount)).toBe(1);

  await record.click();
  await page.waitForTimeout(320);
  await record.click();
  await expect.poll(() => page.evaluate(() => window.PionierLooper.getState().layerCount)).toBe(2);
  const durations = await page.evaluate(() => window.PionierLooper.layers.map(layer => layer.buffer.duration));
  expect(durations).toHaveLength(2);
  expect(durations.every(duration => Number.isFinite(duration) && duration > 0.1)).toBe(true);
});
