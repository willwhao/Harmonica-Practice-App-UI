import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  retries: 0,
  reporter: 'line',
  use: {
    baseURL: 'http://127.0.0.1:4174',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'npm run build && npm run preview:e2e',
    url: 'http://127.0.0.1:4174',
    reuseExistingServer: false,
  },
  projects: [
    { name: 'chrome-mobile', use: { ...devices['Pixel 7'], channel: 'chrome' } },
    { name: 'edge-mobile', use: { ...devices['Pixel 7'], channel: 'msedge' } },
  ],
});
