import { expect, test as base } from '@playwright/test';
import cleanupPlayerFixtures from '../player-cleanup';

export { expect } from '@playwright/test';
export type { Locator, Page } from '@playwright/test';

/** Each scenario owns real server state, including its unchanged HTTP/IP limits. */
export const test = base.extend<{ playerServer: undefined }>({
  playerServer: [
    async ({ baseURL }, use) => {
      if (baseURL !== 'http://127.0.0.1:4173') throw new Error('PLAYER_LOCAL_PREVIEW_REQUIRED');

      // Refuse an occupied port instead of accidentally using another local server.
      const probe = Bun.serve({
        hostname: '127.0.0.1',
        port: 3001,
        fetch: () => new Response(null, { status: 503 }),
      });
      await probe.stop(true);
      const server = Bun.spawn(['bun', 'tests/e2e/player-server.ts'], {
        stdout: 'ignore',
        stderr: 'inherit',
      });
      let ready = false;

      try {
        await expect
          .poll(
            async () => {
              if (server.exitCode !== null) throw new Error('PLAYER_SERVER_START_FAILED');

              try {
                const response = await fetch('http://127.0.0.1:3001/health');
                return response.ok;
              } catch {
                return false;
              }
            },
            { timeout: 30_000, intervals: [50, 100, 250] },
          )
          .toBe(true);
        ready = true;
        await use(undefined);
      } finally {
        try {
          if (ready && server.exitCode === null) await cleanupPlayerFixtures();
        } finally {
          server.kill('SIGTERM');
          const deadline = setTimeout(() => server.kill('SIGKILL'), 10_000);
          try {
            await server.exited;
          } finally {
            clearTimeout(deadline);
          }
        }
      }
    },
    { auto: true },
  ],
});
