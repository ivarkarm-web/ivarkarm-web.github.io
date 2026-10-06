import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './scripts/app-tests',
  timeout: 15000,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,
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
    { name: 'mobile-390x844', use: { ...devices['Desktop Chrome'], viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } },
    { name: 'desktop-1280x800', use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 } } }
  ]
});
