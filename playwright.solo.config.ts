import { defineConfig } from '@playwright/test';
import base from './playwright.config';

export default defineConfig({
  ...base,
  testDir: './tests/e2e',
  testIgnore: [],
  workers: 1,
  projects: (base.projects ?? []).flatMap((project) => [
    {
      ...project,
      name: `${project.name}-dev`,
      testMatch: '**/solo/solo.e2e.ts',
      use: { ...project.use, baseURL: 'http://127.0.0.1:5174' },
    },
    {
      ...project,
      name: `${project.name}-production`,
      testMatch: '**/solo/solo-production.e2e.ts',
      use: { ...project.use, baseURL: 'http://127.0.0.1:4174' },
    },
  ]),
  webServer: [
    {
      command:
        'NODE_ENV=development ENABLE_SOLO=true ENABLE_DEV_TOOLS=true PORT=3002 ALLOWED_ORIGINS=http://127.0.0.1:5174,http://127.0.0.1:4174 bun apps/server/src/bootstrap/main.ts',
      url: 'http://127.0.0.1:3002/health',
      reuseExistingServer: false,
    },
    {
      command: 'VITE_BACKEND_URL=http://127.0.0.1:3002 bun run --filter @truco/web dev --port 5174',
      url: 'http://127.0.0.1:5174',
      reuseExistingServer: false,
    },
    {
      command:
        'VITE_BACKEND_URL=http://127.0.0.1:3002 bun run build && bun run --filter @truco/web preview --port 4174',
      url: 'http://127.0.0.1:4174',
      reuseExistingServer: false,
    },
  ],
});
