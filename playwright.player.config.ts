import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e/player',
  testMatch: '**/*.e2e.ts',
  outputDir: 'test-results/player',
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report/player' }]],
  workers: 1,
  timeout: 60_000,
  use: {
    baseURL: 'http://127.0.0.1:4173',
    actionTimeout: 10_000,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile-chromium', use: { ...devices['Pixel 7'] } },
  ],
  webServer: [
    {
      command: 'bun run build && bun run --filter @truco/web preview',
      url: 'http://127.0.0.1:4173',
      reuseExistingServer: false,
      timeout: 60_000,
    },
  ],
});
