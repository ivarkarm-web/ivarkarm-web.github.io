import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/handpan-app/index.html');
  await expect(page.locator('#hpStage')).toBeVisible();
  await expect(page.locator('.app-modebar')).toBeVisible();
});

test('play mode renders the handpan surface and navigation', async ({ page }) => {
  await expect(page.locator('.hp-title')).toHaveText('Handpan');
  await expect(page.locator('#hpStage')).toHaveAttribute('aria-label', /Handpan/);
  await expect(page.locator('.app-mode[data-mode="play"]')).toHaveClass(/is-active/);
});

test('mode navigation opens learn and loop controls', async ({ page }) => {
  await page.locator('.app-mode[data-mode="learn"]').click();
  await expect(page.locator('#learnPanel')).toBeVisible();
  await expect(page.locator('#lessonList')).toBeVisible();

  await page.locator('.app-mode[data-mode="loop"]').click();
  await expect(page.locator('#loopRecord')).toBeVisible();
  await expect(page.locator('#loopPlay')).toBeVisible();
});

test('scale picker is keyboard accessible', async ({ page }) => {
  const trigger = page.locator('#hpScaleMenuToggle');
  await expect(trigger).toBeVisible();
  await trigger.focus();
  await expect(trigger).toBeFocused();
  await trigger.press('Enter');
  await expect(page.locator('#hpScaleSheet')).not.toHaveAttribute('hidden', '');
});

test('touch-sized layout keeps primary controls inside the viewport', async ({ page }) => {
  const viewport = page.viewportSize();
  expect(viewport).not.toBeNull();
  const rect = await page.locator('#hpStage').boundingBox();
  expect(rect).not.toBeNull();
  expect(rect.width).toBeGreaterThanOrEqual(viewport.width);
  expect(rect.height).toBeGreaterThanOrEqual(viewport.height);
});


test('loop uses a count-in and locks tempo and bars after the first layer', async ({ page }) => {
  await page.locator('.app-mode[data-mode="loop"]').click();
  const bpm = page.locator('#loopBpm');
  const bars = page.locator('#loopBars');
  await bpm.fill('180');
  await bars.selectOption('1');
  await bpm.dispatchEvent('change');
  await bars.dispatchEvent('change');

  await page.locator('#loopRecord').click();
  await expect(page.locator('#loopOrbLabel')).toContainText('COUNT-IN');
  await page.waitForTimeout(1500);
  await expect(page.locator('#loopOrbLabel')).toContainText('RECORDING');

  await page.evaluate(() => {
    window.dispatchEvent(new CustomEvent('handpan:note', {
      detail: { noteIndex: 0, velocity: 0.8 }
    }));
  });

  await page.waitForTimeout(1700);
  await expect(page.locator('#loopLayerCount')).toHaveText('1/7');
  await expect(bpm).toBeDisabled();
  await expect(bars).toBeDisabled();
  await expect(page.locator('#loopConfigNote')).toHaveText('Tempo and bars locked until Clear.');
});


test('handpan and ambience share one AudioContext', async ({ page }) => {
  await page.evaluate(() => window.HandpanGame.strike(0, 0.7));
  await page.locator('.app-mode[data-mode="ambient"]').click();
  await page.locator('#natureSelect').selectOption('stream');
  const shared = await page.evaluate(() => ({
    sameContext: window.HandpanGame.engine.ctx === window.HandpanAudio.getAudioContext(),
    state: window.HandpanAudio.audioState()
  }));
  expect(shared.sameContext).toBe(true);
  expect(['running', 'suspended', 'interrupted']).toContain(shared.state);
});


test('voice browser surface exposes the five production presets and sample fallback', async ({ page }) => {
  const info = await page.evaluate(async () => {
    window.HandpanGame.strike(0, 0.7);
    await window.HandpanGame.engine.sampleBank.loadManifest();
    return {
      voices: window.HandpanGame.instruments.map((voice) => voice.name),
      sampleStatus: window.HandpanGame.engine.sampleBank.manifest.status
    };
  });
  expect(info.voices).toEqual(['Steel', 'Warm', 'Bell', 'Soft', 'Deep']);
  expect(info.sampleStatus).toBe('fallback-synth');
});
