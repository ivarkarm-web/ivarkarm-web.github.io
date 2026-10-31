import { defineConfig } from '@playwright/test';
import sourceConfig from './playwright.config.mjs';

/** Staged-output mode: run the same app projects against dist/ as the site root. */
export default defineConfig({
  ...sourceConfig,
  testDir: '.',
  testMatch: [
    'scripts/app-tests/**/*.spec.mjs',
    'scripts/staged-app-tests/**/*.spec.mjs',
  ],
  webServer: {
    ...sourceConfig.webServer,
    command: 'python3 -m http.server 4173 --bind 127.0.0.1 --directory dist',
    url: 'http://127.0.0.1:4173/handpan-app/index.html',
    reuseExistingServer: false,
  },
});
