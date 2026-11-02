import { expect, test } from 'bun:test';
import guest from '../../playwright.config';
import player from '../../playwright.player.config';

type Step = {
  run?: string;
  uses?: string;
  if?: string;
  env?: Record<string, string>;
  with?: { path?: string; 'retention-days'?: number };
};

test('each required browser gate runs guest and persistent player flows with isolated servers', async () => {
  const ci = Bun.YAML.parse(await Bun.file('.github/workflows/ci.yml').text()) as {
    jobs: { browser: { needs: string; steps: Step[] } };
  };
  const { steps } = ci.jobs.browser;
  const guestIndex = steps.findIndex((step) => step.run?.startsWith('bun run test:e2e --'));
  const databaseIndex = steps.findIndex((step) => step.run === 'bun run db:test:up');
  const playerIndex = steps.findIndex((step) => step.run?.startsWith('bun run test:e2e:player'));

  expect(ci.jobs.browser.needs).toBe('verify');
  expect(guestIndex).toBeGreaterThanOrEqual(0);
  expect(databaseIndex).toBeGreaterThan(guestIndex);
  expect(playerIndex).toBeGreaterThan(databaseIndex);
  expect(steps[guestIndex]?.env).toEqual({ ENABLE_ACCOUNTS: 'false', VITE_BACKEND_URL: '' });
  expect(steps[playerIndex]?.run).toBe(`bun run test:e2e:player --project=\${{ matrix.project }}`);
  expect(steps[playerIndex]?.if).toBeUndefined();
  expect(steps[playerIndex]?.env).toEqual({ VITE_BACKEND_URL: '' });
  expect(player.workers).toBe(1);
  expect(player.retries).toBe(0);
  expect(player.testDir).toBe('./tests/e2e/player');
  expect(player.webServer).toBeArray();
  if (!Array.isArray(player.webServer)) throw new Error('MISSING_PLAYER_SERVERS');

  expect(player.webServer).toHaveLength(1);
  for (const server of player.webServer) expect(server.reuseExistingServer).toBe(false);
  expect(player.globalTeardown).toBeUndefined();

  for await (const file of new Bun.Glob('tests/e2e/player/*.e2e.ts').scan()) {
    const source = await Bun.file(file).text();
    expect(source).toContain("from '../support/player-test'");
    expect(source).not.toContain("from '@playwright/test'");
  }
});

test('failure evidence survives a successful retry and the next browser suite', async () => {
  const ci = Bun.YAML.parse(await Bun.file('.github/workflows/ci.yml').text()) as {
    jobs: { browser: { steps: Step[] } };
  };
  const artifact = ci.jobs.browser.steps.find((step) =>
    step.uses?.startsWith('actions/upload-artifact@'),
  );

  expect(artifact?.if).toBe(`\${{ !cancelled() }}`);
  expect(artifact?.with?.path).toBe('test-results/\nplaywright-report/\n');
  expect(artifact?.with?.['retention-days']).toBe(7);
  expect(guest.outputDir).toBe('test-results/guest');
  expect(player.outputDir).toBe('test-results/player');
  expect(guest.reporter).toContainEqual([
    'html',
    { open: 'never', outputFolder: 'playwright-report/guest' },
  ]);
  expect(player.reporter).toContainEqual([
    'html',
    { open: 'never', outputFolder: 'playwright-report/player' },
  ]);
  for (const config of [guest, player]) {
    expect(config.use?.trace).toBe('retain-on-failure');
    expect(config.use?.screenshot).toBe('only-on-failure');
  }
});
