import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/handpan-app/index.html');
  await expect(page.locator('#pan')).toBeVisible();
  await expect(page.locator('#instrumentDropdownToggle')).toBeVisible();
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
  ['Bird', 'bird'],
  ['Kitchen', 'kitchen'],
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
    const bird = InstrumentRegistry.get('bird');
    const kitchen = InstrumentRegistry.get('kitchen');
    if (!ctx || !bus || !bird || !kitchen) return { setup: false };
    const originalBird = bird.activate;
    const originalKitchen = kitchen.activate;
    bird.activate = async function (audioCtx, output) {
      await new Promise((resolve) => setTimeout(resolve, 90));
      return originalBird.call(this, audioCtx, output);
    };
    kitchen.activate = async function (audioCtx, output) {
      await new Promise((resolve) => setTimeout(resolve, 10));
      return originalKitchen.call(this, audioCtx, output);
    };
    try {
      await Promise.all([
        InstrumentRegistry.setActive('bird', ctx, bus),
        InstrumentRegistry.setActive('kitchen', ctx, bus)
      ]);
      return { setup: true, activeId: InstrumentRegistry.activeId };
    } finally {
      bird.activate = originalBird;
      kitchen.activate = originalKitchen;
      await InstrumentRegistry.setActive('handpan', ctx, bus);
    }
  });
  expect(result.setup).toBe(true);
  expect(result.activeId).toBe('kitchen');
  await expect.poll(() => page.evaluate(() => window.PionierCore?.activeInstrument?.()?.id)).toBe('handpan');
});

test('Handpan can be reselected after switching to another instrument', async ({ page }) => {
  const trigger = page.locator('#instrumentDropdownToggle');
  const menu = page.locator('#instrumentMenu');
  await trigger.click();
  await menu.getByRole('button', { name: 'Bird', exact: true }).click();
  await expect.poll(() => page.evaluate(() => window.PionierCore?.activeInstrument?.()?.id)).toBe('bird');
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

test('Soundscapes swipe transition opens and returns without reloading the instrument', async ({ page }) => {
  const canvas = page.locator('#pan');
  const rect = await canvas.boundingBox();
  expect(rect).not.toBeNull();
  const x = rect.x + rect.width * 0.72;
  const y = rect.y + rect.height * 0.5;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x - 150, y + 2, { steps: 8 });
  await page.mouse.up();
  const soundscapes = page.locator('#soundscapesPage');
  await expect(soundscapes).toHaveClass(/is-active/);
  await expect(page.locator('#app')).toHaveClass(/soundscapes-away/);
  await expect(page.locator('#mandalaWrap canvas')).toBeAttached();
  const stage = await page.locator('.soundscapes-stage').boundingBox();
  const sx = stage.x + stage.width * 0.5;
  const sy = stage.y + stage.height * 0.18;
  await page.mouse.move(sx, sy);
  await page.mouse.down();
  await page.mouse.move(sx + 150, sy + 2, { steps: 8 });
  await page.mouse.up();
  await expect(soundscapes).not.toHaveClass(/is-active/);
  await expect(page.locator('#app')).not.toHaveClass(/soundscapes-away/);
  await expect(page.locator('#pan')).toBeVisible();
});

test('adding Soundscapes audio appends to the playlist without replacing the current track', async ({ page }) => {
  await page.locator('#openSoundscapes').click();
  await expect(page.locator('#soundscapesPage')).toHaveClass(/is-active/);
  await expect(page.locator('#mobileControlDrawer')).not.toHaveClass(/is-open/);
  await expect(page.locator('#mobileControlsToggle')).toHaveAttribute('aria-expanded', 'false');
  const input = page.locator('#soundscapeFile');
  const makeWav = () => {
    const samples = 800;
    const wav = Buffer.alloc(44 + samples * 2);
    wav.write('RIFF', 0); wav.writeUInt32LE(36 + samples * 2, 4); wav.write('WAVE', 8);
    wav.write('fmt ', 12); wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22);
    wav.writeUInt32LE(8000, 24); wav.writeUInt32LE(16000, 28); wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34);
    wav.write('data', 36); wav.writeUInt32LE(samples * 2, 40);
    for (let i = 0; i < samples; i++) wav.writeInt16LE(Math.round(Math.sin(i * Math.PI / 12) * 5000), 44 + i * 2);
    return wav;
  };
  await input.setInputFiles([{ name: 'first.wav', mimeType: 'audio/wav', buffer: makeWav() }]);
  await expect(page.locator('#soundscapeTrackTitle')).toHaveText('first');
  await expect.poll(() => page.locator('#soundscapeAudio').evaluate((audio) => audio.src.startsWith('blob:'))).toBe(true);
  await expect.poll(() => page.locator('#soundscapeAudio').evaluate((audio) => audio.readyState >= 1)).toBe(true);
  await input.setInputFiles([{ name: 'second.wav', mimeType: 'audio/wav', buffer: makeWav() }]);
  await expect(page.locator('#soundscapeTrackTitle')).toHaveText('first');
  await expect(page.locator('#soundscapeTrackSubtitle')).toHaveText('TRACK 1 / 2');
  await expect(page.locator('#soundscapeStatus')).toHaveText('1 TRACK ADDED');
  await page.locator('#mandalaNextTrack').click();
  await expect(page.locator('#soundscapeTrackTitle')).toHaveText('second');
  await expect(page.locator('#soundscapeTrackSubtitle')).toHaveText('TRACK 2 / 2');
});

test('Soundscapes shortcut opens the player and the back control returns', async ({ page }) => {
  await page.locator('#openSoundscapes').click();
  await expect(page.locator('#soundscapesPage')).toHaveClass(/is-active/);
  await page.locator('#backToHandpan').click();
  await expect(page.locator('#soundscapesPage')).not.toHaveClass(/is-active/);
  await expect(page.locator('#pan')).toBeVisible();
});

test('Soundscapes reuses the FX drawer and exposes track playback controls', async ({ page }) => {
  await page.locator('#mobileControlsToggle').click();
  await expect(page.locator('#mobileControlDrawer')).toHaveClass(/is-open/);
  await expect(page.locator('#knobMaster')).toBeAttached();
  await expect(page.locator('#soundscapeVolume')).toBeAttached();
  await expect(page.locator('#soundscapePlayback')).toBeAttached();
  await expect(page.locator('#mandalaPreviousTrack')).toBeAttached();
  await expect(page.locator('#mandalaNextTrack')).toBeAttached();
  await expect(page.locator('#mandalaPlay')).toBeAttached();
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


test('a shared pad stays sounding until the final pointer releases it', async ({ page }) => {
  await page.evaluate(() => {
    const canvas = document.getElementById('pan');
    const surface = window.PionierCore.surface;
    const field = surface.fields.find((item) => item.playable);
    const rect = canvas.getBoundingClientRect();
    const { W, H } = surface.metrics;
    const x = rect.left + (field.x / W) * rect.width;
    const y = rect.top + (field.y / H) * rect.height;
    const fire = (type, pointerId) => canvas.dispatchEvent(new PointerEvent(type, {
      bubbles: true, cancelable: true, pointerId, pointerType: 'touch',
      isPrimary: pointerId === 701, clientX: x, clientY: y, pressure: type === 'pointerup' ? 0 : 0.7
    }));
    window.__sharedPadTest = { fire };
    fire('pointerdown', 701);
    fire('pointerdown', 702);
    fire('pointerup', 701);
  });
  const afterFirstRelease = await page.evaluate(() => {
    const voice = window.PionierCore.activeInstrument().activeVoices.values().next().value;
    return { count: window.PionierCore.activeInstrument().activeVoices.size, released: voice?.released ?? true };
  });
  expect(afterFirstRelease.count).toBeGreaterThan(0);
  expect(afterFirstRelease.released).toBe(false);
  await page.evaluate(() => window.__sharedPadTest.fire('pointerup', 702));
  await expect.poll(() => page.evaluate(() => {
    const voice = window.PionierCore.activeInstrument().activeVoices.values().next().value;
    return !voice || voice.released === true;
  })).toBe(true);
});

test('window blur clears held pointers and prevents stuck notes', async ({ page }) => {
  await page.evaluate(() => {
    const canvas = document.getElementById('pan');
    const surface = window.PionierCore.surface;
    const field = surface.fields.find((item) => item.playable);
    const rect = canvas.getBoundingClientRect();
    const { W, H } = surface.metrics;
    canvas.dispatchEvent(new PointerEvent('pointerdown', {
      bubbles: true, cancelable: true, pointerId: 703, pointerType: 'touch',
      isPrimary: true, clientX: rect.left + (field.x / W) * rect.width,
      clientY: rect.top + (field.y / H) * rect.height, pressure: 0.7
    }));
    window.dispatchEvent(new Event('blur'));
  });
  await expect.poll(() => page.evaluate(() => {
    const voice = window.PionierCore.activeInstrument().activeVoices.values().next().value;
    return !voice || voice.released === true;
  })).toBe(true);
});

test('rapid pointer strikes do not throw and canvas remains inside the viewport', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const canvas = page.locator('#pan');
  const rect = await canvas.boundingBox();
  const viewport = page.viewportSize();
  expect(rect).not.toBeNull();
  expect(viewport).not.toBeNull();
  expect(rect.x).toBeGreaterThanOrEqual(0);
  expect(rect.x + rect.width).toBeLessThanOrEqual(viewport.width + 1);
  const { x, y, width, height } = rect;
  for (const [dx, dy] of [[0.5,0.5],[0.35,0.35],[0.65,0.35],[0.35,0.65],[0.65,0.65],[0.5,0.5]]) {
    await page.mouse.click(x + width * dx, y + height * dy);
  }
  expect(errors).toEqual([]);
});

test('real touch taps can be delivered in quick succession on mobile', async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.startsWith('mobile'), 'touchscreen emulation runs in the mobile project');
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.evaluate(() => {
    window.__pionierStrikeCount = 0;
    window.addEventListener('pionier:learn-note', () => { window.__pionierStrikeCount += 1; });
  });
  const canvas = page.locator('#pan');
  const points = await page.evaluate(() => {
    const surface = window.PionierCore?.surface;
    const canvasEl = document.getElementById('pan');
    if (!surface || !canvasEl) return [];
    const rect = canvasEl.getBoundingClientRect();
    const metrics = surface.metrics;
    return surface.fields.filter((field) => field.playable).slice(0, 6).map((field) => ({
      x: rect.left + (field.x / metrics.W) * rect.width,
      y: rect.top + (field.y / metrics.H) * rect.height
    }));
  });
  expect(points.length).toBeGreaterThanOrEqual(5);
  for (const point of points) await page.touchscreen.tap(point.x, point.y);
  expect(errors).toEqual([]);
  expect(await page.evaluate(() => window.__pionierStrikeCount)).toBe(points.length);
  await expect(canvas).toBeVisible();
});


test('instrument activation queue recovers after an instrument fails to initialize', async ({ page }) => {
  const result = await page.evaluate(async () => {
    const { InstrumentRegistry } = await import('/handpan-app/js/instrument.js');
    const active = InstrumentRegistry.get('handpan');
    const ctx = active?.audioCtx;
    const bus = active?.bus;
    const bird = InstrumentRegistry.get('bird');
    const kitchen = InstrumentRegistry.get('kitchen');
    if (!ctx || !bus || !bird || !kitchen) return { setup: false };
    const originalBird = bird.activate;
    bird.activate = async function () { throw new Error('simulated instrument initialization failure'); };
    let rejected = false;
    try {
      try { await InstrumentRegistry.setActive('bird', ctx, bus); }
      catch (error) { rejected = /simulated instrument initialization failure/.test(error.message); }
      await InstrumentRegistry.setActive('kitchen', ctx, bus);
      return { setup: true, rejected, activeId: InstrumentRegistry.activeId };
    } finally {
      bird.activate = originalBird;
      await InstrumentRegistry.setActive('handpan', ctx, bus);
    }
  });
  expect(result.setup).toBe(true);
  expect(result.rejected).toBe(true);
  expect(result.activeId).toBe('kitchen');
  await expect.poll(() => page.evaluate(() => window.PionierCore?.activeInstrument?.()?.id)).toBe('handpan');
});
