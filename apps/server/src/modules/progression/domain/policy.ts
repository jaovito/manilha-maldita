export type RewardPolicy = Readonly<{
  version: string;
  completionXp: bigint;
  soloXpPercent: number;
  victoryXp: bigint;
  competitiveVictoryPoints: bigint;
  xpPerLevel: bigint;
}>;

export function validateRewardPolicy(policy: RewardPolicy): void {
  if (
    !/^[A-Za-z0-9._-]{1,64}$/.test(policy.version) ||
    /[^A-Za-z0-9._-]/.test(policy.version) ||
    [policy.completionXp, policy.victoryXp, policy.competitiveVictoryPoints].some(
      (value) => typeof value !== 'bigint' || value < 0n || value > 1_000_000n,
    ) ||
    !Number.isInteger(policy.soloXpPercent) ||
    policy.soloXpPercent < 0 ||
    policy.soloXpPercent > 99 ||
    typeof policy.xpPerLevel !== 'bigint' ||
    policy.xpPerLevel < 1n ||
    policy.xpPerLevel > 1_000_000n
  )
    throw new Error('INVALID_REWARD_POLICY');
}

export function levelForXp(xp: bigint, xpPerLevel: bigint): bigint {
  if (typeof xp !== 'bigint' || xp < 0n || xp > 9_223_372_036_854_775_807n || xpPerLevel < 1n)
    throw new Error('INVALID_PROGRESS');

  return 1n + xp / xpPerLevel;
}
