/**
 * Phase 14: procedural nature ambience must remain available.
 *
 * The generative beds previously shipped in Pionier and were removed in
 * 21890c3c. This guards the restored Rain/Storm/Forest/Birds/Wind/Water
 * controls, their volume, persistence and actual Web Audio scheduling.
 */
import { test, expect } from '@playwright/test';

async function enterApp(page) {
  await page.goto('/handpan-app/', { waitUntil: 'domcontentloaded' });
  const enter = page.locator('#enterPionier');
  if (await enter.isVisible().catch(() => false)) {
    await enter.click();
  }
  await expect
    .poll(() => page.evaluate(() => window.PionierBootState), { timeout: 30000 })
    .toBe('ready');
}

async function pickBed(page, label) {
  await page.locator('#settingsOpenBtn').click();
  await page.locator('#settingNatureSoundToggle').click();
  await page.locator('#settingNatureSoundMenu [role="option"]', { hasText: label }).click();
}

test('phase14: nature ambience offers the atmospheric beds and schedules real audio', async ({
  page,
}) => {
  test.setTimeout(90000);
  await page.addInitScript(() => {
    window.__natureBufferSources = 0;
    const Native = window.AudioContext || window.webkitAudioContext;
    if (!Native) {
      return;
    }
    const create = Native.prototype.createBufferSource;
    Native.prototype.createBufferSource = function (...args) {
      window.__natureBufferSources += 1;
      return create.apply(this, args);
    };
  });
  await enterApp(page);

  await page.locator('#settingsOpenBtn').click();
  await page.locator('#settingNatureSoundToggle').click();
  const labels = await page.locator('#settingNatureSoundMenu [role="option"]').allTextContents();
  expect(labels).toEqual(['Off', 'Soft rain', 'Thunderstorm', 'Forest', 'Birds', 'Wind', 'Water']);

  const before = await page.evaluate(() => window.__natureBufferSources);
  await page.locator('#settingNatureSoundMenu [role="option"]', { hasText: 'Soft rain' }).click();
  await expect.poll(() => page.evaluate(() => window.PionierAmbientBeds.getMode())).toBe('rain');
  await expect
    .poll(() => page.evaluate(() => window.__natureBufferSources), { timeout: 5000 })
    .toBeGreaterThan(before);

  const vol = page.locator('#settingNatureVolume');
  await vol.fill('55');
  await vol.dispatchEvent('input');
  await expect(page.locator('#settingNatureVolumeVal')).toHaveText('55%');
  expect(
    await page.evaluate(
      () => JSON.parse(localStorage.getItem('pionier.settings.v2') || '{}').natureVolume
    )
  ).toBe(0.55);

  // The selected bed is persisted and resumes on the next interaction.
  await page.reload({ waitUntil: 'domcontentloaded' });
  await enterApp(page);
  expect(
    await page.evaluate(
      () => JSON.parse(localStorage.getItem('pionier.settings.v2') || '{}').natureSound
    )
  ).toBe('rain');
  await page.locator('#pan').click({ position: { x: 30, y: 30 } });
  await expect.poll(() => page.evaluate(() => window.PionierAmbientBeds.getMode())).toBe('rain');

  await pickBed(page, 'Off');
  await expect.poll(() => page.evaluate(() => window.PionierAmbientBeds.getMode())).toBe('off');
});
