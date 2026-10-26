import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e/player',
  testMatch: '**/*.e2e.ts',
  workers: 1,
  globalTeardown: './tests/e2e/player-cleanup.ts',
  timeout: 60_000,
  use: { baseURL: 'http://127.0.0.1:4173', actionTimeout: 10_000, trace: 'retain-on-failure' },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile-chromium', use: { ...devices['Pixel 7'] } },
  ],
  webServer: [
    {
      command: 'bun tests/e2e/player-server.ts',
      url: 'http://127.0.0.1:3001/health',
      reuseExistingServer: false,
      timeout: 30_000,
    },
    {
      command: 'bun run build && bun run --filter @truco/web preview',
      url: 'http://127.0.0.1:4173',
      reuseExistingServer: false,
      timeout: 60_000,
    },
  ],
});
