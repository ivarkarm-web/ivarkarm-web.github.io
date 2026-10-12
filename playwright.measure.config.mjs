import { defineConfig, devices } from '@playwright/test';

/**
 * Separate config for OfflineAudioContext level measurement.
 * testDir is ./scripts/measure so this never runs under app-check
 * (which uses playwright.config.mjs → scripts/app-tests only).
 */
export default defineConfig({
  testDir: './scripts/measure',
  timeout: 120000,
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  reporter: process.env.CI ? [['line'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: 'http://127.0.0.1:4173',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure'
  },
  webServer: {
    command: 'python3 -m http.server 4173 --bind 127.0.0.1 --directory .',
    url: 'http://127.0.0.1:4173/handpan-app/index.html',
    reuseExistingServer: !process.env.CI,
    timeout: 15000
  },
  projects: [
    { name: 'desktop-1280x800', use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 } } }
  ]
});
