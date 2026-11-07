/**
 * Regression: centred top navigation group + About window.
 *
 * Covers the My Library / Favourites / About controls introduced in the
 * top-centred navigation group, across mobile and desktop viewports.
 */
import { test, expect } from '@playwright/test';

const GROUP = '#topNavGroup';
const LIB_BTN = '#openLibrary';
const FAV_BTN = '#favoritesOpenBtn';
const ABOUT_BTN = '#aboutBtn';
const LIBRARY_PANEL = '#libraryPanel';
const FAV_SHEET = '#favoritesSheet';
const ABOUT_WINDOW = '#aboutWindow';
const ABOUT_CLOSE = '#aboutClose';
const ABOUT_BACKDROP = '#aboutBackdrop';

async function enterPionier(page) {
  await page.goto('/handpan-app/index.html', { waitUntil: 'domcontentloaded' });
  const enterBtn = page.locator('#enterPionier');
  await expect(enterBtn).toBeVisible();
  await enterBtn.click();
  await page.waitForFunction(() => window.PionierBootState === 'ready', null, {
    timeout: 15000,
  });
  // The welcome gate covers #app during a ~1s exit transition; wait until it
  // is fully hidden before interacting with the top navigation controls.
  await page.waitForFunction(() => {
    const w = document.getElementById('pionierWelcome');
    return !w || w.hidden;
  }, null, { timeout: 15000 });
}

test('top navigation group is centred with three non-overlapping buttons', async ({ page }) => {
  await enterPionier(page);

  const group = page.locator(GROUP);
  await expect(group).toBeVisible();

  const buttons = [LIB_BTN, FAV_BTN, ABOUT_BTN].map((sel) => page.locator(sel));
  for (const b of buttons) await expect(b).toBeVisible();

  const rects = await page.evaluate(() => {
    const vpW = window.innerWidth;
    const group = document.querySelector('#topNavGroup');
    const gr = group.getBoundingClientRect();
    const get = (sel) => {
      const el = document.querySelector(sel);
      return el ? el.getBoundingClientRect() : null;
    };
    const lib = get('#openLibrary');
    const fav = get('#favoritesOpenBtn');
    const abt = get('#aboutBtn');
    const overlaps = (a, b) => !(
      a.right <= b.left || b.right <= a.left ||
      a.bottom <= b.top || b.bottom <= a.top
    );
    return {
      vpW,
      groupCenter: gr.left + gr.width / 2,
      vpCenter: vpW / 2,
      lib, fav, abt,
      libFavOverlap: overlaps(lib, fav),
      favAbtOverlap: overlaps(fav, abt),
      libAbtOverlap: overlaps(lib, abt),
    };
  });

  expect(rects.groupCenter).toBeCloseTo(rects.vpCenter, 0);
  expect(rects.libFavOverlap).toBe(false);
  expect(rects.favAbtOverlap).toBe(false);
  expect(rects.libAbtOverlap).toBe(false);
});

test('My Library opens the saved composition library panel', async ({ page }) => {
  await enterPionier(page);

  await page.locator(LIB_BTN).click();
  await expect(page.locator(LIBRARY_PANEL)).not.toBeHidden();
  await expect(page.locator(LIBRARY_PANEL)).toHaveAttribute('aria-hidden', 'false');

  await page.locator('#closeLibrary').click();
  await expect(page.locator(LIBRARY_PANEL)).toBeHidden();
});

test('Favourites opens the existing favourites sheet', async ({ page }) => {
  await enterPionier(page);

  await page.locator(FAV_BTN).click();
  await expect(page.locator(FAV_SHEET)).not.toBeHidden();
  await expect(page.locator(FAV_SHEET)).toHaveClass(/is-open/);

  await page.locator('#favoritesSheetClose').click();
  await expect(page.locator(FAV_SHEET)).toBeHidden();
});

test('About window opens and closes via close button, Escape and backdrop', async ({ page }) => {
  await enterPionier(page);

  await page.locator(ABOUT_BTN).click();
  await expect(page.locator(ABOUT_WINDOW)).not.toBeHidden();
  await expect(page.locator(ABOUT_WINDOW)).toHaveAttribute('aria-hidden', 'false');
  await expect(page.locator('#aboutTitle')).toHaveText('About Pionier');
  await expect(page.locator(ABOUT_CLOSE)).toBeVisible();

  await page.locator(ABOUT_CLOSE).click();
  await expect(page.locator(ABOUT_WINDOW)).toBeHidden();

  await page.locator(ABOUT_BTN).click();
  await expect(page.locator(ABOUT_WINDOW)).not.toBeHidden();
  await page.keyboard.press('Escape');
  await expect(page.locator(ABOUT_WINDOW)).toBeHidden();

  await page.locator(ABOUT_BTN).click();
  await expect(page.locator(ABOUT_WINDOW)).not.toBeHidden();
  await page.evaluate(() => document.getElementById('aboutBackdrop')?.click());
  await expect(page.locator(ABOUT_WINDOW)).toBeHidden();
});

test('instrument interactions keep working with the About window closed', async ({ page }) => {
  await enterPionier(page);

  await page.locator(ABOUT_BTN).click();
  await expect(page.locator(ABOUT_WINDOW)).not.toBeHidden();
  await page.locator(ABOUT_CLOSE).click();
  await expect(page.locator(ABOUT_WINDOW)).toBeHidden();

  await page.locator('#instrumentDropdownToggle').click();
  await expect(page.locator('#instrumentMenu')).not.toBeHidden();
  await page.keyboard.press('Escape');
  await expect(page.locator('#instrumentMenu')).toBeHidden();
});
