/**
 * Phase 6: axe-core accessibility scan (injected at test time — no npm dep required).
 * Disables color-contrast (dark glass UI is intentional; review contrast manually on iOS).
 * Fails only on critical/serious WCAG 2 A/AA violations outside that rule.
 */
import { test, expect } from '@playwright/test';

const AXE_CDN = 'https://cdnjs.cloudflare.com/ajax/libs/axe-core/4.10.3/axe.min.js';

async function enterIfNeeded(page) {
  const enter = page.locator('#enterPionier');
  if (await enter.isVisible().catch(() => false)) {
    await enter.click();
    await expect(enter).toBeHidden({ timeout: 5000 }).catch(() => {});
  }
}

async function runAxe(page) {
  await page.addScriptTag({ url: AXE_CDN });
  return page.evaluate(async () => {
    // eslint-disable-next-line no-undef
    const results = await axe.run(document, {
      runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa'] },
      rules: {
        'color-contrast': { enabled: false },
      },
    });
    return {
      violations: results.violations.map((v) => ({
        id: v.id,
        impact: v.impact,
        help: v.help,
        nodes: v.nodes.length,
        targets: v.nodes.slice(0, 3).map((n) => n.target),
      })),
    };
  });
}

function assertNoSerious(results, label) {
  const bad = results.violations.filter(
    (v) => v.impact === 'critical' || v.impact === 'serious'
  );
  if (bad.length) {
    const detail = bad
      .map((v) => `${v.impact} ${v.id}: ${v.help} (${v.nodes} nodes)`)
      .join('\n');
    throw new Error(`axe serious/critical violations (${label}):\n${detail}`);
  }
}

test('phase6: axe scan welcome surface has no critical/serious WCAG A/AA issues', async ({ page }) => {
  await page.goto('/handpan-app/', { waitUntil: 'domcontentloaded' });
  const results = await runAxe(page);
  assertNoSerious(results, 'welcome');
});

test('phase6: axe scan instrument surface after Enter', async ({ page }) => {
  await page.goto('/handpan-app/', { waitUntil: 'domcontentloaded' });
  await enterIfNeeded(page);
  await expect.poll(() => page.evaluate(() => !!window.PionierCore)).toBe(true);
  await expect(page.locator('#pan')).toBeVisible();
  const results = await runAxe(page);
  assertNoSerious(results, 'instrument');
});

test('phase6: axe scan scale menu open', async ({ page }) => {
  await page.goto('/handpan-app/', { waitUntil: 'domcontentloaded' });
  await enterIfNeeded(page);
  await page.locator('#scaleLabel').click();
  await expect(page.locator('#scaleMenu')).toBeVisible();
  const results = await runAxe(page);
  assertNoSerious(results, 'scale-menu');
});
