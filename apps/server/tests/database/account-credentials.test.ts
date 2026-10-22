import { expect, test } from 'bun:test';
import { eq } from 'drizzle-orm';
import { accounts, sessions } from '../../database/schema';
import { passwordHasherFixture } from '../../src/modules/accounts/adapters/outbound/tests/password-hasher-fixture';
import {
  createAccountSessionToken,
  hashAccountSessionToken,
} from '../../src/modules/accounts/adapters/outbound/crypto-session-token';
import { isLoginName, PasswordService } from '../../src/modules/accounts';
import { fixturePasswordHash } from './account-fixtures';
import { rejectsConstraint, withDatabaseFixture } from './database-fixtures';

test('real account credentials round-trip as Argon2id and session verifiers in PostgreSQL', async () => {
  const service = new PasswordService(passwordHasherFixture(), 2);
  const password = "  literal password ' OR 1=1; --  ";
  const passwordHash = await service.hash(password);
  const credentials = await createAccountSessionToken();
  const accountId = crypto.randomUUID();
  const verifier = await hashAccountSessionToken(credentials.token);

  if (verifier === null) throw new Error('Fixture token must have a valid verifier');

  await withDatabaseFixture(async (tx) => {
    await tx.insert(accounts).values({
      id: accountId,
      loginName: `u_${accountId.replaceAll('-', '').slice(0, 24)}`,
      passwordHash,
    });
    await tx.insert(sessions).values({
      accountId,
      tokenHash: credentials.tokenHash,
      createdAt: new Date('2026-01-01T00:00:00Z'),
      expiresAt: new Date('2026-01-02T00:00:00Z'),
    });

    const [storedAccount] = await tx
      .select({ passwordHash: accounts.passwordHash })
      .from(accounts)
      .where(eq(accounts.id, accountId));
    expect(storedAccount).toBeDefined();
    expect(await service.verify(password, storedAccount?.passwordHash)).toBe(true);
    expect(await service.verify(password.trim(), storedAccount?.passwordHash)).toBe(false);

    const storedSessions = await tx
      .select({ accountId: sessions.accountId, tokenHash: sessions.tokenHash })
      .from(sessions)
      .where(eq(sessions.tokenHash, verifier));
    expect(storedSessions).toEqual([{ accountId, tokenHash: credentials.tokenHash }]);
    expect(JSON.stringify({ storedAccount, storedSessions })).not.toContain(password);
    expect(JSON.stringify({ storedAccount, storedSessions })).not.toContain(credentials.token);
    expect(
      await tx.select().from(sessions).where(eq(sessions.tokenHash, credentials.token)),
    ).toEqual([]);
  });
});

test('application canonical login validation agrees with the real database constraints', async () => {
  const suffix = crypto.randomUUID().replaceAll('-', '');
  const accepted = [suffix.slice(0, 3), `u_${suffix.slice(0, 30)}`];
  const rejected = [
    'ab',
    'x'.repeat(33),
    'Player',
    ' jogador',
    'jogador ',
    'jogadór',
    'jogador\n',
    'jogador\r',
    'jogador\u2028',
    "a' OR 1=1--",
  ];

  await withDatabaseFixture(async (tx) => {
    for (const loginName of accepted) {
      expect(isLoginName(loginName)).toBe(true);

      const id = crypto.randomUUID();
      await tx.insert(accounts).values({ id, loginName, passwordHash: fixturePasswordHash });
      const [stored] = await tx
        .select({ loginName: accounts.loginName })
        .from(accounts)
        .where(eq(accounts.id, id));
      expect(stored?.loginName).toBe(loginName);
    }

    for (const loginName of rejected) {
      expect(isLoginName(loginName)).toBe(false);

      await rejectsConstraint(tx, 'accounts_login_name', (savepoint) =>
        savepoint.insert(accounts).values({ loginName, passwordHash: fixturePasswordHash }),
      );
    }
  });
});
