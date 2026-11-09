/** Standalone diagnostic that bypasses trusted audio activation for the rejected AudioWorklet recorder path. */
import { test } from '@playwright/test';

const STEP_TIMEOUT = 3000;

async function step(name, operation, timeout = STEP_TIMEOUT) {
  console.log(`[worklet-diagnostic] START ${name}`);
  let timer;
  try {
    const result = await Promise.race([
      operation(),
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error(`${name} timed out after ${timeout}ms`)), timeout);
      }),
    ]);
    console.log(`[worklet-diagnostic] DONE ${name}`, result === undefined ? '' : JSON.stringify(result));
    return result;
  } catch (error) {
    console.log(`[worklet-diagnostic] FAILED ${name}: ${error?.stack || error}`);
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

test('diagnostic (bypasses trusted audio activation): rejected AudioWorklet recorder operations', async ({ page }) => {
  page.setDefaultTimeout(STEP_TIMEOUT);

  await step('install AudioWorklet rejection stub', () => page.addInitScript(() => {
    const proto = window.AudioWorklet?.prototype;
    if (!proto) return;
    Object.defineProperty(proto, 'addModule', {
      configurable: true,
      writable: true,
      value() {
        document.documentElement.dataset.workletStubCalls = String(
          Number(document.documentElement.dataset.workletStubCalls || 0) + 1,
        );
        return Promise.reject(new DOMException('Diagnostic forced addModule rejection', 'NetworkError'));
      },
    });
  }));

  await step('load /handpan-app/', () => page.goto('/handpan-app/', { waitUntil: 'domcontentloaded', timeout: 5000 }), 5500);

  await step('diagnostic bypass: remove welcome-active class without trusted audio activation', () => page.evaluate(() => {
    const welcomeRoot = document.documentElement;
    const wasActive = welcomeRoot.classList.contains('pionier-welcome-active');
    welcomeRoot.classList.remove('pionier-welcome-active');
    const welcome = document.querySelector('#pionierWelcome');
    if (!welcome) throw new Error('Diagnostic bypass failed: #pionierWelcome was not found');
    welcome.style.display = 'none';
    return {
      wasActive,
      activeAfterBypass: welcomeRoot.classList.contains('pionier-welcome-active'),
      welcomeDisplay: getComputedStyle(welcome).display,
    };
  }));

  await step('wait for and log PionierCore readiness', async () => {
    await page.waitForFunction(() => !!window.PionierCore, null, { timeout: STEP_TIMEOUT });
    const ready = await page.evaluate(() => !!window.PionierCore);
    console.log('[worklet-diagnostic] PionierCore ready', JSON.stringify({ ready }));
    return { ready };
  });
  await step('wait for and log PionierLooper readiness', async () => {
    await page.waitForFunction(() => !!window.PionierLooper, null, { timeout: STEP_TIMEOUT });
    const ready = await page.evaluate(() => !!window.PionierLooper);
    console.log('[worklet-diagnostic] PionierLooper ready', JSON.stringify({ ready }));
    return { ready };
  });

  const record = page.locator('#looperBtn');
  await step('wait for Record button readiness', () => record.waitFor({ state: 'visible', timeout: STEP_TIMEOUT }));
  await step('inspect Record button before click', async () => {
    const [boundingBox, visible, enabled, disabledAttribute, hitTest] = await Promise.all([
      record.boundingBox(),
      record.isVisible(),
      record.isEnabled(),
      record.getAttribute('disabled'),
      record.evaluate((button) => {
        const { x, y, width, height } = button.getBoundingClientRect();
        const element = document.elementFromPoint(x + width / 2, y + height / 2);
        return {
          pointerEvents: getComputedStyle(button).pointerEvents,
          elementFromPoint: element
            ? { tag: element.tagName, id: element.id, class: element.className }
            : null,
        };
      }),
    ]);
    return {
      boundingBox,
      visible,
      enabled,
      disabledAttribute,
      computedPointerEvents: hitTest.pointerEvents,
      elementFromPoint: hitTest.elementFromPoint,
    };
  });
  await step('verify welcome overlay does not intercept Record', async () => {
    const hitTest = await record.evaluate((button) => {
      const { x, y, width, height } = button.getBoundingClientRect();
      const element = document.elementFromPoint(x + width / 2, y + height / 2);
      return element
        ? { tag: element.tagName, id: element.id, class: element.className }
        : null;
    });
    console.log('[worklet-diagnostic] Record center elementFromPoint', JSON.stringify(hitTest));
    if (hitTest?.id === 'pionierWelcome') {
      throw new Error('Diagnostic isolation failed: #pionierWelcome still intercepts the Record button center');
    }
    return hitTest;
  });
  console.log('[worklet-diagnostic] START click Record');
  try {
    await record.click({ timeout: 2500 });
    console.log('[worklet-diagnostic] DONE click Record');
  } catch (error) {
    console.error('[worklet-diagnostic] FAILED click Record; full Playwright error follows');
    console.error(error);
    throw error;
  }
  await step('wait for degraded alert', async () => {
    await page.locator('#appStatus[data-state="degraded"]').waitFor({ state: 'visible', timeout: STEP_TIMEOUT });
    return await page.locator('#appStatusMessage').textContent({ timeout: STEP_TIMEOUT });
  });
  await step('read Record button class', () => record.getAttribute('class', { timeout: STEP_TIMEOUT }));
  await step('read looper state', () => page.evaluate(() => window.PionierLooper?.getState()));
});
