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


test('learn mode exposes the four-level sixteen-lesson curriculum', async ({ page }) => {
  await page.locator('.app-mode[data-mode="learn"]').click();
  await expect(page.locator('.lesson-card')).toHaveCount(16);
  await expect(page.locator('.lesson-level')).toHaveCount(4);
  await page.locator('.lesson-card').first().click();
  await expect(page.locator('#learnStage')).toBeVisible();
  await expect(page.locator('#learnLevel')).toContainText('LEVEL 1');
  await expect(page.locator('#learnTiming')).toBeVisible();
});


test('non-user note events cannot create loop overdubs or Learn scores', async ({ page }) => {
  await page.locator('.app-mode[data-mode="loop"]').click();
  await page.evaluate(() => {
    window.HandpanGame.strike(0, 0.7, null, 'loop');
    window.dispatchEvent(new CustomEvent('handpan:note', { detail: { noteIndex: 1, velocity: 0.8, source: 'loop' } }));
  });
  await expect(page.locator('#loopLayerCount')).toHaveText('0/7');

  await page.locator('.app-mode[data-mode="learn"]').click();
  await page.locator('.lesson-card').first().click();
  await page.waitForTimeout(100);
  const before = await page.evaluate(() => window.HandpanLearn.state.scorer?.hits ?? 0);
  await page.evaluate(() => {
    window.dispatchEvent(new CustomEvent('handpan:note', { detail: { noteIndex: 0, velocity: 0.8, source: 'lesson-demo' } }));
  });
  const after = await page.evaluate(() => window.HandpanLearn.state.scorer?.hits ?? 0);
  expect(after).toBe(before);
});

test('switching away from Learn closes its lifecycle and clears guide targets', async ({ page }) => {
  await page.locator('.app-mode[data-mode="learn"]').click();
  await page.locator('.lesson-card').first().click();
  await expect(page.locator('#learnStage')).toBeVisible();
  await page.locator('.app-mode[data-mode="play"]').click();
  await expect(page.locator('#learnPanel')).not.toHaveClass(/is-open/);
  const phase = await page.evaluate(() => window.HandpanLearn.state.phase);
  expect(phase).toBe('picker');
});

test('switching modes does not disable active backing or ambience', async ({ page }) => {
  await page.locator('.app-mode[data-mode="ambient"]').click();
  await page.locator('#backingSelect').selectOption('drone');
  await page.locator('#natureSelect').selectOption('stream');
  await page.locator('.app-mode[data-mode="play"]').click();
  const state = await page.evaluate(() => ({
    backing: document.querySelector('#backingSelect').value,
    nature: document.querySelector('#natureSelect').value
  }));
  expect(state.backing).toBe('drone');
  expect(state.nature).toBe('stream');
});

test('back to site never falls back to the app index', async ({ page }) => {
  const href = await page.locator('#hpBack').getAttribute('href');
  expect(href).toBe('../');
  const resolved = await page.locator('#hpBack').evaluate((el) => el.href);
  expect(resolved).toContain('/ivarkarm-web.github.io/');
  expect(resolved).not.toContain('/handpan-app/index.html');
});
