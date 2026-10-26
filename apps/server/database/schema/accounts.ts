import { sql } from 'drizzle-orm';
import { bigint, check, index, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { avatars, deckThemes, tableThemes } from './catalogs';
import { app } from './namespace';

export const accountStatus = app.enum('account_status', ['active', 'disabled']);

export const accounts = app.table(
  'accounts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    loginName: text('login_name').notNull().unique(),
    passwordHash: text('password_hash').notNull(),
    status: accountStatus('status').notNull().default('active'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check('accounts_login_name', sql`${table.loginName} ~ '^[a-z0-9_]{3,32}$'`),
    // Format guard only: verification, cost policy and rehashing belong to authentication.
    check(
      'accounts_password_hash',
      sql`${table.passwordHash} ~ '^[$]argon2id[$]v=19[$]m=[0-9]+,t=[0-9]+,p=[0-9]+[$][A-Za-z0-9+/]+[$][A-Za-z0-9+/]+$' AND octet_length(${table.passwordHash}) <= 512`,
    ),
  ],
);

export const profiles = app.table(
  'profiles',
  {
    accountId: uuid('account_id')
      .primaryKey()
      .references(() => accounts.id, { onDelete: 'cascade' }),
    nickname: text('nickname').notNull(),
    avatarId: text('avatar_id').references(() => avatars.id),
    deckThemeId: text('deck_theme_id').references(() => deckThemes.id),
    tableThemeId: text('table_theme_id').references(() => tableThemes.id),
  },
  (table) => [
    check(
      'profiles_nickname',
      sql`char_length(${table.nickname}) BETWEEN 1 AND 24 AND ${table.nickname} = btrim(${table.nickname}) AND ${table.nickname} !~ '[[:cntrl:]]'`,
    ),
  ],
);

export const sessions = app.table(
  'sessions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    accountId: uuid('account_id')
      .notNull()
      .references(() => accounts.id, { onDelete: 'cascade' }),
    tokenHash: text('token_hash').notNull().unique(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
  },
  (table) => [
    check('sessions_token_hash', sql`${table.tokenHash} ~ '^[0-9a-f]{64}$'`),
    check('sessions_expiration', sql`${table.expiresAt} > ${table.createdAt}`),
    check(
      'sessions_revocation',
      sql`${table.revokedAt} IS NULL OR ${table.revokedAt} >= ${table.createdAt}`,
    ),
    index('sessions_account_idx').on(table.accountId),
    index('sessions_expiration_idx').on(table.expiresAt),
  ],
);

export const playerProgress = app.table(
  'player_progress',
  {
    accountId: uuid('account_id')
      .primaryKey()
      .references(() => accounts.id, { onDelete: 'cascade' }),
    xp: bigint('xp', { mode: 'bigint' }).notNull().default(sql`0`),
    competitivePoints: bigint('competitive_points', { mode: 'bigint' }).notNull().default(sql`0`),
  },
  (table) => [
    check('player_progress_xp', sql`${table.xp} >= 0`),
    check('player_progress_points', sql`${table.competitivePoints} >= 0`),
    index('player_progress_ranking_idx').on(table.competitivePoints.desc(), table.accountId),
  ],
);
