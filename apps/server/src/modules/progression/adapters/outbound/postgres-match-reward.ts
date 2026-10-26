import type { SQL } from 'bun';
import type { MatchReward } from '../../application/ports/players';

/** A single read sees only this account's committed grant, never another participant's rewards. */
export async function readMatchReward(
  client: SQL,
  accountId: string,
  matchId: string,
): Promise<MatchReward> {
  return client.begin(async (tx) => {
    await tx`SELECT set_config('statement_timeout', '5000', true)`;
    const [row] = await tx<
      { reason: string; status: string; xp: string | null; competitive_points: string | null }[]
    >`
      SELECT r.reason, j.status, g.xp, g.competitive_points FROM app.match_participants p
      JOIN app.match_results r ON r.id = p.match_id
      LEFT JOIN app.jobs j ON j.match_id = r.id AND j.kind = 'match_rewards'
      LEFT JOIN app.match_rewards g ON g.participant_id = p.id
      WHERE p.match_id = ${matchId} AND p.account_id = ${accountId}`;

    // Unknown and non-owned matches are indistinguishable while the outbox may still be persisting.
    if (!row) return { status: 'pending' };
    if (row.xp !== null && row.competitive_points !== null)
      return {
        status: 'granted',
        xp: String(row.xp),
        competitivePoints: String(row.competitive_points),
      };
    if (row.reason !== 'completed' || row.status === 'completed') return { status: 'none' };

    return { status: 'pending' };
  });
}
