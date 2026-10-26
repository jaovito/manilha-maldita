import { sql } from 'drizzle-orm';
import { bigint, check, integer, text, timestamp } from 'drizzle-orm/pg-core';
import { app } from './namespace';

export const rewardPolicies = app.table(
  'reward_policies',
  {
    version: text('version').primaryKey(),
    soloXpPercent: integer('solo_xp_percent').notNull().default(0),
    completionXp: bigint('completion_xp', { mode: 'bigint' }).notNull(),
    victoryXp: bigint('victory_xp', { mode: 'bigint' }).notNull(),
    competitiveVictoryPoints: bigint('competitive_victory_points', { mode: 'bigint' }).notNull(),
    xpPerLevel: bigint('xp_per_level', { mode: 'bigint' }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check('reward_policies_solo_xp', sql`${table.soloXpPercent} BETWEEN 0 AND 99`),
    check('reward_policies_version', sql`${table.version} ~ '^[A-Za-z0-9._-]{1,64}$'`),
    check(
      'reward_policies_values',
      sql`${table.completionXp} BETWEEN 0 AND 1000000 AND ${table.victoryXp} BETWEEN 0 AND 1000000 AND ${table.competitiveVictoryPoints} BETWEEN 0 AND 1000000 AND ${table.xpPerLevel} BETWEEN 1 AND 1000000`,
    ),
  ],
);

// Permanent opaque tombstones contain no player identifier and prevent result replay after retention.
export const matchReceipts = app.table(
  'match_receipts',
  {
    id: text('id').primaryKey(),
  },
  (table) => [check('match_receipts_id', sql`char_length(${table.id}) BETWEEN 1 AND 80`)],
);
