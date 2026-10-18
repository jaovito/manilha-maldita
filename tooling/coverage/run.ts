import { rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { verifyCoverageInventory } from './inventory';

const root = resolve(import.meta.dir, '../..');
await rm(resolve(root, 'coverage'), { recursive: true, force: true });

const suites = [
  {
    name: 'server',
    cwd: root,
    tests: [
      './tooling/tests',
      './packages',
      './apps/server/src',
      './apps/server/tests/integration',
    ],
  },
  { name: 'web', cwd: resolve(root, 'apps/web'), tests: [] },
  { name: 'database', cwd: root, tests: ['./apps/server/tests/database'] },
];

for (const suite of suites) {
  if (suite.name === 'database') {
    const compose = Bun.spawn(
      ['docker', 'compose', '--profile', 'test', 'up', '-d', '--wait', 'postgres-test'],
      {
        cwd: root,
        stdin: 'inherit',
        stdout: 'inherit',
        stderr: 'inherit',
      },
    );
    const code = await compose.exited;
    if (code !== 0) process.exit(code);
  }
  const child = Bun.spawn(
    [
      process.execPath,
      'test',
      '--coverage',
      `--coverage-dir=${resolve(root, 'coverage', suite.name)}`,
      ...suite.tests,
    ],
    { cwd: suite.cwd, stdin: 'inherit', stdout: 'inherit', stderr: 'inherit' },
  );
  const code = await child.exited;
  if (code !== 0) process.exit(code);
}

const result = await verifyCoverageInventory(
  root,
  suites.map((suite) => ({
    path: resolve(root, 'coverage', suite.name, 'lcov.info'),
    sourceRoot: suite.cwd,
  })),
);
if (result.missingFiles.length) {
  for (const file of result.missingFiles)
    console.error(`No coverage report for runtime source: ${file}`);
  process.exit(1);
}
console.log(
  `Coverage inventory verified: ${result.runtimeFiles.length} runtime source files measured.`,
);
