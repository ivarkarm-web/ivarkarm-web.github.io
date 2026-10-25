import { test, expect } from '@playwright/test';

test('ambient sequencer prototype stays hidden until real-device release checks pass', async ({ page }) => {
  await page.goto('/handpan-app/');
  await expect(page.locator('#pionierSequenceEdge')).toBeHidden();
  await expect(page.locator('#pionierSequence')).toBeHidden();
});
