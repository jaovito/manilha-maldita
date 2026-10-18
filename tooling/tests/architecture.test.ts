import { expect, test } from 'bun:test';
import { analyzeSource } from '../architecture/analyze';

const blocked = [
  ['packages/game-core/src/cards/fixture.ts', "import 'hono';"],
  ['packages/game-core/src/cards/fixture.ts', "import '@truco/game-protocol';"],
  ['packages/game-core/src/cards/fixture.ts', 'Math.random();'],
  ['packages/game-core/src/cards/fixture.ts', 'Date.now();'],
  ['apps/web/src/app/fixture.ts', "import 'bun';"],
  ['apps/web/src/app/fixture.ts', "import 'node:fs';"],
  ['apps/web/src/app/fixture.ts', "import '@truco/game-core';"],
  ['apps/web/src/app/fixture.ts', "import '@truco/game-core/match';"],
  ['apps/server/src/bootstrap/fixture.ts', "import '@truco/game-core/match/internal';"],
  ['apps/web/src/app/fixture.ts', "import '@truco/game-protocol/src/private';"],
  ['apps/web/src/features/lobby/fixture.ts', "import '../match/model/private';"],
  ['apps/server/src/modules/rooms/domain/fixture.ts', "import 'hono';"],
  ['apps/server/src/modules/rooms/application/fixture.ts', "import '../adapters/store';"],
  [
    'apps/server/src/modules/rooms/application/fixture.ts',
    "import '../../matches/application/private';",
  ],
  ['apps/web/src/app/fixture.ts', "import '../../../server/src/bootstrap/private';"],
] as const;

for (const [filePath, code] of blocked) {
  test(`architecture rejects ${code} in ${filePath}`, () => {
    expect(analyzeSource(filePath, code).length).toBeGreaterThan(0);
  });
}

for (const [filePath, code] of [
  ['apps/web/src/features/lobby/fixture.ts', "import '../match';"],
  ['apps/web/src/features/lobby/fixture.ts', "import '../match/index.ts';"],
  ['apps/web/src/app/fixture.ts', "import '@truco/game-protocol';"],
  ['apps/server/src/modules/matches/application/fixture.ts', "import '@truco/game-core';"],
  ['apps/server/src/modules/matches/application/fixture.ts', "import '@truco/game-core/match';"],
  ['packages/game-core/src/cards/fixture.ts', "import './rank';"],
] as const) {
  test(`architecture permits the public boundary ${code}`, () => {
    expect(analyzeSource(filePath, code)).toEqual([]);
  });
}

for (const code of [
  "export { value } from 'node:fs';",
  "export * from 'node:fs';",
  "void import('node:fs');",
  "require('node:fs');",
  'new Date();',
]) {
  test(`architecture rejects alternate syntax: ${code}`, () => {
    expect(analyzeSource('packages/game-core/src/fixture.ts', code).length).toBeGreaterThan(0);
  });
}

test('architecture rejects malformed source rather than silently skipping analysis', () => {
  expect(analyzeSource('packages/game-core/src/fixture.ts', 'export const = ;').join()).toContain(
    'Unable to analyze source',
  );
});
