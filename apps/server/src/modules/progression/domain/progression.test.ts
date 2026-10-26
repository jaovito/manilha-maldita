import { expect, test } from 'bun:test';
import { appearanceFor } from './appearance';
import { validateMatchRecord } from './match-record';
import { levelForXp, validateRewardPolicy } from './policy';

import { matchRecord, policy } from './tests/match-fixture';

test('levels use exact integer XP and bounded policy configuration', () => {
  validateRewardPolicy(policy);
  expect([0n, 499n, 500n, 1000n].map((xp) => levelForXp(xp, 500n))).toEqual([1n, 1n, 2n, 3n]);
  expect(levelForXp(9_223_372_036_854_775_807n, 500n)).toBe(18_446_744_073_709_552n);
  for (const xp of [-1n, 9_223_372_036_854_775_808n])
    expect(() => levelForXp(xp, 500n)).toThrow('INVALID_PROGRESS');
  expect(() => levelForXp(0n, 0n)).toThrow();
  for (const patch of [
    { version: 'bad\n' },
    { completionXp: -1n },
    { soloXpPercent: -1 },
    { soloXpPercent: 100 },
    { soloXpPercent: 1.5 },
    { victoryXp: 1_000_001n },
    { competitiveVictoryPoints: -1n },
    { xpPerLevel: 0n },
  ])
    expect(() => validateRewardPolicy({ ...policy, ...patch })).toThrow('INVALID_REWARD_POLICY');
});

test('appearance is a fixed asset manifest with safe defaults', () => {
  expect(appearanceFor(null, null, null).avatar.spriteIndex).toBe(0);
  expect(appearanceFor('avatar-4', 'arcane', 'midnight')).toMatchObject({
    avatar: { spriteIndex: 3 },
    deck: { assetKey: 'arcane' },
    table: { assetKey: 'midnight' },
  });
  expect(appearanceFor('https://evil.test/x', 'javascript:x', '../x')).toEqual(
    appearanceFor(null, null, null),
  );
});

test('result summaries reject unsafe references, impossible outcomes and duplicate account identities', () => {
  const result = matchRecord();
  validateMatchRecord(result);
  for (const patch of [
    { id: "x'; DROP TABLE app.accounts; --" },
    { id: 'x'.repeat(81) },
    { rewardPolicyVersion: 'bad\n' },
    { scoreA: 11 },
    { scoreB: 12 },
    { winner: null },
    { powersUsed: -1 },
    { handsPlayed: NaN },
    { finishedAt: result.startedAt - 1 },
    { startedAt: -1 },
    { participants: [] },
    {
      participants: [
        { seat: 0, accountId: 'bad' },
        { seat: 1, accountId: null },
      ],
    },
    {
      participants: [
        { seat: 0, accountId: null },
        { seat: 0, accountId: null },
      ],
    },
  ])
    expect(() => validateMatchRecord({ ...result, ...patch })).toThrow('INVALID_MATCH_RECORD');
  const accountId = crypto.randomUUID();
  expect(() =>
    validateMatchRecord({
      ...result,
      participants: [
        { seat: 0, accountId },
        { seat: 1, accountId },
      ],
    }),
  ).toThrow();
  validateMatchRecord({ ...result, reason: 'technical', winner: null });
  validateMatchRecord({ ...result, winner: 'B', scoreB: 12, scoreA: 9 });
});
