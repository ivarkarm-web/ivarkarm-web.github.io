import { test } from '@playwright/test';

test('diagnose routing and controlled AudioWorklet.addModule rejection', async ({ page, browserName, browser }) => {
  const events = [];
  page.on('request', (request) => events.push({ type: 'request', url: request.url(), resourceType: request.resourceType() }));
  page.on('requestfinished', (request) => events.push({ type: 'requestfinished', url: request.url() }));
  page.on('requestfailed', (request) => events.push({ type: 'requestfailed', url: request.url(), failure: request.failure()?.errorText }));
  page.on('response', (response) => events.push({ type: 'response', url: response.url(), status: response.status() }));
  await page.route('**/*', async (route) => {
    const url = route.request().url();
    const match = url.includes('ordinary-module.js') || url.includes('looper-recorder-worklet.js');
    if (match) events.push({ type: 'route-handler', url, resourceType: route.request().resourceType() });
    if (url.includes('ordinary-module.js')) return route.fulfill({ status: 200, contentType: 'application/javascript', body: 'window.ordinaryModuleLoaded = true;' });
    if (url.includes('looper-recorder-worklet.js')) return route.abort('failed');
    return route.continue();
  });

  console.log('DIAG browser', JSON.stringify({ browserName, version: browser.version() }));
  await page.goto('/handpan-app/');
  const ordinary = await page.evaluate(async () => {
    await import('/ordinary-module.js');
    return window.ordinaryModuleLoaded === true;
  });
  console.log('DIAG ordinary module loaded', ordinary);
  const worklet = await page.evaluate(async () => {
    const context = new AudioContext();
    try {
      await context.audioWorklet.addModule('/handpan-app/js/looper-recorder-worklet.js?v=diagnostic');
      return { settled: 'resolved' };
    } catch (error) {
      return { settled: 'rejected', name: error.name, message: error.message };
    } finally {
      await context.close();
    }
  });
  console.log('DIAG routed addModule result', JSON.stringify(worklet));
  console.log('DIAG route/network events', JSON.stringify(events));

  // Exercise the application's real recorder path with a deterministic browser-side rejection.
  await page.addInitScript(() => {
    const proto = window.AudioWorklet?.prototype;
    if (!proto) return;
    const original = proto.addModule;
    Object.defineProperty(proto, 'addModule', {
      configurable: true,
      writable: true,
      value(url, options) {
        window.__workletStubCalls = (window.__workletStubCalls || 0) + 1;
        console.log('[DIAG stub] AudioWorklet.addModule rejected', String(url));
        return Promise.reject(new DOMException('Diagnostic forced addModule rejection', 'NetworkError'));
      },
    });
    window.__workletOriginalAddModuleType = typeof original;
  });
  await page.reload();
  const enter = page.locator('#enterPionier');
  if (await enter.isVisible().catch(() => false)) await enter.click();
  await page.waitForFunction(() => !!window.PionierCore, null, { timeout: 15000 });
  const record = page.locator('#looperBtn');
  await record.click();
  await page.waitForFunction(() => window.__workletStubCalls > 0, null, { timeout: 5000 });
  await page.locator('#appStatusMessage').waitFor({ state: 'visible', timeout: 5000 }).catch(() => {});
  console.log('DIAG stub results', JSON.stringify(await page.evaluate(() => ({
    calls: window.__workletStubCalls || 0,
    originalType: window.__workletOriginalAddModuleType,
    buttonClass: document.querySelector('#looperBtn')?.className,
    statusState: document.querySelector('#appStatus')?.dataset.state,
    statusText: document.querySelector('#appStatusMessage')?.textContent,
  }))));
});
