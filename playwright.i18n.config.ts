import { defineConfig } from '@playwright/test';
import solo from './playwright.solo.config';

export default defineConfig({
  ...solo,
  testDir: './tests/e2e',
  projects: (solo.projects ?? [])
    .filter((project) => project.name?.endsWith('-dev'))
    .map((project) => ({
      ...project,
      testMatch: ['**/settings/i18n.e2e.ts', '**/tutorial/tutorial.e2e.ts'],
    })),
  webServer: Array.isArray(solo.webServer) ? solo.webServer.slice(0, 2) : (solo.webServer ?? []),
});
