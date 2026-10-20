import path from 'node:path';
import { parseSync, Visitor } from 'oxc-parser';

/** Follow local barrels too: an inner layer cannot hide an adapter behind an index. */
export function analyzeServerGraph(sources: ReadonlyMap<string, string>): string[] {
  const files = new Map(
    [...sources].map(([file, source]) => [path.resolve(file).replaceAll('\\', '/'), source]),
  );
  const edges = new Map<string, string[]>();

  for (const [file, source] of files) {
    const imports: string[] = [];
    const resolveImport = (specifier: string) => {
      if (!specifier.startsWith('.')) return;
      const base = path.resolve(path.dirname(file), specifier).replaceAll('\\', '/');
      const target = [base, `${base}.ts`, `${base}.tsx`, `${base}/index.ts`].find((candidate) =>
        files.has(candidate),
      );
      if (target) imports.push(target);
    };
    const { program } = parseSync(file, source);
    new Visitor({
      ImportDeclaration(node) {
        resolveImport(node.source.value);
      },
      ExportNamedDeclaration(node) {
        if (node.source) resolveImport(node.source.value);
      },
      ExportAllDeclaration(node) {
        resolveImport(node.source.value);
      },
      ImportExpression(node) {
        if (node.source.type === 'Literal' && typeof node.source.value === 'string')
          resolveImport(node.source.value);
      },
    }).visit(program);
    edges.set(file, imports);
  }

  const issues = new Set<string>();
  for (const file of files.keys()) {
    const domain = file.includes('/domain/');
    const application = file.includes('/application/');
    if (!domain && !application) continue;
    const visited = new Set<string>();
    const inspect = (target: string, route: string[]) => {
      if (visited.has(target)) return;
      visited.add(target);
      const next = [...route, target];
      if (
        /\/(?:adapters|bootstrap)\//.test(target) ||
        (domain && target.includes('/application/'))
      ) {
        issues.add(`Inner-layer dependency crosses an outer layer: ${next.join(' -> ')}`);
        return;
      }
      for (const dependency of edges.get(target) ?? []) inspect(dependency, next);
    };
    for (const target of edges.get(file) ?? []) inspect(target, [file]);
  }

  const completed = new Set<string>();
  const active = new Set<string>();
  const visit = (file: string, route: string[]) => {
    if (active.has(file)) {
      issues.add(
        `Server dependency cycle: ${[...route.slice(route.indexOf(file)), file].join(' -> ')}`,
      );
      return;
    }
    if (completed.has(file)) return;
    active.add(file);
    for (const target of edges.get(file) ?? []) visit(target, [...route, file]);
    active.delete(file);
    completed.add(file);
  };
  for (const file of files.keys()) visit(file, []);
  return [...issues];
}
