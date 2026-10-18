import { expect, test } from 'bun:test';
import { builtinModules } from 'node:module';
import { resolve } from 'node:path';
import fc from 'fast-check';
import { analyzeSource } from '../architecture/analyze';

type Manifest = {
  name: string;
  private: boolean;
  dependencies?: Record<string, string>;
};
const root = resolve(import.meta.dir, '../..');
const workspacePaths = [
  'apps/web',
  'apps/server',
  'packages/game-core',
  'packages/game-protocol',
  'packages/game-sim',
];

async function manifests() {
  return Promise.all(
    workspacePaths.map(async (directory) => {
      const manifest: Manifest = await Bun.file(resolve(root, directory, 'package.json')).json();
      return manifest;
    }),
  );
}

test('workspace dependencies resolve locally and form an acyclic graph', async () => {
  const packages = await manifests();
  const graph = new Map(
    packages.map((manifest) => [
      manifest.name,
      Object.keys(manifest.dependencies ?? {}).filter((name) => name.startsWith('@truco/')),
    ]),
  );
  function visit(name: string, ancestors: Set<string>) {
    expect(graph.has(name)).toBe(true);
    expect(ancestors.has(name)).toBe(false);
    const next = new Set([...ancestors, name]);
    for (const dependency of graph.get(name) ?? []) visit(dependency, next);
  }
  for (const manifest of packages) {
    expect(manifest.private).toBe(true);
    for (const [name, version] of Object.entries(manifest.dependencies ?? {})) {
      if (name.startsWith('@truco/')) expect(version).toBe('workspace:*');
    }
    visit(manifest.name, new Set());
  }
});

test('generated builtin imports are rejected at the pure-domain boundary', async () => {
  await fc.assert(
    fc.asyncProperty(
      fc.constantFrom(...builtinModules.filter((name) => !name.startsWith('_'))),
      fc.constantFrom('import', 'export'),
      async (name, form) => {
        const specifier = name.startsWith('node:') ? name : `node:${name}`;
        const code = form === 'import' ? `import '${specifier}';` : `export * from '${specifier}';`;
        expect(
          analyzeSource('packages/game-core/src/cards/builtin-fixture.ts', code).length,
        ).toBeGreaterThan(0);
      },
    ),
    { seed: 20261017, numRuns: 30 },
  );
});
