import { test, expect } from '@playwright/test';

test('release visual checkpoint: PIONIER boots and renders at target viewport', async ({ page }, testInfo) => {
  const project = testInfo.project.name;
  test.skip(!['mobile-390x844', 'desktop-1280x800'].includes(project), 'Capture only the two release target viewports');

  await page.goto('/handpan-app/', { waitUntil: 'domcontentloaded' });
  const enter = page.locator('#enterPionier');
  if (await enter.isVisible().catch(() => false)) await enter.click();

  await expect.poll(() => page.evaluate(() => !!window.PionierCore), { timeout: 15000 }).toBe(true);
  await expect(page.locator('#pan')).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.PionierBootState), { timeout: 10000 }).toBe('ready');

  const screenshotName = project === 'mobile-390x844'
    ? 'pionier-mobile-390x844.png'
    : 'pionier-desktop-1280x800.png';
  await page.screenshot({ path: testInfo.outputPath(screenshotName), fullPage: true, animations: 'disabled' });
});
