import { expect, test } from 'bun:test';
import { defaultRoomConfig } from '@truco/game-protocol';
import { startServer } from '../../src/bootstrap/runtime';
import { Player } from './multiplayer-fixture';

for (const environment of ['production', 'development', 'test']) {
  test(`real transport gates dev mutations in ${environment} while solo remains available`, async () => {
    const runtime = startServer({
      port: 0,
      allowedOrigins: ['http://multiplayer.test'],
      environment,
      soloEnabled: true,
      devTools: true,
    });
    let player: Player | undefined;
    try {
      const post = (path: string, body: unknown, cookie = '') =>
        fetch(new URL(path, runtime.server.url), {
          method: 'POST',
          headers: {
            Origin: 'http://multiplayer.test',
            'Content-Type': 'application/json',
            Cookie: cookie,
          },
          body: JSON.stringify(body),
        });
      expect(await (await fetch(new URL('/api/features', runtime.server.url))).json()).toEqual({
        solo: true,
      });
      const guest = await post('/api/guest', { nickname: 'Dev' });
      const cookie = guest.headers.get('set-cookie')?.split(';')[0];
      if (!cookie) throw new Error('Missing cookie');
      const created = await post('/api/rooms', { config: defaultRoomConfig, solo: true }, cookie);
      expect(created.status).toBe(201);
      const body = (await created.json()) as { code: string };
      player = new Player(cookie, body.code, runtime.server.url);
      const view = await player.wait();
      expect(view.devTools).toBe(environment === 'development');
      const command = player.envelope({ type: 'DEV_RESET_HAND', power: 'mask', energy: 3 });
      const reply = await player.send(command);
      if (environment === 'development') {
        expect(reply.type).toBe('ACK');
        expect(player.view?.match?.powers?.players[0]).toMatchObject({ power: 'mask', energy: 3 });
      } else {
        expect(reply).toMatchObject({ type: 'ERROR', code: 'DEV_TOOLS_DISABLED' });
        expect(player.view?.match).toEqual(view.match);
      }
      expect(await player.send(command)).toEqual(reply);
    } finally {
      player?.socket.close();
      await runtime.stop();
    }
  });
}
