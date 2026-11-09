/**
 * scripts/contrast-check.mjs — Scripted text-contrast check (≥4.5:1).
 *
 * Loads the Pionier app in Playwright, computes the contrast ratio for every
 * visible text node against its background, and prints any failures below
 * the WCAG AA 4.5:1 threshold (or 3:1 for large text).
 *
 * Usage:
 *   node scripts/contrast-check.mjs          # run against local server
 *   node scripts/contrast-check.mjs --url <url>
 */
import { chromium } from '@playwright/test';

const MIN_RATIO_NORMAL = 4.5;
const MIN_RATIO_LARGE = 3.0;
const LARGE_TEXT_PX = 18; // 18pt ≈ 24px, but we use 18px as a heuristic

function getLuminance(r, g, b) {
  const sRGB = [r, g, b].map((c) => {
    c = c / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * sRGB[0] + 0.7152 * sRGB[1] + 0.0722 * sRGB[2];
}

function contrastRatio(l1, l2) {
  const light = Math.max(l1, l2);
  const dark = Math.min(l1, l2);
  return (light + 0.05) / (dark + 0.05);
}

function parseColor(cssColor) {
  if (!cssColor || cssColor === 'transparent' || cssColor === 'rgba(0, 0, 0, 0)') {
    return null;
  }
  const m = cssColor.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
  if (m) {
    return { r: parseInt(m[1]), g: parseInt(m[2]), b: parseInt(m[3]) };
  }
  const m2 = cssColor.match(/#([0-9a-fA-F]{2})([0-9a-fA-F]{2})([0-9a-fA-F]{2})/);
  if (m2) {
    return {
      r: parseInt(m2[1], 16),
      g: parseInt(m2[2], 16),
      b: parseInt(m2[3], 16),
    };
  }
  return null;
}

async function run({ url }) {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto(url, { waitUntil: 'networkidle' });

  const failures = await page.evaluate(() => {
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
      acceptNode: (node) => {
        const text = node.textContent.trim();
        if (!text) {
          return NodeFilter.FILTER_REJECT;
        }
        const el = node.parentElement;
        if (!el) {
          return NodeFilter.FILTER_REJECT;
        }
        const style = window.getComputedStyle(el);
        if (style.visibility === 'hidden' || style.display === 'none') {
          return NodeFilter.FILTER_REJECT;
        }
        return NodeFilter.FILTER_ACCEPT;
      },
    });

    const failures = [];
    let node;
    while ((node = walker.nextNode())) {
      const el = node.parentElement;
      const style = window.getComputedStyle(el);
      const color = parseColor(style.color);
      const bgColor = parseColor(style.backgroundColor);
      if (!color || !bgColor) {
        continue;
      }
      const text = node.textContent.trim();
      if (!text) {
        continue;
      }
      const fontSize = parseFloat(style.fontSize) || 16;
      const fontWeight = style.fontWeight;
      const isLarge =
        fontSize >= LARGE_TEXT_PX ||
        (fontSize >= 14 && (fontWeight === 'bold' || fontWeight >= 700));
      const minRatio = isLarge ? MIN_RATIO_LARGE : MIN_RATIO_NORMAL;

      const l1 = getLuminance(color.r, color.g, color.b);
      const l2 = getLuminance(bgColor.r, bgColor.g, bgColor.b);
      const ratio = contrastRatio(l1, l2);

      if (ratio < minRatio) {
        failures.push({
          text: text.slice(0, 60),
          selector:
            el.tagName.toLowerCase() +
            (el.id ? '#' + el.id : '') +
            (el.className ? '.' + el.className.split(' ').join('.') : ''),
          color: `rgb(${color.r},${color.g},${color.b})`,
          background: `rgb(${bgColor.r},${bgColor.g},${bgColor.b})`,
          ratio: ratio.toFixed(2),
          minRatio,
          fontSize: fontSize.toFixed(0) + 'px',
        });
      }
    }
    return failures;
  });

  await browser.close();

  console.log(`Text contrast check (≥${MIN_RATIO_NORMAL}:1 normal, ≥${MIN_RATIO_LARGE}:1 large):`);
  if (failures.length === 0) {
    console.log('  ✓ No contrast failures found.');
    return 0;
  }
  console.log(`  ✗ ${failures.length} contrast failure(s):`);
  for (const f of failures) {
    console.log(
      `    ${f.ratio}:1 (need ≥${f.minRatio}) · ${f.selector} · color=${f.color} bg=${f.background} · "${f.text}"`
    );
  }
  return 1;
}

const url = process.argv[2] || 'http://127.0.0.1:4173/handpan-app/';
run({ url }).then((code) => process.exit(code));
