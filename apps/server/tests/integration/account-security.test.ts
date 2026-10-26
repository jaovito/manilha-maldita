import { expect, test } from 'bun:test';
import { defaultRoomConfig } from '@truco/game-protocol';
import { SQL } from 'bun';
import { localDatabaseUrl } from '../../database/target';
import { createPersistentBackend } from '../../src/bootstrap/persistent-backend';
import { ensureDatabaseSchema } from '../database/database-fixtures';
import { withProgressionFixture } from '../database/progression-fixture';

import { setup } from './multiplayer-fixture';
import { persistentEnvironment as environment } from './persistent-fixture';

test('full account maintenance rotates recovery credentials, revokes sessions and deletes personal rows', async () => {
  await ensureDatabaseSchema();
  await withProgressionFixture(async () => {});
  const backend = await createPersistentBackend(environment());
  if (!backend) throw new Error('Missing backend');
  const game = await setup(2, defaultRoomConfig, { backend, environment: 'test' });
  const client = new SQL(localDatabaseUrl('test'));
  const ids: string[] = [];
  const password = 'integration account password fixture';

  try {
    for (const cookie of game.cookies) {
      const profile = await backend.accounts.session(cookie.split('=')[1]);
      if (profile) ids.push(profile.accountId);
    }
    const id = ids[0];
    const [record] = await client<
      { login_name: string }[]
    >`SELECT login_name FROM app.accounts WHERE id = ${id}`;
    if (!record) throw new Error('Missing account');
    const cookie = game.cookies[0];
    expect(
      (
        await game.post(
          '/api/accounts/recovery-code',
          { password: 'wrong password fixture' },
          cookie,
        )
      ).status,
    ).toBe(401);
    const issued = await game.post('/api/accounts/recovery-code', { password }, cookie);
    const issuedBody = (await issued.json()) as { recoveryCode: string };
    expect(issued.status).toBe(200);
    expect(issuedBody.recoveryCode).toMatch(/^[a-f0-9]{64}$/);
    const [security] = await client<
      { recovery_hash: string }[]
    >`SELECT recovery_hash FROM app.account_security WHERE account_id = ${id}`;
    expect(security?.recovery_hash).not.toBe(issuedBody.recoveryCode);
    const newPassword = 'N3w!7x';
    const revoked = new Promise<CloseEvent>((resolve) =>
      game.players[0]?.socket.addEventListener('close', resolve, { once: true }),
    );
    const resetOnce = () =>
      game.post('/api/accounts/recover', {
        login: record.login_name,
        recoveryCode: issuedBody.recoveryCode,
        newPassword,
      });
    const resets = await Promise.all([resetOnce(), resetOnce()]);
    expect(resets.map((response) => response.status).sort()).toEqual([200, 401]);
    const reset = resets.find((response) => response.status === 200);
    if (!reset) throw new Error('Missing successful recovery');
    expect(reset.status).toBe(200);
    expect((await revoked).code).toBe(1008);
    expect(((await reset.json()) as { recoveryCode: string }).recoveryCode).not.toBe(
      issuedBody.recoveryCode,
    );
    expect(await backend.accounts.session(cookie?.split('=')[1])).toBeNull();
    expect(
      (
        await game.post('/api/accounts/recover', {
          login: record.login_name,
          recoveryCode: issuedBody.recoveryCode,
          newPassword,
        })
      ).status,
    ).toBe(401);
    const login = await game.post('/api/accounts/login', {
      login: record.login_name,
      password: newPassword,
    });
    const newCookie = login.headers.get('set-cookie')?.split(';')[0];
    expect(login.status).toBe(200);
    expect(
      (
        await game.post(
          '/api/accounts/password',
          { currentPassword: newPassword, newPassword: password },
          newCookie,
        )
      ).status,
    ).toBe(200);
    expect(await backend.accounts.session(newCookie?.split('=')[1])).toBeNull();
    const relogin = await game.post('/api/accounts/login', { login: record.login_name, password });
    const deleteCookie = relogin.headers.get('set-cookie')?.split(';')[0];
    expect(
      (await game.post('/api/accounts/delete', { password, accountId: ids[1] }, deleteCookie))
        .status,
    ).toBe(400);
    expect((await game.post('/api/accounts/delete', { password }, deleteCookie)).status).toBe(200);
    expect(await client`SELECT id FROM app.accounts WHERE id = ${id}`).toHaveLength(0);
    expect(
      await client`SELECT account_id FROM app.account_security WHERE account_id = ${id}`,
    ).toHaveLength(0);
    expect(await backend.players.current(ids[1] ?? '')).not.toBeNull();
    expect((await fetch(new URL('/api/catalog', game.runtime.server.url))).status).toBe(200);
    expect(
      (await fetch(new URL('/api/ranking?page=1%20OR%201=1', game.runtime.server.url))).status,
    ).toBe(400);
  } finally {
    await game.stop();
    for (const id of ids) await client`DELETE FROM app.accounts WHERE id = ${id}`;
    await client.close();
  }
}, 15_000);
