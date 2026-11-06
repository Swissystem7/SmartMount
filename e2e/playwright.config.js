// Playwright E2E config (CT-014). Run from the repo root with `npm run test:e2e`.
// It lives under e2e/ with its own package.json so the root package stays
// dependency-free (test/install.test.js and test/pages.test.js enforce that).
// `npm test` (node --test) never loads this file or the specs.
'use strict';

const path = require('node:path');
const { defineConfig, devices } = require('@playwright/test');

const PORT = Number(process.env.E2E_PORT) || 4174;

module.exports = defineConfig({
  testDir: path.join(__dirname, 'tests'),
  testMatch: '**/*.spec.js',
  outputDir: path.join(__dirname, 'test-results'),
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: process.env.CI ? 'line' : 'list',
  use: {
    baseURL: 'http://127.0.0.1:' + PORT,
    locale: 'he-IL',
    trace: 'retain-on-failure'
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    {
      name: 'mobile-360',
      use: { ...devices['Desktop Chrome'], viewport: { width: 360, height: 740 }, isMobile: true, hasTouch: true }
    }
  ],
  webServer: {
    command: 'node "' + path.join(__dirname, 'serve.js') + '"',
    env: { PORT: String(PORT) },
    url: 'http://127.0.0.1:' + PORT + '/index.html',
    reuseExistingServer: !process.env.CI,
    timeout: 30000
  }
});
