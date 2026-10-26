import type { SQL } from 'bun';
import { type MatchRecord, validateMatchRecord } from '../../domain/match-record';

export function createPostgresResultWriter(client: SQL) {
  return async (record: MatchRecord): Promise<void> => {
    validateMatchRecord(record);

    await client.begin(async (tx) => {
      await tx`SELECT set_config('statement_timeout', '5000', true), set_config('lock_timeout', '2000', true)`;
      const receipts =
        await tx`INSERT INTO app.match_receipts (id) VALUES (${record.id}) ON CONFLICT (id) DO NOTHING RETURNING id`;

      if (!receipts.length) return;

      await tx`INSERT INTO app.match_results (id, preset, format, solo, reason, winner, score_a, score_b,
        hands_played, powers_used, reward_policy_version, started_at, finished_at)
        VALUES (${record.id}, ${record.preset}, ${record.format}, ${record.solo}, ${record.reason}, ${record.winner},
          ${record.scoreA}, ${record.scoreB}, ${record.handsPlayed}, ${record.powersUsed}, ${record.rewardPolicyVersion},
          ${new Date(record.startedAt)}, ${new Date(record.finishedAt)})`;

      for (const participant of record.participants) {
        // Account deletion between start and finish anonymizes the participant instead of losing the result.
        await tx`INSERT INTO app.match_participants (match_id, account_id, seat, preset, format, solo)
          VALUES (${record.id}, (SELECT id FROM app.accounts WHERE id = ${participant.accountId}), ${participant.seat}, ${record.preset}, ${record.format}, ${record.solo})`;
      }

      await tx`INSERT INTO app.jobs (kind, match_id) VALUES ('match_rewards', ${record.id}) ON CONFLICT (match_id, kind) DO NOTHING`;
    });
  };
}
