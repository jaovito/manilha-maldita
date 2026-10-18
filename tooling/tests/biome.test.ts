import { expect, test } from 'bun:test';
import { mkdir, unlink } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const root = resolve(import.meta.dir, '../..');
async function lintFixture(filename: string, source: string) {
  const filePath = resolve(root, filename);
  if (await Bun.file(filePath).exists()) throw new Error(`Fixture would overwrite ${filename}`);
  await mkdir(dirname(filePath), { recursive: true });
  await Bun.write(filePath, source);
  try {
    const child = Bun.spawn(
      [process.execPath, resolve(root, 'node_modules/@biomejs/biome/bin/biome'), 'lint', filePath],
      { cwd: root, stdout: 'pipe', stderr: 'pipe' },
    );
    const [exitCode, stdout, stderr] = await Promise.all([
      child.exited,
      new Response(child.stdout).text(),
      new Response(child.stderr).text(),
    ]);
    return { exitCode, output: stdout + stderr };
  } finally {
    await unlink(filePath);
  }
}

for (const [filename, source] of [
  ['packages/game-core/src/fixture.ts', 'void Bun;'],
  ['apps/web/src/app/fixture.ts', 'void process;'],
  ['apps/server/src/modules/rooms/domain/fixture.ts', 'fetch("https://example.com");'],
] as const) {
  test(`Biome preserves runtime restrictions for ${filename}`, async () => {
    const result = await lintFixture(filename, source);
    expect(result.exitCode).not.toBe(0);
    expect(result.output).toContain('noRestrictedGlobals');
  });
}

test('Biome rejects conditional React hooks', async () => {
  const result = await lintFixture(
    'apps/web/src/features/lobby/fixture.tsx',
    `
    import { useState } from 'react';
    export function Fixture({ ready }: { ready: boolean }) {
      if (ready) useState(0);
      return null;
    }
  `,
  );
  expect(result.exitCode).not.toBe(0);
  expect(result.output).toContain('useHookAtTopLevel');
});
