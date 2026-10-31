import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './scripts/diagnostics',
  timeout: 30000,
  use: {
    ...devices['Desktop Chrome'],
    baseURL: 'http://127.0.0.1:4173',
    serviceWorkers: 'block',
    trace: 'off',
  },
  webServer: {
    command: 'python3 -m http.server 4173 --bind 127.0.0.1 --directory .',
    url: 'http://127.0.0.1:4173/handpan-app/index.html',
    reuseExistingServer: true,
    timeout: 15000,
  },
});
