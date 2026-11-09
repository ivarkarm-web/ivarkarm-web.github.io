import { defineConfig, devices } from '@playwright/test';

/**
 * Default projects block service workers so route() failure-injection tests stay reliable.
 * The `sw-desktop` project allows SW and only runs phase5-sw.spec.mjs (offline shell proof).
 */
const serveDir = process.env.PW_SERVE_DIR || '.';

export default defineConfig({
  testDir: './scripts/app-tests',
  // The suite boots a large static app and several Web Audio flows. On older
  // local hardware 20s was routinely exceeded during page boot and teardown,
  // producing environment timeouts rather than product failures. Assertions
  // below are unchanged; individual long flows still set their own budgets.
  timeout: 60000,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  // Run one browser at a time locally. Parallel Web Audio specs plus failure
  // video encoding saturated older Intel Macs and caused boot timeouts; CI
  // still uses two workers on dedicated hardware.
  workers: process.env.CI ? 2 : 1,
  reporter: process.env.CI ? [['line'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: 'http://127.0.0.1:4173',
    serviceWorkers: 'block',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  webServer: {
    // Use a threaded HTTP server instead of the default single-threaded
    // python3 -m http.server. When Playwright fetches ~50 ES modules
    // concurrently across multiple browser contexts the single thread
    // serialises all requests and causes startup timeouts. The threaded
    // variant handles each connection in its own thread.
    // PW_SERVE_DIR overrides the served site root (e.g. "dist") for production-
    // artifact verification; default "." preserves existing behavior and paths.
    command: `python3 scripts/serve-threaded.py 4173 --bind 127.0.0.1 --directory ${serveDir}`,
    url: 'http://127.0.0.1:4173/handpan-app/index.html',
    reuseExistingServer: !process.env.CI,
    timeout: 15000,
  },
  projects: [
    {
      name: 'mobile-360x640',
      use: { ...devices['Desktop Chrome'], viewport: { width: 360, height: 640 }, isMobile: true, hasTouch: true },
      testIgnore: /phase5-sw\.spec\.mjs/,
    },
    {
      name: 'mobile-390x844',
      use: { ...devices['Desktop Chrome'], viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true },
      testIgnore: /phase5-sw\.spec\.mjs/,
    },
    {
      name: 'mobile-320x568',
      use: { ...devices['Desktop Chrome'], viewport: { width: 320, height: 568 }, isMobile: true, hasTouch: true },
      testIgnore: /phase5-sw\.spec\.mjs/,
    },
    {
      name: 'mobile-430x932',
      use: { ...devices['Desktop Chrome'], viewport: { width: 430, height: 932 }, isMobile: true, hasTouch: true },
      testIgnore: /phase5-sw\.spec\.mjs/,
    },
    {
      name: 'desktop-1280x800',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 } },
      testIgnore: /phase5-sw\.spec\.mjs/,
    },
    {
      name: 'sw-desktop',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1280, height: 800 },
        serviceWorkers: 'allow',
      },
      testMatch: /phase5-sw\.spec\.mjs/,
    },
  ],
});
