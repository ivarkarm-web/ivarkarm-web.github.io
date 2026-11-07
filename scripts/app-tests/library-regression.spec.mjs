import { test, expect } from '@playwright/test';

async function enterIfNeeded(page) {
  const enter = page.locator('#enterPionier');
  if (!(await enter.isVisible().catch(() => false))) return;

  // Wait for the finite copy entrance that contains the button. Decorative
  // animations elsewhere in the welcome overlay do not affect click readiness.
  await page.waitForFunction(() => {
    const button = document.querySelector('#enterPionier');
    const content = button?.closest('.pionier-welcome-content');
    if (!button || !content || !button.isConnected || button.getClientRects().length === 0) return false;
    const animations = [
      ...content.getAnimations({ subtree: true }),
      ...button.getAnimations({ subtree: true }),
    ];
    return animations
      .filter(animation => animation.effect?.getComputedTiming().iterations !== Infinity)
      .every(animation => animation.playState !== 'running' && animation.playState !== 'pending');
  });
  await expect(enter).toBeEnabled();
  await enter.click();
  // The app sets `hidden` only when its 1080 ms exit choreography completes;
  // `toBeHidden()` also passes as soon as the transition sets visibility:hidden.
  await page.waitForFunction(() => document.querySelector('#pionierWelcome')?.hidden === true);
}

function sample(value) {
  return {
    duration: 0.5, sampleRate: 8000,
    settings: { instrumentId: 'handpan', scaleIndex: 1, rootIndex: 2, noteCount: 9, fx: null },
    timing: { bpm: 92, metronomeOn: false, countInEnabled: false, countInBars: 1, beatsPerBar: 4 },
    layers: [{ sampleRate: 8000, channels: [new Float32Array([value, -value, 0.1]), new Float32Array([value, -value, 0.1])], offset: 0, level: 0.9, pan: 0, muted: false, solo: false, duration: 0.5 }]
  };
}

test('My Library button stays in safe viewport and library recordings survive reload with independent actions', async ({ page }) => {
  // Two full boots plus IndexedDB work; 45s was not enough on slower local hardware.
  test.setTimeout(120000);
  await page.goto('/handpan-app/');
  await enterIfNeeded(page);
  await expect.poll(() => page.evaluate(() => !!window.PionierLibrary && !!window.PionierCore)).toBe(true);
  const button = page.locator('#openLibrary');
  await expect(button).toBeVisible();
  await expect.poll(() => button.evaluate(el => el.parentElement === document.body)).toBe(true);
  const box = await button.boundingBox();
  expect(box).toBeTruthy();
  expect(box.x).toBeGreaterThanOrEqual(0); expect(box.y).toBeGreaterThanOrEqual(0);
  const viewport = page.viewportSize();
  expect(box.x + box.width).toBeLessThanOrEqual(viewport.width + 1);
  expect(box.y + box.height).toBeLessThanOrEqual(viewport.height + 1);
  expect(await button.evaluate(el => {
    const rect = el.getBoundingClientRect();
    return document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2)?.closest('#openLibrary')?.id;
  })).toBe('openLibrary');

  await page.evaluate(async data => {
    await window.PionierLibrary.save(data);
    await window.PionierLibrary.save({ ...data, layers: [{ ...data.layers[0], channels: [new Float32Array([0.5, -0.5, 0.1]), new Float32Array([0.5, -0.5, 0.1])] }] });
  }, sample(0.25));
  await expect(page.locator('#libraryPanel')).toBeVisible();
  await expect(page.locator('.library-record')).toHaveCount(2);
  const firstRow = page.locator('.library-record').first();
  page.once('dialog', dialog => dialog.accept('Night study'));
  await firstRow.getByRole('button', { name: 'Rename' }).click();
  await expect(page.getByRole('heading', { name: 'Night study' })).toBeVisible();
  const downloadPromise = page.waitForEvent('download');
  await page.locator('.library-record').first().getByRole('button', { name: 'WAV' }).click();
  expect((await downloadPromise).suggestedFilename()).toMatch(/\.wav$/);
  const playButton = page.locator('.library-record').first().getByRole('button', { name: 'Play' });
  await playButton.click();

  await page.reload();
  await enterIfNeeded(page);
  await expect.poll(() => page.evaluate(() => !!window.PionierLibrary)).toBe(true);
  await page.locator('#openLibrary').click();
  await expect(page.locator('.library-record')).toHaveCount(2);
  const firstId = await page.locator('.library-record').first().getAttribute('data-id');
  const savedData = await page.evaluate(async id => {
    const { getComposition } = await import('/handpan-app/js/library-store.js?v=1');
    const record = await getComposition(id);
    return { sample: Number(record.layers[0].channels[0][0]), bpm: record.timing.bpm };
  }, firstId);
  expect([0.25, 0.5]).toContain(savedData.sample);
  expect(savedData.bpm).toBe(92);
  page.once('dialog', dialog => dialog.accept());
  await page.locator('.library-record').first().getByRole('button', { name: 'Delete' }).click();
  await expect(page.locator('.library-record')).toHaveCount(1);
  await expect(page.locator('.library-record h3')).not.toHaveText('');
}, { timeout: 120_000 });

test('removing the old player leaves shared audio, looper and sequencer mounted', async ({ page }) => {
  await page.goto('/handpan-app/');
  await enterIfNeeded(page);
  await expect.poll(() => page.evaluate(() => !!window.PionierLooper && !!window.PionierTonepad)).toBe(true);
  const status = await page.evaluate(async () => {
    window.PionierCore.ensureAudio();
    const shared = await import('/handpan-app/js/audio-core.js?v=2');
    document.querySelector('#tonepadToggle').click();
    return {
      contextShared: window.PionierCore.getAudioContext() === shared.getAudioContext(),
      hasLooper: window.PionierLooper.getState().maxLayers > 0,
      sequencerMounted: !!window.PionierTonepad,
      removedMarkup: !document.querySelector('#soundscapesPanel, #soundscapeAudio'),
    };
  });
  expect(status.contextShared).toBe(true);
  expect(status.hasLooper).toBe(true);
  expect(status.sequencerMounted).toBe(true);
  expect(status.removedMarkup).toBe(true);
});
