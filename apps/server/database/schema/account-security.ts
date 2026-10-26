import { sql } from 'drizzle-orm';
import { bigint, check, index, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { accounts } from './accounts';
import { app } from './namespace';

export const accountSecurity = app.table(
  'account_security',
  {
    accountId: uuid('account_id')
      .primaryKey()
      .references(() => accounts.id, { onDelete: 'cascade' }),
    recoveryHash: text('recovery_hash'),
    passwordChangedAt: timestamp('password_changed_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    check(
      'account_security_recovery_hash',
      sql`${table.recoveryHash} IS NULL OR ${table.recoveryHash} ~ '^[a-f0-9]{64}$'`,
    ),
  ],
);

export const authAudit = app.table(
  'auth_audit',
  {
    id: bigint('id', { mode: 'bigint' }).primaryKey().generatedAlwaysAsIdentity(),
    accountId: uuid('account_id').references(() => accounts.id, { onDelete: 'set null' }),
    event: text('event').notNull(),
    occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check(
      'auth_audit_event',
      sql`${table.event} IN ('register_success', 'register_failure', 'login_success', 'login_failure', 'logout', 'recovery_code_issued', 'password_recovered', 'password_changed', 'account_deleted')`,
    ),
    index('auth_audit_time_idx').on(table.occurredAt),
  ],
);
