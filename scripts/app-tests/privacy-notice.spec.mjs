/**
 * Dedicated coverage for the first-visit storage/privacy notice.
 * These tests intentionally do NOT use dismissStorageNoticeIfNeeded() so they
 * exercise the real notice lifecycle (visibility, Continue, persistence,
 * keyboard interaction, details disclosure).
 */
import { test, expect } from '@playwright/test';

const STORAGE_NOTICE_KEY = 'pionier-storage-notice-seen-v1';

async function gotoFreshWelcome(page) {
  // Fresh browser context: localStorage is empty before first navigation.
  // Assert absence before app shows notice (ensures genuinely first-visit state).
  await page.goto('/handpan-app/index.html', { waitUntil: 'domcontentloaded' });
  const seen = await page.evaluate((key) => {
    try { return localStorage.getItem(key); } catch { return null; }
  }, STORAGE_NOTICE_KEY);
  expect(seen).toBeNull();
  await expect(page.locator('#pionierStorageNotice')).toBeVisible({ timeout: 10000 });
}

test.describe('privacy notice (first visit)', () => {
  test('1. first-visit visibility, accessible name and dialog semantics', async ({ page }) => {
    await gotoFreshWelcome(page);

    const notice = page.locator('#pionierStorageNotice');
    await expect(notice).toBeVisible();
    await expect(notice).toHaveAttribute('role', 'dialog');
    await expect(notice).toHaveAttribute('aria-modal', 'false');
    await expect(notice).toHaveAttribute('aria-labelledby', 'pionierStorageNoticeTitle');

    const title = page.locator('#pionierStorageNoticeTitle');
    await expect(title).toHaveText('Local storage & cache');

    // Accessible name resolves via aria-labelledby to the title.
    await expect(notice).toHaveAccessibleName('Local storage & cache');
    await expect(page.locator('#pionierStorageNoticeContinue')).toBeVisible();
    await expect(page.locator('#pionierStorageNoticeDetailsBtn')).toBeVisible();
  });

  test('2. Continue dismissal persists key and restores focus to Enter', async ({ page }) => {
    await gotoFreshWelcome(page);

    await page.locator('#pionierStorageNoticeContinue').click();

    await expect(page.locator('#pionierStorageNotice')).toBeHidden();
    await expect.poll(() => page.evaluate((key) => {
      try { return localStorage.getItem(key); } catch { return null; }
    }, STORAGE_NOTICE_KEY)).toBe('1');

    // Focus returns to the welcome Enter control.
    await expect(page.locator('#enterPionier')).toBeFocused();
  });

  test('3. reload persistence: notice stays dismissed and app remains usable', async ({ page }) => {
    await gotoFreshWelcome(page);

    await page.locator('#pionierStorageNoticeContinue').click();
    await expect(page.locator('#pionierStorageNotice')).toBeHidden();
    await expect.poll(() => page.evaluate((key) => {
      try { return localStorage.getItem(key); } catch { return null; }
    }, STORAGE_NOTICE_KEY)).toBe('1');

    // Returning visit in same context: reload without clearing the persisted key.
    await page.goto('/handpan-app/index.html', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#pionierStorageNotice')).toBeHidden({ timeout: 10000 });
    await expect.poll(() => page.evaluate((key) => {
      try { return localStorage.getItem(key); } catch { return null; }
    }, STORAGE_NOTICE_KEY)).toBe('1');

    // Application remains usable (welcome/Enter flow available).
    await expect(page.locator('#enterPionier')).toBeVisible();
    await expect(page.locator('#enterPionier')).toBeEnabled();
  });

  test('4. keyboard accessibility: reach controls, activate Continue via keyboard, focus visible/restored', async ({ page }) => {
    await gotoFreshWelcome(page);

    const detailsBtn = page.locator('#pionierStorageNoticeDetailsBtn');
    const continueBtn = page.locator('#pionierStorageNoticeContinue');
    const enterBtn = page.locator('#enterPionier');

    // On show, Continue receives focus (implementation). Tab order can reach notice controls.
    await expect(continueBtn).toBeFocused();

    // Move focus to details control via keyboard (Shift+Tab from Continue).
    await page.keyboard.press('Shift+Tab');
    await expect(detailsBtn).toBeFocused();
    await expect.poll(() => detailsBtn.evaluate((el) => el.matches(':focus-visible'))).toBe(true);

    // Tab forward reaches Continue again.
    await page.keyboard.press('Tab');
    await expect(continueBtn).toBeFocused();
    await expect.poll(() => continueBtn.evaluate((el) => el.matches(':focus-visible'))).toBe(true);

    // Activate Continue using keyboard (not a synthetic click).
    await page.keyboard.press('Enter');

    await expect(page.locator('#pionierStorageNotice')).toBeHidden();
    await expect.poll(() => page.evaluate((key) => {
      try { return localStorage.getItem(key); } catch { return null; }
    }, STORAGE_NOTICE_KEY)).toBe('1');
    await expect(enterBtn).toBeFocused();
  });

  test('5. privacy details disclosure via keyboard and pointer with correct ARIA', async ({ page }) => {
    await gotoFreshWelcome(page);

    const detailsBtn = page.locator('#pionierStorageNoticeDetailsBtn');
    const details = page.locator('#pionierStorageNoticeDetails');

    // Initial state.
    await expect(detailsBtn).toHaveAttribute('aria-expanded', 'false');
    await expect(detailsBtn).toHaveAttribute('aria-controls', 'pionierStorageNoticeDetails');
    await expect(details).toBeHidden();
    await expect(page.locator('#pionierStorageNoticeDetails')).toHaveAttribute('id', 'pionierStorageNoticeDetails');

    // Expand via pointer.
    await detailsBtn.click();
    await expect(detailsBtn).toHaveAttribute('aria-expanded', 'true');
    await expect(details).toBeVisible();

    // Collapse via pointer.
    await detailsBtn.click();
    await expect(detailsBtn).toHaveAttribute('aria-expanded', 'false');
    await expect(details).toBeHidden();

    // Expand via keyboard (focus + Enter).
    await detailsBtn.focus();
    await expect(detailsBtn).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(detailsBtn).toHaveAttribute('aria-expanded', 'true');
    await expect(details).toBeVisible();

    // Collapse via keyboard (Space).
    await page.keyboard.press('Space');
    await expect(detailsBtn).toHaveAttribute('aria-expanded', 'false');
    await expect(details).toBeHidden();
  });
});
