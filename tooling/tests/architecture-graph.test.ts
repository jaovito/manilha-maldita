import { expect, test } from 'bun:test';
import { analyzeServerGraph } from '../architecture/graph';

const root = '/repo/apps/server/src/';
const graph = (sources: Record<string, string>) =>
  new Map(Object.entries(sources).map(([file, source]) => [root + file, source]));

test('server graph permits inward dependencies and shared leaves', () => {
  expect(
    analyzeServerGraph(
      graph({
        'bootstrap/main.ts': "import '../modules/rooms/adapters/http';",
        'modules/rooms/adapters/http.ts': "import '../application/use-cases/join';",
        'modules/rooms/application/use-cases/join.ts':
          "import '../../domain/room'; import '../../domain/member';",
        'modules/rooms/domain/room.ts': "import './member';",
        'modules/rooms/domain/member.ts': 'export type Member = { name: string };',
      }),
    ),
  ).toEqual([]);
});

test('barrels cannot hide a dependency on an outer layer', () => {
  const issues = analyzeServerGraph(
    graph({
      'modules/rooms/application/join.ts': "import '../../sessions';",
      'modules/sessions/index.ts': "export * from './composition';",
      'modules/sessions/composition.ts': "export { store } from './adapters/memory';",
      'modules/sessions/adapters/memory.ts': 'export const store = new Map();',
    }),
  );
  expect(issues).toHaveLength(1);
  expect(issues[0]).toContain('Inner-layer dependency');
  expect(issues[0]).toContain('sessions/adapters/memory.ts');
});

test('domain cannot reach application indirectly, including dynamic imports', () => {
  const issues = analyzeServerGraph(
    graph({
      'modules/rooms/domain/room.ts': "void import('../shared');",
      'modules/rooms/shared.ts': "export * from './application/service.ts';",
      'modules/rooms/application/service.ts': 'export const service = 1;',
    }),
  );
  expect(issues).toHaveLength(1);
  expect(issues[0]).toContain('application/service.ts');
});

test('server cycles are reported once and traversal terminates', () => {
  const issues = analyzeServerGraph(
    graph({
      'modules/rooms/application/a.ts': "import './b'; import './shared';",
      'modules/rooms/application/b.ts': "import './a'; import './shared';",
      'modules/rooms/application/shared.ts': 'export type Value = number;',
    }),
  );
  expect(issues).toHaveLength(1);
  expect(issues[0]).toContain('Server dependency cycle');
});

test('graph ignores external dependencies and unresolved edges handled by typecheck', () => {
  expect(
    analyzeServerGraph(
      graph({
        'modules/rooms/application/join.ts':
          "import '@truco/game-core/match'; import './missing'; void import(name);",
      }),
    ),
  ).toEqual([]);
});
