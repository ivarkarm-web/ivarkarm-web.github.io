/**
 * Harness helper: first-visit storage/privacy notice can overlay the welcome
 * screen and intercept pointer events (e.g. clicking #enterPionier) in fresh
 * Playwright contexts. Dismiss via the real Continue action when present so
 * notice functionality remains exercised/intact (not hidden globally/disabled).
 */
export async function dismissStorageNoticeIfNeeded(page) {
  const notice = page.locator('#pionierStorageNotice');
  const continueBtn = page.locator('#pionierStorageNoticeContinue');
  if (!(await continueBtn.isVisible().catch(() => false))) return;
  await continueBtn.click();
  await notice.waitFor({ state: 'hidden', timeout: 5000 });
}
