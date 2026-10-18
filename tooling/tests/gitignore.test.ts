import { expect, test } from 'bun:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

test('Git includes coverage tooling while excluding generated reports and local secrets', async () => {
  const root = await mkdtemp(join(tmpdir(), 'truco-gitignore-'));

  async function git(args: string[], input = '') {
    const child = Bun.spawn(['git', ...args], {
      cwd: root,
      stdin: 'pipe',
      stdout: 'pipe',
      stderr: 'pipe',
    });
    child.stdin.write(input);
    child.stdin.end();
    const [code, output, error] = await Promise.all([
      child.exited,
      new Response(child.stdout).text(),
      new Response(child.stderr).text(),
    ]);

    return { code, output, error };
  }

  try {
    await Bun.write(
      join(root, '.gitignore'),
      Bun.file(resolve(import.meta.dir, '../../.gitignore')),
    );
    expect((await git(['init', '--quiet'])).code).toBe(0);
    const sources = ['tooling/coverage/inventory.ts', 'tooling/coverage/run.ts', '.env.example'];
    const included = await git(['check-ignore', '--no-index', '--stdin'], sources.join('\n'));
    expect(included.code).toBe(1);
    expect(included.output).toBe('');
    expect(included.error).toBe('');

    const generated = [
      'coverage/server/lcov.info',
      'apps/web/coverage/lcov.info',
      'packages/game-core/coverage/lcov.info',
      'node_modules/example/index.js',
      'apps/web/dist/index.html',
      'test-results/report.json',
      '.env',
      '.env.local',
    ];
    const ignored = await git(['check-ignore', '--no-index', '--stdin'], generated.join('\n'));
    expect(ignored.code).toBe(0);
    expect(ignored.output.trim().split('\n')).toEqual(generated);
    expect(ignored.error).toBe('');
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
