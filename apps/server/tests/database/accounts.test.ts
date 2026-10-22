import { expect, test } from 'bun:test';
import { eq } from 'drizzle-orm';
import { getTableConfig } from 'drizzle-orm/pg-core';
import {
  accounts,
  avatars,
  deckThemes,
  playerProgress,
  profiles,
  sessions,
  tableThemes,
} from '../../database/schema';
import { fixturePasswordHash, insertAccount } from './account-fixtures';
import { rejectsConstraint, withDatabaseFixture } from './database-fixtures';

test('account schema separates credentials, public profile and derived progress', () => {
  expect(getTableConfig(accounts).columns.map((column) => column.name)).toEqual([
    'id',
    'login_name',
    'password_hash',
    'status',
    'created_at',
  ]);
  expect(getTableConfig(playerProgress).columns.map((column) => column.name)).toEqual([
    'account_id',
    'xp',
    'competitive_points',
  ]);
  expect(getTableConfig(sessions).indexes).toHaveLength(2);
  expect(getTableConfig(profiles).foreignKeys).toHaveLength(4);
});

test('accounts reject plaintext passwords and duplicate or noncanonical login names', () =>
  withDatabaseFixture(async (tx) => {
    const accountId = await insertAccount(tx);
    const [account] = await tx.select().from(accounts).where(eq(accounts.id, accountId));
    expect(account?.status).toBe('active');

    await rejectsConstraint(tx, 'accounts_password_hash', (sp) =>
      sp.insert(accounts).values({ loginName: 'plaintext', passwordHash: 'not-hashed' }),
    );
    await rejectsConstraint(tx, 'accounts_login_name', (sp) =>
      sp.insert(accounts).values({ loginName: 'MixedCase', passwordHash: fixturePasswordHash }),
    );
    await rejectsConstraint(tx, 'accounts_login_name_unique', (sp) =>
      sp
        .insert(accounts)
        .values({ loginName: account?.loginName ?? '', passwordHash: fixturePasswordHash }),
    );
  }));

test('session verifiers are unique hashes with expiration and cascade on account deletion', () =>
  withDatabaseFixture(async (tx) => {
    const accountId = await insertAccount(tx);
    const tokenHash = 'a'.repeat(64);
    const createdAt = new Date('2026-01-01T00:00:00Z');
    const expiresAt = new Date('2026-01-02T00:00:00Z');
    const value = { accountId, tokenHash, createdAt, expiresAt };
    await tx.insert(sessions).values(value);

    await rejectsConstraint(tx, 'sessions_token_hash', (sp) =>
      sp.insert(sessions).values({ ...value, tokenHash: 'usable-secret-token' }),
    );
    await rejectsConstraint(tx, 'sessions_token_hash_unique', (sp) =>
      sp.insert(sessions).values(value),
    );
    await rejectsConstraint(tx, 'sessions_expiration', (sp) =>
      sp.insert(sessions).values({ ...value, tokenHash: 'b'.repeat(64), expiresAt: createdAt }),
    );
    await rejectsConstraint(tx, 'sessions_revocation', (sp) =>
      sp
        .insert(sessions)
        .values({ ...value, tokenHash: 'c'.repeat(64), revokedAt: new Date('2025-01-01') }),
    );

    await tx.insert(playerProgress).values({ accountId });
    await tx.insert(profiles).values({ accountId, nickname: 'Jogador' });
    await tx.delete(accounts).where(eq(accounts.id, accountId));
    expect(await tx.select().from(sessions).where(eq(sessions.accountId, accountId))).toEqual([]);
    expect(await tx.select().from(profiles).where(eq(profiles.accountId, accountId))).toEqual([]);
    expect(
      await tx.select().from(playerProgress).where(eq(playerProgress.accountId, accountId)),
    ).toEqual([]);
  }));

test('progress uses nonnegative bigint totals without writable level and profiles reference curated catalogs', () =>
  withDatabaseFixture(async (tx) => {
    const accountId = await insertAccount(tx);
    const avatarId = `avatar-${accountId}`;
    const deckId = `deck-${accountId}`;
    const tableId = `table-${accountId}`;
    await tx
      .insert(avatars)
      .values({ id: avatarId, name: 'Trapaceiro', avatarUrl: '/art/avatars-pixel.png' });
    await tx.insert(deckThemes).values({ id: deckId, name: 'Clássico', assetKey: 'classic' });
    await tx.insert(tableThemes).values({ id: tableId, name: 'Taverna', assetKey: 'tavern' });
    await tx.insert(profiles).values({
      accountId,
      nickname: 'João',
      avatarId,
      deckThemeId: deckId,
      tableThemeId: tableId,
    });
    await tx.insert(playerProgress).values({ accountId });
    const [progress] = await tx
      .select()
      .from(playerProgress)
      .where(eq(playerProgress.accountId, accountId));
    expect(progress?.xp).toBe(0n);
    expect(progress?.competitivePoints).toBe(0n);
    const largeXp = 9007199254740993n;
    await tx
      .update(playerProgress)
      .set({ xp: largeXp })
      .where(eq(playerProgress.accountId, accountId));
    expect(
      (await tx.select().from(playerProgress).where(eq(playerProgress.accountId, accountId)))[0]
        ?.xp,
    ).toBe(largeXp);

    await rejectsConstraint(tx, 'player_progress_xp', (sp) =>
      sp.update(playerProgress).set({ xp: -1n }).where(eq(playerProgress.accountId, accountId)),
    );
    await rejectsConstraint(tx, 'player_progress_points', (sp) =>
      sp
        .update(playerProgress)
        .set({ competitivePoints: -1n })
        .where(eq(playerProgress.accountId, accountId)),
    );
    await rejectsConstraint(tx, 'profiles_nickname', (sp) =>
      sp.update(profiles).set({ nickname: ' ' }).where(eq(profiles.accountId, accountId)),
    );
    await rejectsConstraint(tx, 'profiles_avatar_id_avatars_id_fk', (sp) =>
      sp.update(profiles).set({ avatarId: 'missing' }).where(eq(profiles.accountId, accountId)),
    );
  }));
