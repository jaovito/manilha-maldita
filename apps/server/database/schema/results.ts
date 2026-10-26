import { sql } from 'drizzle-orm';
import {
  bigint,
  boolean,
  check,
  foreignKey,
  index,
  integer,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core';
import { accounts } from './accounts';
import { app } from './namespace';

export const matchPreset = app.enum('match_preset', ['casual', 'competitive']);
export const matchFormat = app.enum('match_format', ['1v1', '2v2']);
export const matchEndReason = app.enum('match_end_reason', [
  'completed',
  'surrender',
  'abandonment',
  'expired',
  'technical',
]);
export const matchWinner = app.enum('match_winner', ['A', 'B']);

export const matchResults = app.table(
  'match_results',
  {
    id: text('id').primaryKey(),
    preset: matchPreset('preset').notNull(),
    format: matchFormat('format').notNull(),
    solo: boolean('solo').notNull().default(false),
    reason: matchEndReason('reason').notNull(),
    winner: matchWinner('winner'),
    scoreA: integer('score_a').notNull(),
    scoreB: integer('score_b').notNull(),
    handsPlayed: integer('hands_played').notNull(),
    powersUsed: integer('powers_used').notNull(),
    rewardPolicyVersion: text('reward_policy_version').notNull(),
    startedAt: timestamp('started_at', { withTimezone: true }).notNull(),
    finishedAt: timestamp('finished_at', { withTimezone: true }).notNull(),
  },
  (table) => [
    check('match_results_id', sql`char_length(${table.id}) BETWEEN 1 AND 128`),
    check(
      'match_results_scores',
      sql`${table.scoreA} BETWEEN 0 AND 12 AND ${table.scoreB} BETWEEN 0 AND 12`,
    ),
    check('match_results_counts', sql`${table.handsPlayed} >= 0 AND ${table.powersUsed} >= 0`),
    check('match_results_time', sql`${table.finishedAt} >= ${table.startedAt}`),
    check('match_results_policy', sql`${table.rewardPolicyVersion} ~ '^[a-zA-Z0-9._-]{1,64}$'`),
    check('match_results_solo', sql`NOT ${table.solo} OR ${table.format} = '1v1'`),
    check(
      'match_results_winner',
      sql`(${table.reason} IN ('expired', 'technical') AND ${table.winner} IS NULL) OR (${table.reason} IN ('completed', 'surrender', 'abandonment') AND ${table.winner} IS NOT NULL)`,
    ),
    check(
      'match_results_completed',
      sql`${table.reason} <> 'completed' OR (${table.winner} = 'A' AND ${table.scoreA} = 12 AND ${table.scoreB} < 12) OR (${table.winner} = 'B' AND ${table.scoreB} = 12 AND ${table.scoreA} < 12)`,
    ),
    unique('match_results_context_unique').on(table.id, table.preset, table.format, table.solo),
    index('match_results_finished_idx').on(table.finishedAt),
  ],
);

export const matchParticipants = app.table(
  'match_participants',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    matchId: text('match_id').notNull(),
    accountId: uuid('account_id').references(() => accounts.id, { onDelete: 'set null' }),
    seat: integer('seat').notNull(),
    preset: matchPreset('preset').notNull(),
    format: matchFormat('format').notNull(),
    solo: boolean('solo').notNull(),
  },
  (table) => [
    foreignKey({
      name: 'match_participants_context_fk',
      columns: [table.matchId, table.preset, table.format, table.solo],
      foreignColumns: [
        matchResults.id,
        matchResults.preset,
        matchResults.format,
        matchResults.solo,
      ],
    }).onDelete('cascade'),
    unique('match_participants_seat_unique').on(table.matchId, table.seat),
    unique('match_participants_account_unique').on(table.matchId, table.accountId),
    unique('match_participants_reward_context_unique').on(table.id, table.preset, table.solo),
    check(
      'match_participants_seat',
      sql`${table.seat} >= 0 AND ${table.seat} < CASE WHEN ${table.format} = '1v1' THEN 2 ELSE 4 END`,
    ),
    index('match_participants_account_idx').on(table.accountId),
  ],
);

export const matchRewards = app.table(
  'match_rewards',
  {
    participantId: uuid('participant_id').primaryKey(),
    preset: matchPreset('preset').notNull(),
    solo: boolean('solo').notNull(),
    xp: bigint('xp', { mode: 'bigint' }).notNull(),
    competitivePoints: bigint('competitive_points', { mode: 'bigint' }).notNull(),
    grantedAt: timestamp('granted_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    foreignKey({
      name: 'match_rewards_context_fk',
      columns: [table.participantId, table.preset, table.solo],
      foreignColumns: [matchParticipants.id, matchParticipants.preset, matchParticipants.solo],
    }).onDelete('cascade'),
    check('match_rewards_xp', sql`${table.xp} >= 0`),
    check(
      'match_rewards_points',
      sql`${table.competitivePoints} >= 0 AND (${table.competitivePoints} = 0 OR (${table.preset} = 'competitive' AND NOT ${table.solo}))`,
    ),
  ],
);
