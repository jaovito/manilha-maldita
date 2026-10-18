import { expect, test } from 'bun:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { verifyCoverageInventory } from '../coverage/inventory';

test('coverage inventory detects runtime files never imported by any test', async () => {
  const root = await mkdtemp(join(tmpdir(), 'truco-coverage-inventory-'));
  try {
    await Bun.write(
      join(root, 'packages/game-core/src/orphan.ts'),
      'export const orphan = () => 1;',
    );
    await Bun.write(join(root, 'packages/game-core/src/types.ts'), 'export type Seat = number;');
    await Bun.write(join(root, 'coverage/lcov.info'), '');
    const report = { path: join(root, 'coverage/lcov.info'), sourceRoot: root };
    expect((await verifyCoverageInventory(root, [report])).missingFiles).toEqual([
      'packages/game-core/src/orphan.ts',
    ]);
    await Bun.write(report.path, 'SF:packages/game-core/src/orphan.ts\nend_of_record\n');
    expect((await verifyCoverageInventory(root, [report])).missingFiles).toEqual([]);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('Bun coverage exits unsuccessfully below the configured 80% minimum', async () => {
  const root = await mkdtemp(join(tmpdir(), 'truco-coverage-threshold-'));
  try {
    await Bun.write(
      join(root, 'bunfig.toml'),
      `
[test]
coverageThreshold = { lines = 0.8, functions = 0.8 }
coverageReporter = ["text", "lcov"]
coverageSkipTestFiles = true
`,
    );
    await Bun.write(
      join(root, 'sample.ts'),
      `
export function used() { return 1; }
export function unused() { return 2; }
`,
    );
    const testPath = join(root, 'sample.test.ts');
    await Bun.write(
      testPath,
      `
import { expect, test } from 'bun:test';
import { used } from './sample';
test('fixture', () => expect(used()).toBe(1));
`,
    );
    async function run() {
      const child = Bun.spawn([process.execPath, 'test', '--coverage'], {
        cwd: root,
        stdout: 'pipe',
        stderr: 'pipe',
      });
      const [code, stdout, stderr] = await Promise.all([
        child.exited,
        new Response(child.stdout).text(),
        new Response(child.stderr).text(),
      ]);
      return { code, output: stdout + stderr };
    }
    const failing = await run();
    expect(failing.output).toContain('1 pass');
    expect(failing.code).not.toBe(0);
    await Bun.write(
      testPath,
      `
import { expect, test } from 'bun:test';
import { used, unused } from './sample';
test('fixture', () => { expect(used()).toBe(1); expect(unused()).toBe(2); });
`,
    );
    expect((await run()).code).toBe(0);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
