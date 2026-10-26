export type MatchRecord = Readonly<{
  id: string;
  preset: 'casual' | 'competitive';
  format: '1v1' | '2v2';
  solo: boolean;
  reason: 'completed' | 'surrender' | 'abandonment' | 'expired' | 'technical';
  winner: 'A' | 'B' | null;
  scoreA: number;
  scoreB: number;
  handsPlayed: number;
  powersUsed: number;
  rewardPolicyVersion: string;
  startedAt: number;
  finishedAt: number;
  participants: readonly Readonly<{ seat: number; accountId: string | null }>[];
}>;

export function validateMatchRecord(record: MatchRecord): void {
  const count = record.format === '1v1' ? 2 : 4;
  const accounts = record.participants.flatMap((entry) =>
    entry.accountId ? [entry.accountId] : [],
  );

  if (
    !record.id ||
    record.id.length > 80 ||
    /[^A-Za-z0-9_-]/.test(record.id) ||
    !['casual', 'competitive'].includes(record.preset) ||
    !['1v1', '2v2'].includes(record.format) ||
    typeof record.solo !== 'boolean' ||
    (record.solo && count !== 2) ||
    !['completed', 'surrender', 'abandonment', 'expired', 'technical'].includes(record.reason) ||
    [record.scoreA, record.scoreB].some(
      (value) => !Number.isInteger(value) || value < 0 || value > 12,
    ) ||
    [record.handsPlayed, record.powersUsed].some(
      (value) => !Number.isSafeInteger(value) || value < 0 || value > 1_000_000,
    ) ||
    [record.startedAt, record.finishedAt].some(
      (value) => !Number.isSafeInteger(value) || value < 0 || value > 8_640_000_000_000_000,
    ) ||
    record.finishedAt < record.startedAt ||
    !record.rewardPolicyVersion ||
    record.rewardPolicyVersion.length > 64 ||
    /[^A-Za-z0-9._-]/.test(record.rewardPolicyVersion) ||
    record.participants.length !== count ||
    new Set(record.participants.map((entry) => entry.seat)).size !== count ||
    record.participants.some(
      (entry) =>
        !Number.isInteger(entry.seat) ||
        entry.seat < 0 ||
        entry.seat >= count ||
        (entry.accountId !== null &&
          !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(entry.accountId)),
    ) ||
    new Set(accounts).size !== accounts.length ||
    (['expired', 'technical'].includes(record.reason)
      ? record.winner !== null
      : !['A', 'B'].includes(record.winner ?? '')) ||
    (record.reason === 'completed' &&
      (record.winner === 'A'
        ? record.scoreA !== 12 || record.scoreB >= 12
        : record.scoreB !== 12 || record.scoreA >= 12))
  )
    throw new Error('INVALID_MATCH_RECORD');
}
