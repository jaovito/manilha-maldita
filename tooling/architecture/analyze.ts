import { builtinModules } from 'node:module';
import path from 'node:path';
import { parseSync, Visitor } from 'oxc-parser';

const builtins = new Set([...builtinModules, ...builtinModules.map((name) => `node:${name}`)]);
const workspaceNames = ['@truco/web', '@truco/server', '@truco/game-core', '@truco/game-protocol'];
// These are explicit package.json exports, not imports into package internals.
const coreEntries = new Set([
  'cards',
  'deal',
  'tricks',
  'hands',
  'betting',
  'match',
  'projections',
]);

function workspaceOf(filename: string) {
  return filename.match(/(?:^|\/)((?:apps|packages)\/[^/]+)\//)?.[1];
}

function groupOf(filename: string, segment: string) {
  return filename.match(new RegExp(`/${segment}/([^/]+)/`))?.[1];
}

export function analyzeSource(filePath: string, code: string): string[] {
  const filename = path.resolve(filePath).replaceAll('\\', '/');
  const origin = workspaceOf(filename);
  if (!origin || !filename.includes('/src/') || /\.(?:test|spec)\.[cm]?[jt]sx?$/.test(filename))
    return [];
  const issues: string[] = [];
  function check(specifier: string) {
    const report = (reason: string) => issues.push(reason);
    const local = specifier.startsWith('.');
    const target = local
      ? path.resolve(path.dirname(filename), specifier).replaceAll('\\', '/')
      : specifier;
    const targetWorkspace = local ? workspaceOf(target) : undefined;
    const publicPackage = workspaceNames.find(
      (name) => specifier === name || specifier.startsWith(`${name}/`),
    );
    const exportedCoreEntry =
      publicPackage === '@truco/game-core' &&
      coreEntries.has(specifier.slice('@truco/game-core/'.length));
    if (publicPackage && specifier !== publicPackage && !exportedCoreEntry) {
      report('Import another workspace through its public package entry, without deep imports.');
      return;
    }
    if (local && targetWorkspace !== origin) {
      report('Do not cross workspace boundaries with relative imports.');
      return;
    }
    if (origin === 'packages/game-core' && !local) {
      report('The game core must not depend on runtime, framework or transport packages.');
      return;
    }
    if (origin === 'packages/game-protocol' && !local && specifier !== 'zod') {
      report('The protocol may depend on Zod and its own files, not server or game state.');
      return;
    }
    if (origin === 'apps/web' && !local) {
      if (
        /^(?:bun(?::|$)|node:)/.test(specifier) ||
        builtins.has(specifier) ||
        specifier === '@truco/server' ||
        specifier.startsWith('@truco/game-core') ||
        /^hono(?:\/|$)/.test(specifier)
      ) {
        report('Browser code cannot import backend/runtime APIs or the private game core.');
        return;
      }
    }
    if (origin === 'apps/server' && filename.includes('/domain/')) {
      if (
        (!local && specifier !== '@truco/game-core') ||
        /\/(?:application|adapters|bootstrap)\//.test(target)
      ) {
        report('Domain code depends only on pure domain code.');
        return;
      }
    }
    if (origin === 'apps/server' && filename.includes('/application/')) {
      if (
        (!local &&
          (/^(?:bun(?::|$)|node:|hono(?:\/|$))/.test(specifier) || builtins.has(specifier))) ||
        (local && /\/(?:adapters|bootstrap)\//.test(target))
      ) {
        report('Application code uses ports rather than concrete adapters or runtime I/O.');
        return;
      }
    }
    const segment = origin === 'apps/web' ? 'features' : 'modules';
    const fromGroup = groupOf(filename, segment);
    const toGroup = groupOf(target, segment);
    if (
      local &&
      fromGroup &&
      toGroup &&
      fromGroup !== toGroup &&
      !new RegExp(`/${segment}/${toGroup}(?:/index(?:\\.[jt]sx?)?)?$`).test(target)
    ) {
      report('Access another module or feature through its public entry.');
    }
    if (origin === 'apps/web' && filename.includes('/shared/') && target.includes('/features/')) {
      report('Shared frontend code cannot depend on a feature.');
    }
  }

  const pure = origin === 'packages/game-core' || filename.includes('/domain/');
  const { program, errors } = parseSync(filename, code);
  for (const error of errors) issues.push(`Unable to analyze source: ${error.message}`);
  const visitor = new Visitor({
    ImportDeclaration(node) {
      check(node.source.value);
    },
    ExportNamedDeclaration(node) {
      if (node.source) check(node.source.value);
    },
    ExportAllDeclaration(node) {
      check(node.source.value);
    },
    ImportExpression(node) {
      if (node.source.type === 'Literal' && typeof node.source.value === 'string')
        check(node.source.value);
    },
    CallExpression(node) {
      if (node.callee.type === 'Identifier' && node.callee.name === 'require') {
        const first = node.arguments[0];
        if (first?.type === 'Literal' && typeof first.value === 'string') check(first.value);
      }
      if (pure && node.callee.type === 'MemberExpression' && !node.callee.computed) {
        const { object, property } = node.callee;
        if (
          object.type === 'Identifier' &&
          property.type === 'Identifier' &&
          ((object.name === 'Math' && property.name === 'random') ||
            (object.name === 'Date' && property.name === 'now'))
        ) {
          issues.push('Inject time and entropy into the domain.');
        }
      }
    },
    NewExpression(node) {
      if (
        pure &&
        node.callee.type === 'Identifier' &&
        node.callee.name === 'Date' &&
        !node.arguments.length
      ) {
        issues.push('Inject time into the domain.');
      }
    },
  });
  visitor.visit(program);
  return issues;
}
