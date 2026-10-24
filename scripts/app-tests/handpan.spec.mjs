import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/handpan-app/index.html', { waitUntil: 'domcontentloaded' });

  // The product intentionally opens on the welcome screen. Tests in this file
  // exercise the instrument, so enter it explicitly before asserting app UI.
  const enter = page.locator('#enterPionier');
  if (await enter.isVisible().catch(() => false)) {
    await enter.click();
    await expect(page.locator('#pionierWelcome')).toBeHidden({ timeout: 5000 });
  }

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

test('handpan always uses its synthesized voice and has no sample-bank runtime', async ({ page }) => {
  const result = await page.evaluate(async () => {
    const core = window.PionierCore;
    const instrument = core?.activeInstrument?.();
    if (!instrument || instrument.id !== 'handpan') return { ready: false };
    core.ensureAudio?.();
    const zone = instrument.getZones?.()?.[0];
    instrument.noteOn({ velocity: 0.8, pointerId: 9281 }, {
      index: zone?.index ?? 0, radial: 0.35, angleRad: 0, nx: 0.5, ny: 0.5
    });
    const voice = instrument.activeVoices.values().next().value;
    const result = {
      ready: !!instrument.ready,
      engineKind: instrument.engineKind,
      hasSampleBank: Object.prototype.hasOwnProperty.call(instrument, 'sampleBank'),
      voiceKind: voice?.kind,
      voiceCount: instrument.activeVoices.size,
      hasSynthHandle: !!voice?.handle
    };
    instrument.dampAll();
    return result;
  });
  expect(result.ready).toBe(true);
  expect(result.engineKind).toBe('synth');
  expect(result.hasSampleBank).toBe(false);
  expect(result.voiceCount).toBeGreaterThan(0);
  expect(result.hasSynthHandle).toBe(true);
  expect(result.voiceKind).toBe('lib');
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
    await expect(page.locator('.sidebar.left')).toBeVisible();
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


test('dice randomizer changes the setup without a learning panel', async ({ page }) => {
  await expect(page.locator('#learnPanel')).toHaveCount(0);
  const before = await page.evaluate(() => ({
    instrument: window.PionierCore?.activeInstrument?.()?.id,
    scale: window.PionierCore?.handpan?.scaleIndex,
    root: window.PionierCore?.handpan?.rootIndex
  }));
  await page.locator('#randomizeSetup').click();
  await expect.poll(() => page.evaluate((previous) => {
    const core = window.PionierCore;
    return core?.activeInstrument?.()?.id !== previous.instrument
      || core?.handpan?.scaleIndex !== previous.scale
      || core?.handpan?.rootIndex !== previous.root;
  }, before)).toBe(true);
  await expect(page.locator('#scaleLabel')).not.toBeEmpty();
});


test('looper timing controls work and remain inside the viewport', async ({ page }) => {
  await expect.poll(() => page.evaluate(() => !!window.PionierLooper)).toBe(true);
  const controls = ['#looperClearBtn','#looperBtn','#looperCountInBtn','#looperMetronomeBtn','#looperBpmBtn'];
  for (const selector of controls) await expect(page.locator(selector)).toBeVisible();
  const viewport = page.viewportSize();
  for (const selector of controls) {
    const bounds = await page.locator(selector).boundingBox();
    expect(bounds).not.toBeNull();
    expect(bounds.x).toBeGreaterThanOrEqual(0);
    expect(bounds.y).toBeGreaterThanOrEqual(0);
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(viewport.width);
    expect(bounds.y + bounds.height).toBeLessThanOrEqual(viewport.height);
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
  await expect(page.locator('#mobileControlsToggle')).toBeHidden();
});


test('Soundscapes opens from the instrument controls and returns to the instrument', async ({ page }) => {
  await page.locator('#openSoundscapes').click();
  const panel = page.locator('#soundscapesPanel');
  await expect(panel).toBeVisible();
  await expect(page.locator('#soundscapeAudio')).toBeAttached();
  await expect(page.locator('#soundscapeQueue [data-track-index]')).toHaveCount(8);
  await page.locator('#closeSoundscapes').click();
  await expect(panel).toBeHidden();
  await expect(page.locator('#pan')).toBeVisible();
});

test('Soundscapes track controls update the selected Bedroom Sessions track', async ({ page }) => {
  await page.locator('#openSoundscapes').click();
  await expect(page.locator('#soundscapeTitle')).toContainText('Improvisation 1');
  await page.locator('#soundscapeNext').click();
  await expect(page.locator('#soundscapeTitle')).toContainText('Improvisation 2');
  await page.locator('#soundscapePrev').click();
  await expect(page.locator('#soundscapeTitle')).toContainText('Improvisation 1');
});

test('Soundscapes exposes only the owner Bedroom Sessions collection', async ({ page }) => {
  await page.locator('#openSoundscapes').click();
  await expect(page.locator('#soundscapeBedroomTab')).toBeVisible();
  await expect(page.locator('#soundscapeQueue [data-track-index]')).toHaveCount(8);
  await expect(page.locator('#soundscapeCommunityTab')).toHaveCount(0);
  await expect(page.locator('#ambientFxCanvas')).toHaveCount(0);
});


test('base-note and scale controls update the shared handpan state', async ({ page }) => {
  const before = await page.evaluate(() => ({
    scale: window.PionierCore.handpan.scaleIndex,
    root: window.PionierCore.handpan.rootIndex,
    scaleCount: window.HANDPAN_SCALES.length
  }));
  await page.locator('#rootNext').click();
  await expect.poll(() => page.evaluate(() => window.PionierCore.handpan.rootIndex))
    .toBe((before.root + 1) % 12);
  await page.locator('#scaleNext').click();
  await expect.poll(() => page.evaluate(() => window.PionierCore.handpan.scaleIndex))
    .toBe((before.scale + 1) % before.scaleCount);
});


test('mobile instrument and scale pickers open as visible, tappable sheets', async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.startsWith('mobile'), 'mobile picker behavior is tested in touch projects');
  await page.locator('#instrumentDropdownToggle').tap();
  await expect(page.locator('#instrumentMenu')).toBeVisible();
  await expect(page.locator('#instrumentMenu button[role="menuitem"]').first()).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('#instrumentMenu')).toBeHidden();

  await page.locator('#scaleLabel').tap();
  await expect(page.locator('#scaleMenu')).toBeVisible();
  await expect(page.locator('#scaleMenu .scale-menu-item').first()).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('#scaleMenu')).toBeHidden();

  const touchAction = await page.locator('#pan').evaluate((canvas) => getComputedStyle(canvas).touchAction);
  expect(touchAction).toBe('none');
  const before = await page.evaluate(() => window.PionierCore.handpan.rootIndex);
  await page.locator('#rootNext').tap();
  await expect.poll(() => page.evaluate(() => window.PionierCore.handpan.rootIndex)).toBe((before + 1) % 12);
});


test('desktop scale and base-note steppers update the shared handpan state', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name.startsWith('mobile'), 'desktop control layout only');
  await page.setViewportSize({ width: 1280, height: 800 });
  const before = await page.evaluate(() => ({
    scale: window.PionierCore.handpan.scaleIndex,
    root: window.PionierCore.handpan.rootIndex,
    scaleCount: window.HANDPAN_SCALES.length
  }));
  await page.locator('#rootNext').click();
  await expect.poll(() => page.evaluate(() => window.PionierCore.handpan.rootIndex)).toBe((before.root + 1) % 12);
  await page.locator('#scaleNext').click();
  await expect.poll(() => page.evaluate(() => window.PionierCore.handpan.scaleIndex)).toBe((before.scale + 1) % before.scaleCount);
  await page.locator('#scaleLabel').click();
  await expect(page.locator('#scaleMenu')).toBeVisible();
  await expect(page.locator('#scaleLabel')).toHaveAttribute('aria-expanded', 'true');
});


test('Loop Studio is reachable and the four-track controls fit the viewport', async ({ page }) => {
  await expect.poll(() => page.evaluate(() => !!window.PionierLooper)).toBe(true);
  const rail = page.locator('#looperRail');
  await expect(rail).toBeVisible();
  await expect(page.locator('#looperBtn')).toBeVisible();
  await expect(page.locator('#looperExportBtn')).toBeHidden();
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
  await expect(page.locator('#looperExportBtn')).toBeVisible();
  await expect(page.locator('#looperExportBtn')).toBeEnabled();
  const downloadPromise = page.waitForEvent('download');
  await page.locator('#looperExportBtn').click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe('pionier-loop.wav');
});


test('Loop Studio records and overdubs a second independent track', async ({ page }) => {
  await expect.poll(() => page.evaluate(() => !!window.PionierLooper)).toBe(true);
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

