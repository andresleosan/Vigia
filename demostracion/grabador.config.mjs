import { defineConfig, devices } from '@playwright/test';
process.env.DEMO_URL ??= 'http://127.0.0.1:8788/demo/';
export default defineConfig({
  testDir: '.', testMatch: ['grabador.spec.mjs','demo.spec.mjs'], timeout: 35000,
  expect: { timeout: 7000 }, reporter: 'list', workers: 2,
  webServer: {
    command: 'node_modules/.bin/wrangler pages dev ../sitio --ip 127.0.0.1 --port 8788 --inspector-port 0 --compatibility-date 2026-10-01',
    url: 'http://127.0.0.1:8788', timeout: 30000, reuseExistingServer: false,
    env: { WRANGLER_SEND_METRICS: 'false', CI: 'true' },
  },
  projects: [
    { name: 'chromium', use: devices['Desktop Chrome'] },
    // Perfil efímero de QA: únicamente el dispositivo sintético interno de Firefox.
    { name: 'firefox', use: { ...devices['Desktop Firefox'], launchOptions: { firefoxUserPrefs: { 'media.navigator.streams.fake': true, 'media.navigator.permission.disabled': true } } } },
    { name: 'webkit', use: devices['Desktop Safari'] },
  ],
});
