/**
 * Phase 6: axe-core accessibility scan (injected at test time — no npm dep required).
 *
 * Default (artistic dark glass): color-contrast disabled — intentional design.
 * High-contrast mode (Settings → High contrast): color-contrast enabled and
 * must pass WCAG 2 AA on critical/serious for the instrument surface.
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

async function runAxe(page, { colorContrast = false } = {}) {
  await page.addScriptTag({ url: AXE_CDN });
  return page.evaluate(async (enableContrast) => {
    // eslint-disable-next-line no-undef
    const results = await axe.run(document, {
      runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa'] },
      rules: {
        'color-contrast': { enabled: !!enableContrast },
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
  }, colorContrast);
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
  const results = await runAxe(page, { colorContrast: false });
  assertNoSerious(results, 'welcome');
});

test('phase6: axe scan instrument surface after Enter', async ({ page }) => {
  await page.goto('/handpan-app/', { waitUntil: 'domcontentloaded' });
  await enterIfNeeded(page);
  await expect.poll(() => page.evaluate(() => !!window.PionierCore)).toBe(true);
  await expect(page.locator('#pan')).toBeVisible();
  const results = await runAxe(page, { colorContrast: false });
  assertNoSerious(results, 'instrument');
});

test('phase6: axe scan scale menu open', async ({ page }) => {
  await page.goto('/handpan-app/', { waitUntil: 'domcontentloaded' });
  await enterIfNeeded(page);
  await page.locator('#scaleLabel').click();
  await expect(page.locator('#scaleMenu')).toBeVisible();
  const results = await runAxe(page, { colorContrast: false });
  assertNoSerious(results, 'scale-menu');
});

test('phase6: high-contrast mode enables color-contrast and stays clean on instrument', async ({ page }) => {
  await page.goto('/handpan-app/', { waitUntil: 'domcontentloaded' });
  await enterIfNeeded(page);
  await expect.poll(() => page.evaluate(() => !!window.PionierCore)).toBe(true);

  // Force high-contrast via the same storage key settings-panel uses, then reload apply path.
  await page.evaluate(() => {
    const key = 'pionier.settings.v2';
    let state = {};
    try {
      state = JSON.parse(localStorage.getItem(key) || '{}') || {};
    } catch (_) {}
    state.highContrast = true;
    localStorage.setItem(key, JSON.stringify(state));
    document.documentElement.classList.add('high-contrast');
    document.body.classList.add('high-contrast');
  });

  await expect(page.locator('html')).toHaveClass(/high-contrast/);

  const results = await runAxe(page, { colorContrast: true });
  assertNoSerious(results, 'instrument-high-contrast');
});
