import { expect, test } from 'bun:test';
import { SQL } from 'bun';
import { localDatabaseUrl } from '../../database/target';

import {
  ensurePersistentCatalogs,
  persistentEnvironment as environment,
} from './persistent-fixture';

test('authenticated profile routes validate ownership, strict bodies, page bounds and origin', async () => {
  await ensurePersistentCatalogs();
  const { main } = await import('../../src/bootstrap/main');
  const runtime = await main({
    ...environment(),
    PORT: '0',
    ALLOWED_ORIGINS: 'http://multiplayer.test',
  });
  const client = new SQL(localDatabaseUrl('test'));
  const login = `r_${crypto.randomUUID().replaceAll('-', '').slice(0, 24)}`;
  const post = (path: string, body: unknown, cookie?: string) =>
    fetch(new URL(path, runtime.server.url), {
      method: 'POST',
      headers: {
        Origin: 'http://multiplayer.test',
        'Content-Type': 'application/json',
        ...(cookie ? { Cookie: cookie } : {}),
      },
      body: JSON.stringify(body),
    });
  const get = (path: string, cookie?: string) =>
    fetch(new URL(path, runtime.server.url), { headers: cookie ? { Cookie: cookie } : {} });

  try {
    const registration = await post('/api/accounts/register', {
      login,
      password: 'profile integration password fixture',
      nickname: 'Player',
    });
    const cookie = registration.headers.get('set-cookie')?.split(';')[0];
    expect(registration.status).toBe(201);
    expect((await get('/api/accounts/progression', cookie)).status).toBe(200);
    expect((await get('/api/accounts/progression')).status).toBe(401);
    const rewards = '/api/accounts/matches/unknown-match/rewards';
    expect((await get(rewards)).status).toBe(401);
    expect(await (await get(rewards, cookie)).json()).toEqual({ status: 'pending' });
    expect((await get(`${rewards}?accountId=forged`, cookie)).status).toBe(400);
    expect((await get('/api/accounts/matches/bad%27id/rewards', cookie)).status).toBe(400);
    expect((await get('/api/accounts/progression?accountId=forged', cookie)).status).toBe(400);
    expect((await get('/api/catalog?sql=SELECT')).status).toBe(400);
    expect((await get('/api/ranking?accountId=forged')).status).toBe(400);
    expect((await get('/api/ranking')).status).toBe(200);
    expect(
      (await post('/api/accounts/profile', { nickname: 'Updated Player' }, cookie)).status,
    ).toBe(200);
    expect(await (await get('/api/guest', cookie)).json()).toEqual({ nickname: 'Updated Player' });
    expect(await (await post('/api/guest', { nickname: 'Fake Name' }, cookie)).json()).toEqual({
      nickname: 'Updated Player',
    });
    for (const body of [
      { nickname: "x'; DROP TABLE app.accounts; --" },
      { nickname: 'New', accountId: 'forged' },
      [],
      null,
    ])
      expect((await post('/api/accounts/profile', body, cookie)).status).toBe(400);
    expect(
      (
        await post('/api/accounts/cosmetics', {
          avatarId: null,
          deckThemeId: null,
          tableThemeId: null,
        })
      ).status,
    ).toBe(401);
    for (const path of [
      '/api/accounts/profile',
      '/api/accounts/cosmetics',
      '/api/accounts/recover',
    ]) {
      const response = await fetch(new URL(path, runtime.server.url), {
        method: 'POST',
        headers: {
          Origin: 'http://multiplayer.test',
          'Content-Type': 'application/json',
          Cookie: cookie ?? '',
        },
        body: '{',
      });
      expect(response.status).toBe(400);
      expect(
        (
          await fetch(new URL(path, runtime.server.url), {
            method: 'POST',
            headers: { Origin: 'http://multiplayer.test' },
            body: '{}',
          })
        ).status,
      ).toBe(400);
    }
    expect(
      (
        await post('/api/accounts/recover', {
          login,
          recoveryCode: 'bad',
          newPassword: 'valid password fixture',
        })
      ).status,
    ).toBe(400);
    expect(
      (await post('/api/accounts/recovery-code', { password: 'valid password fixture' })).status,
    ).toBe(401);
    expect((await post('/api/guest', { nickname: 'Guest' }, 'truco_account=bad')).status).toBe(401);
    expect(
      (
        await fetch(new URL('/api/accounts/profile', runtime.server.url), {
          method: 'POST',
          headers: { Origin: 'https://evil.test', Cookie: cookie ?? '' },
          body: '{}',
        })
      ).status,
    ).toBe(403);
  } finally {
    await runtime.stop();
    await client`DELETE FROM app.accounts WHERE login_name = ${login}`;
    await client.close();
  }
});
