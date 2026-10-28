import { sql } from 'drizzle-orm';
import { bigint, check, index, inet, jsonb, text, timestamp, uuid } from 'drizzle-orm/pg-core';
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
    clientIp: inet('client_ip'),
    clientContext: jsonb('client_context'),
    occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check(
      'auth_audit_event',
      sql`${table.event} IN ('register_success', 'register_failure', 'login_success', 'login_failure', 'logout', 'recovery_code_issued', 'password_recovered', 'password_changed', 'account_deleted')`,
    ),
    index('auth_audit_account_idx').on(table.accountId),
    check(
      'auth_audit_context_shape',
      sql`${table.clientContext} IS NULL OR (jsonb_typeof(${table.clientContext}) = 'object' AND pg_column_size(${table.clientContext}) <= 2048 AND (${table.clientContext} - ARRAY['userAgent', 'clientVersion']::text[]) = '{}'::jsonb AND (NOT (${table.clientContext} ? 'userAgent') OR (jsonb_typeof(${table.clientContext}->'userAgent') = 'string' AND octet_length(${table.clientContext}->>'userAgent') BETWEEN 1 AND 512 AND (${table.clientContext}->>'userAgent') !~ '[[:cntrl:]]')) AND (NOT (${table.clientContext} ? 'clientVersion') OR (jsonb_typeof(${table.clientContext}->'clientVersion') = 'string' AND (${table.clientContext}->>'clientVersion') ~ '^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$')))`,
    ),
    index('auth_audit_time_idx').on(table.occurredAt),
  ],
);
