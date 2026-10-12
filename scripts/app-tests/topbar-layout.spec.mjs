import { test, expect } from '@playwright/test';
import path from 'node:path';
import fs from 'node:fs';

test.beforeEach(async ({ page }) => {
  await page.goto('/handpan-app/index.html');
  await expect(page.locator('#pan')).toBeVisible();
  await expect(page.locator('#modePlay')).toBeVisible();
  await expect(page.locator('#instrumentDropdownToggle')).toBeVisible();
  await expect(page.locator('#learnLaunch')).toBeVisible();
});

function overlapArea(a, b) {
  const ox = Math.max(0, Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x));
  const oy = Math.max(0, Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y));
  return ox * oy;
}

test('topbar controls do not overlap, stay in viewport, meet touch targets, and are photographed', async ({ page }, testInfo) => {
  const ids = [
    '#modePlay',
    '#instrumentDropdownToggle',
    '#voicePrev',
    '#voiceNext',
    '#learnLaunch',
    '#openSoundscapes',
    '#btnHelp',
    '#btnExit'
  ];
  const boxes = [];
  for (const sel of ids) {
    const box = await page.locator(sel).boundingBox();
    expect(box, `${sel} should be laid out`).not.toBeNull();
    boxes.push({ sel, ...box });
  }

  const viewport = page.viewportSize();
  expect(viewport).not.toBeNull();

  for (const box of boxes) {
    expect(box.x, `${box.sel} left`).toBeGreaterThanOrEqual(-1);
    expect(box.y, `${box.sel} top`).toBeGreaterThanOrEqual(-1);
    expect(box.x + box.width, `${box.sel} right`).toBeLessThanOrEqual(viewport.width + 1);
    expect(box.y + box.height, `${box.sel} bottom`).toBeLessThanOrEqual(viewport.height + 1);
  }

  for (let i = 0; i < boxes.length; i++) {
    for (let j = i + 1; j < boxes.length; j++) {
      const area = overlapArea(boxes[i], boxes[j]);
      expect(area, `${boxes[i].sel} overlaps ${boxes[j].sel}`).toBeLessThanOrEqual(2);
    }
  }

  // Comfortable phone targets (Apple HIG ~44px). Report actual sizes in the failure message.
  for (const box of boxes) {
    expect(
      box.width,
      `${box.sel} width ${box.width.toFixed(1)}px (need >= 44)`
    ).toBeGreaterThanOrEqual(44);
    expect(
      box.height,
      `${box.sel} height ${box.height.toFixed(1)}px (need >= 44)`
    ).toBeGreaterThanOrEqual(44);
  }

  const outDir = path.join('test-results', 'topbar');
  fs.mkdirSync(outDir, { recursive: true });
  const name = `topbar-${testInfo.project.name}.png`;
  await page.locator('.topbar').screenshot({ path: path.join(outDir, name) });
  await testInfo.attach(name, {
    path: path.join(outDir, name),
    contentType: 'image/png'
  });
});
