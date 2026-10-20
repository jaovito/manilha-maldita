import { extname, isAbsolute, relative, resolve } from 'node:path';

export type CoverageReport = { path: string; sourceRoot: string };

export async function verifyCoverageInventory(root: string, reports: CoverageReport[]) {
  const measured = new Set<string>();
  for (const report of reports) {
    const file = Bun.file(report.path);
    // Bun may omit LCOV when a suite has no executable application files yet.
    // The source inventory below still rejects every runtime file absent from all reports.
    if (!(await file.exists())) continue;
    const text = await file.text();
    for (const line of text.split('\n')) {
      if (line.startsWith('SF:')) {
        const source = line.slice(3).trim();
        measured.add(isAbsolute(source) ? resolve(source) : resolve(report.sourceRoot, source));
      }
    }
  }
  const candidates = new Set<string>();
  for (const pattern of [
    'apps/*/src/**/*.{ts,tsx,js,jsx,mts,cts,mjs,cjs}',
    'packages/*/src/**/*.{ts,tsx,js,jsx,mts,cts,mjs,cjs}',
    'tooling/architecture/analyze.ts',
    'tooling/architecture/graph.ts',
    'apps/server/database/**/*.ts',
  ]) {
    for await (const source of new Bun.Glob(pattern).scan({ cwd: root, onlyFiles: true })) {
      if (
        /\.(?:d\.[cm]?ts|test\.[cm]?[jt]sx?|spec\.[cm]?[jt]sx?|e2e\.[jt]s)$/.test(source) ||
        /\/(?:node_modules|dist|tests|__tests__)\//.test(source) ||
        [
          'apps/server/database/cli.ts',
          'apps/server/database/schema.ts',
          'apps/server/database/seeds/registry.ts',
        ].includes(source)
      )
        continue;
      const code = await Bun.file(resolve(root, source)).text();
      const output = new Bun.Transpiler({ loader: extname(source).endsWith('x') ? 'tsx' : 'ts' })
        .transformSync(code)
        .trim();
      // Interfaces, declarations and type-only exports have no executable coverage.
      if (!output || /^export\s*\{\s*\};?$/.test(output)) continue;
      candidates.add(resolve(root, source));
    }
  }
  return {
    runtimeFiles: [...candidates].map((file) => relative(root, file)),
    missingFiles: [...candidates]
      .filter((file) => !measured.has(file))
      .map((file) => relative(root, file)),
  };
}
