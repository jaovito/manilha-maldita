import type { SavepointSQL, SQL } from 'bun';
import { type RewardPolicy, validateRewardPolicy } from '../../domain/policy';

type PolicyRow = {
  version: string;
  solo_xp_percent: number;
  completion_xp: string;
  victory_xp: string;
  competitive_victory_points: string;
  xp_per_level: string;
};

export async function ensureRewardPolicy(client: SQL, policy: RewardPolicy): Promise<void> {
  validateRewardPolicy(policy);

  await client.begin(async (tx) => {
    await tx`SELECT set_config('statement_timeout', '5000', true), set_config('lock_timeout', '2000', true)`;
    await tx`INSERT INTO app.reward_policies (version, solo_xp_percent, completion_xp, victory_xp, competitive_victory_points, xp_per_level)
      VALUES (${policy.version}, ${policy.soloXpPercent}, ${policy.completionXp.toString()}, ${policy.victoryXp.toString()}, ${policy.competitiveVictoryPoints.toString()}, ${policy.xpPerLevel.toString()}) ON CONFLICT (version) DO NOTHING`;
    const [row] = await tx<
      PolicyRow[]
    >`SELECT version, solo_xp_percent, completion_xp, victory_xp, competitive_victory_points, xp_per_level FROM app.reward_policies WHERE version = ${policy.version}`;

    if (
      !row ||
      row.solo_xp_percent !== policy.soloXpPercent ||
      BigInt(row.completion_xp) !== policy.completionXp ||
      BigInt(row.victory_xp) !== policy.victoryXp ||
      BigInt(row.competitive_victory_points) !== policy.competitiveVictoryPoints ||
      BigInt(row.xp_per_level) !== policy.xpPerLevel
    )
      throw new Error('REWARD_POLICY_VERSION_CONFLICT');
  });
}

/** Same savepoint as the queue's completion; reward uniqueness survives manual job retries. */
export async function grantMatchRewards(tx: SavepointSQL, job: { matchId: string }): Promise<void> {
  const [result] = await tx<
    {
      preset: string;
      solo: boolean;
      reason: string;
      winner: string | null;
      reward_policy_version: string;
    }[]
  >`
    SELECT preset, solo, reason, winner, reward_policy_version FROM app.match_results WHERE id = ${job.matchId}`;

  if (!result) throw new Error('RESULT_NOT_FOUND');
  if (result.reason !== 'completed') return;

  const [policy] = await tx<
    PolicyRow[]
  >`SELECT version, solo_xp_percent, completion_xp, victory_xp, competitive_victory_points, xp_per_level FROM app.reward_policies WHERE version = ${result.reward_policy_version}`;

  if (!policy) throw new Error('REWARD_POLICY_NOT_FOUND');
  if (result.solo && policy.solo_xp_percent === 0) return;

  const participants = await tx<{ id: string; account_id: string; seat: number }[]>`
    SELECT p.id, p.account_id, p.seat FROM app.match_participants p JOIN app.accounts a ON a.id = p.account_id
    WHERE p.match_id = ${job.matchId} AND a.status = 'active' ORDER BY p.account_id FOR UPDATE OF a`;

  for (const participant of participants) {
    const won = (participant.seat % 2 === 0 ? 'A' : 'B') === result.winner;
    const baseXp = BigInt(policy.completion_xp) + (won ? BigInt(policy.victory_xp) : 0n);
    const xp = result.solo ? (baseXp * BigInt(policy.solo_xp_percent)) / 100n : baseXp;
    const points =
      !result.solo && won && result.preset === 'competitive'
        ? BigInt(policy.competitive_victory_points)
        : 0n;
    const inserted =
      await tx`INSERT INTO app.match_rewards (participant_id, preset, solo, xp, competitive_points)
      VALUES (${participant.id}, ${result.preset}, ${result.solo}, ${xp.toString()}, ${points.toString()}) ON CONFLICT (participant_id) DO NOTHING RETURNING participant_id`;

    if (!inserted.length) continue;

    const updated =
      await tx`UPDATE app.player_progress SET xp = xp + ${xp.toString()}, competitive_points = competitive_points + ${points.toString()}
      WHERE account_id = ${participant.account_id} RETURNING account_id`;

    if (!updated.length) throw new Error('PROGRESS_NOT_FOUND');
  }
}
