import { test, expect } from '@playwright/test';
import { dismissStorageNoticeIfNeeded } from './support/storage-notice.mjs';

async function enterIfNeeded(page) {
  await dismissStorageNoticeIfNeeded(page);
  const enter = page.locator('#enterPionier');
  if (await enter.isVisible().catch(() => false)) {
    await enter.click();
    await expect(enter).toBeHidden({ timeout: 8000 }).catch(() => {});
  }
}

test('phase11: original TonePad canvas sequencer is present and grid sequencer is absent', async ({ page }) => {
  await page.goto('/handpan-app/');
  await enterIfNeeded(page);
  await expect.poll(() => page.evaluate(() => !!window.PionierCore), { timeout: 15000 }).toBe(true);
  const toggle = page.locator('#tonepadToggle');
  await expect(toggle).toHaveCount(1);
  await expect.poll(() => page.locator('#tonepadLayer').count(), { timeout: 15000 }).toBe(1);
  await expect(page.locator('#tonepadLayer canvas.tonepad-canvas')).toHaveCount(1);
  await expect(page.locator('#pionierSequence')).toHaveCount(0);
  await expect(page.locator('.sequence-regenerate')).toHaveCount(0);
  await expect(page.locator('#pionierSequenceEdge')).toHaveCount(0);
});
