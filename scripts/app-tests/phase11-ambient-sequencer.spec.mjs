import { test, expect } from '@playwright/test';

async function enterIfNeeded(page) {
  const enter = page.locator('#enterPionier');
  if (await enter.isVisible().catch(() => false)) {
    await enter.click();
    await expect(enter).toBeHidden({ timeout: 8000 }).catch(() => {});
  }
}

test('phase11: ambient sequence opens, plays independently and preserves playback when closed', async ({ page }) => {
  await page.goto('/handpan-app/');
  await enterIfNeeded(page);
  await expect.poll(() => page.evaluate(() => !!window.PionierCore), { timeout: 15000 }).toBe(true);
  await expect.poll(() => page.evaluate(() => !!window.PionierSequence), { timeout: 15000 }).toBe(true);

  const edge = page.locator('#pionierSequenceEdge');
  const panel = page.locator('#pionierSequence');
  await expect(edge).toBeVisible();
  await edge.click();
  await expect(panel).toBeVisible();
  await expect(panel.locator('.sequence-step')).toHaveCount(16);
  await expect(panel.getByRole('switch', { name: 'Sync to looper' })).toBeVisible();

  await panel.getByRole('button', { name: /Play backing/ }).click();
  await expect.poll(() => page.evaluate(() => window.PionierSequence.getState().playing)).toBe(true);
  await panel.getByRole('button', { name: 'Return to handpan' }).click();
  await expect(panel).toBeHidden();
  expect(await page.evaluate(() => window.PionierSequence.getState().playing)).toBe(true);

  await edge.click();
  await panel.getByRole('button', { name: /Stop backing/ }).click();
  await expect.poll(() => page.evaluate(() => window.PionierSequence.getState().playing)).toBe(false);
});
