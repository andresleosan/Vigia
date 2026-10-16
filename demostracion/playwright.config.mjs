import { defineConfig, devices } from '@playwright/test';
export default defineConfig({testDir:'.',testMatch:'demo.spec.mjs',timeout:30000,expect:{timeout:10000},reporter:'list',projects:[{name:'chromium',use:devices['Desktop Chrome']},{name:'firefox',use:devices['Desktop Firefox']},{name:'webkit',use:devices['Desktop Safari']}]});
