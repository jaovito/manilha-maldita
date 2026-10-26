import type { MatchRecord } from '../match-record';

export const policy = {
  version: 'test-v1',
  completionXp: 100n,
  soloXpPercent: 50,
  victoryXp: 50n,
  competitiveVictoryPoints: 10n,
  xpPerLevel: 500n,
};
export function matchRecord(): MatchRecord {
  return {
    id: 'match-fixture',
    preset: 'competitive',
    format: '1v1',
    solo: false,
    reason: 'completed',
    winner: 'A',
    scoreA: 12,
    scoreB: 8,
    handsPlayed: 3,
    powersUsed: 2,
    rewardPolicyVersion: policy.version,
    startedAt: 1000,
    finishedAt: 2000,
    participants: [
      { seat: 0, accountId: null },
      { seat: 1, accountId: null },
    ],
  };
}
