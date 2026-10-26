import { sql } from 'drizzle-orm';
import { check, index, integer, text, timestamp, unique, uuid } from 'drizzle-orm/pg-core';
import { app } from './namespace';
import { matchResults } from './results';

export const jobStatus = app.enum('job_status', ['pending', 'running', 'completed', 'failed']);
export const jobKind = app.enum('job_kind', ['match_rewards']);

// Typed reference only: never queue credentials, private cards or arbitrary JSON snapshots.
export const jobs = app.table(
  'jobs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    kind: jobKind('kind').notNull(),
    matchId: text('match_id')
      .notNull()
      .references(() => matchResults.id, { onDelete: 'cascade' }),
    status: jobStatus('status').notNull().default('pending'),
    attempts: integer('attempts').notNull().default(0),
    maxAttempts: integer('max_attempts').notNull().default(5),
    runAt: timestamp('run_at', { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    leaseExpiresAt: timestamp('lease_expires_at', { withTimezone: true }),
    lockToken: uuid('lock_token'),
    finishedAt: timestamp('finished_at', { withTimezone: true }),
    lastErrorCode: text('last_error_code'),
  },
  (table) => [
    unique('jobs_match_kind_unique').on(table.matchId, table.kind),
    check(
      'jobs_attempts',
      sql`${table.attempts} >= 0 AND ${table.maxAttempts} BETWEEN 1 AND 100 AND ${table.attempts} <= ${table.maxAttempts}`,
    ),
    check(
      'jobs_pending_attempts',
      sql`${table.status} <> 'pending' OR ${table.attempts} < ${table.maxAttempts}`,
    ),
    check(
      'jobs_lease',
      sql`(${table.status} = 'running' AND ${table.lockToken} IS NOT NULL AND ${table.leaseExpiresAt} IS NOT NULL AND ${table.leaseExpiresAt} > ${table.createdAt} AND ${table.attempts} > 0) OR (${table.status} <> 'running' AND ${table.lockToken} IS NULL AND ${table.leaseExpiresAt} IS NULL)`,
    ),
    check(
      'jobs_finished',
      sql`(${table.status} IN ('completed', 'failed') AND ${table.finishedAt} IS NOT NULL AND ${table.finishedAt} >= ${table.createdAt}) OR (${table.status} IN ('pending', 'running') AND ${table.finishedAt} IS NULL)`,
    ),
    check(
      'jobs_error_code',
      sql`${table.lastErrorCode} IS NULL OR ${table.lastErrorCode} ~ '^[A-Z][A-Z0-9_]{0,63}$'`,
    ),
    index('jobs_pending_idx').on(table.runAt, table.id).where(sql`${table.status} = 'pending'`),
    index('jobs_running_lease_idx')
      .on(table.leaseExpiresAt)
      .where(sql`${table.status} = 'running'`),
    index('jobs_terminal_idx')
      .on(table.finishedAt)
      .where(sql`${table.status} IN ('completed', 'failed')`),
  ],
);
