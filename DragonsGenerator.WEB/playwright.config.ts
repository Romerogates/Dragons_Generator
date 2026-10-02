import { defineConfig, devices } from '@playwright/test';

const baseURL = process.env['E2E_BASE_URL'] ?? 'http://localhost:8081';

export default defineConfig({
  testDir: './e2e',
  // Specs CI smoke are independent files; parallelize on CI to cut wall time.
  fullyParallel: !!process.env['CI'],
  forbidOnly: !!process.env['CI'],
  retries: process.env['CI'] ? 1 : 0,
  workers: process.env['CI'] ? 2 : 1,
  timeout: 60_000,
  globalTimeout: process.env['CI'] ? 10 * 60_000 : undefined,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL,
    trace: 'on-first-retry',
    locale: 'fr-FR',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: process.env['E2E_BASE_URL']
    ? undefined
    : {
        command: 'npm run start -- --port 8081 --host 0.0.0.0',
        url: baseURL,
        reuseExistingServer: !process.env['CI'],
        timeout: 120_000,
      },
});
