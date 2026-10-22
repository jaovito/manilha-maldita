import { sql } from 'drizzle-orm';
import { check, index, integer, text, timestamp } from 'drizzle-orm/pg-core';
import { app } from './namespace';

export const authRateLimits = app.table(
  'auth_rate_limits',
  {
    keyHash: text('key_hash').primaryKey(),
    attempts: integer('attempts').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  },
  (table) => [
    check('auth_rate_limits_key', sql`${table.keyHash} ~ '^[a-f0-9]{64}$'`),
    check('auth_rate_limits_attempts', sql`${table.attempts} BETWEEN 1 AND 1000`),
    index('auth_rate_limits_expiry_idx').on(table.expiresAt),
  ],
);
