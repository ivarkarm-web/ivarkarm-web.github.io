import { test, expect } from '@playwright/test';

async function enterIfNeeded(page) {
  const enter = page.locator('#enterPionier');
  if (await enter.isVisible().catch(() => false)) {
    await enter.click();
    await expect(enter).toBeHidden({ timeout: 8000 }).catch(() => {});
  }
}

test('phase11: multitrack sequence grid edits and preserves patterns while playback continues when closed', async ({ page }) => {
  await page.goto('/handpan-app/');
  await enterIfNeeded(page);
  await expect.poll(() => page.evaluate(() => !!window.PionierCore), { timeout: 15000 }).toBe(true);
  await expect.poll(() => page.evaluate(() => !!window.PionierSequence), { timeout: 15000 }).toBe(true);

  const edge = page.locator('#pionierSequenceEdge');
  const panel = page.locator('#pionierSequence');
  await expect(edge).toBeVisible();
  await edge.click();
  await expect(panel).toBeVisible();
  await expect(panel.locator('.sequence-row')).toHaveCount(4);
  await expect(panel.locator('.sequence-step')).toHaveCount(64);
  await expect(panel.getByRole('slider', { name: 'Sequencer volume' })).toHaveValue('100');
  await expect(panel.getByRole('switch', { name: 'Sync to looper' })).toBeVisible();

  const firstCell = panel.locator('.sequence-row').nth(0).locator('.sequence-step').nth(1);
  const before = await firstCell.getAttribute('aria-pressed');
  await firstCell.click();
  await expect(firstCell).toHaveAttribute('aria-pressed', before === 'true' ? 'false' : 'true');
  const editedPattern = await page.evaluate(() => window.PionierSequence.getState().voices[0].pattern[1] !== null);
  expect(editedPattern).toBe(before !== 'true');

  await panel.getByRole('button', { name: 'New pattern' }).click();
  await expect(panel.locator('.sequence-step')).toHaveCount(64);
  const tileStyle = await panel.locator('.sequence-step').first().evaluate((el) => getComputedStyle(el).borderRadius);
  expect(parseFloat(tileStyle)).toBeGreaterThan(0);

  // The primary interaction is an inward swipe from the right edge.
  await panel.getByRole('button', { name: 'Return to handpan' }).click();
  await expect(panel).toBeHidden();
  const viewport = page.viewportSize();
  await page.mouse.move(viewport.width - 3, viewport.height / 2);
  await page.mouse.down();
  await page.mouse.move(viewport.width - 110, viewport.height / 2 + 4, { steps: 6 });
  await page.mouse.up();
  await expect(panel).toBeVisible();

  await panel.getByRole('button', { name: /Play sequence/ }).click();
  await expect.poll(() => page.evaluate(() => window.PionierSequence.getState().playing)).toBe(true);
  await panel.getByRole('button', { name: 'Return to handpan' }).click();
  await expect(panel).toBeHidden();
  expect(await page.evaluate(() => window.PionierSequence.getState().playing)).toBe(true);

  await edge.click();
  await panel.getByRole('button', { name: /Stop sequence/ }).click();
  await expect.poll(() => page.evaluate(() => window.PionierSequence.getState().playing)).toBe(false);
});
