/**
 * Phase 15: Content-Security-Policy guard.
 *
 * Verifies the CSP meta tag is present and that no CSP violations are
 * reported when the page loads.
 */
import { test, expect } from '@playwright/test';

async function enterIfNeeded(page) {
  const enter = page.locator('#enterPionier');
  if (await enter.isVisible().catch(() => false)) {
    await enter.click();
    await expect(enter)
      .toBeHidden({ timeout: 5000 })
      .catch(() => {});
  }
}

test('phase15: CSP meta tag is present and restrictive', async ({ page }) => {
  await page.goto('/handpan-app/', { waitUntil: 'load' });
  const html = await page.evaluate(() => document.documentElement.outerHTML);
  expect(html).toContain('Content-Security-Policy');
  expect(html).toContain("default-src 'self'");
  expect(html).not.toContain('unsafe-eval');
});

test('phase15: no CSP violations on load', async ({ page }) => {
  const violations = [];
  page.on('pageerror', (err) => {
    if (err.message && /CSP|Content-Security-Policy/.test(err.message)) {
      violations.push(err.message);
    }
  });
  page.on('console', (msg) => {
    if (msg.type() === 'error' && /CSP|Content-Security-Policy/.test(msg.text())) {
      violations.push(msg.text());
    }
  });

  await page.goto('/handpan-app/', { waitUntil: 'domcontentloaded' });
  await enterIfNeeded(page);
  await expect.poll(() => page.evaluate(() => !!window.PionierCore), { timeout: 15000 }).toBe(true);

  expect(violations, `CSP violations: ${violations.join('\n')}`).toEqual([]);
});
