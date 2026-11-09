import { test, expect } from '@playwright/test';

test('staged Pionier boot has no browser errors or failed local asset requests', async ({ page }, testInfo) => {
  const consoleErrors = [];
  const pageErrors = [];
  const failedRequests = [];
  const badResponses = [];
  const origin = 'http://127.0.0.1:4173';

  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  page.on('pageerror', (error) => pageErrors.push(error.message));
  page.on('requestfailed', (request) => {
    failedRequests.push({ url: request.url(), error: request.failure()?.errorText || 'unknown' });
  });
  page.on('response', (response) => {
    if (response.status() >= 400) badResponses.push({ url: response.url(), status: response.status() });
  });

  const response = await page.goto('/handpan-app/', { waitUntil: 'domcontentloaded' });
  expect(response?.status()).toBe(200);
  const enter = page.locator('#enterPionier');
  if (await enter.isVisible().catch(() => false)) await enter.click();
  await expect.poll(() => page.evaluate(() => window.PionierBootState), { timeout: 15000 }).toBe('ready');
  await expect.poll(() => page.evaluate(() => !!window.PionierLooper), { timeout: 15000 }).toBe(true);
  await page.waitForTimeout(2500);

  const localFailures = failedRequests.filter((item) => item.url.startsWith(origin));
  const localBadResponses = badResponses.filter((item) => item.url.startsWith(origin));
  await testInfo.attach('staged-browser-diagnostics.json', {
    body: Buffer.from(JSON.stringify({ consoleErrors, pageErrors, failedRequests, badResponses }, null, 2)),
    contentType: 'application/json',
  });
  console.log(JSON.stringify({ consoleErrors, pageErrors, failedRequests, badResponses }));

  expect(consoleErrors, 'browser console errors').toEqual([]);
  expect(pageErrors, 'uncaught page errors').toEqual([]);
  expect(localFailures, 'failed requests to staged local assets').toEqual([]);
  expect(localBadResponses, 'HTTP errors from staged local assets').toEqual([]);
});
