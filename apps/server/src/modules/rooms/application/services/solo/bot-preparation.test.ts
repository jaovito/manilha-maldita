import { expect, test } from 'bun:test';
import { defaultRoomConfig } from '@truco/game-protocol';
import { fixture } from '../../room-application.test';

for (const solo of [true, false]) {
  for (const preparationTimeoutMs of [1000, 2000]) {
    test(`${solo ? 'solo' : 'mixed'} 2v2 prepares every bot within ${preparationTimeoutMs} ms`, async () => {
      const f = fixture({ soloEnabled: true });
      const host = f.peer('host');
      const config = { ...defaultRoomConfig, format: '2v2' as const, preparationTimeoutMs };

      try {
        const { code } = await f.service.create(host.session, 'Host', config, solo);
        await host.connect(code);
        const friend = solo ? null : f.peer('friend');
        if (friend) {
          await f.service.join(code, friend.session, 'Friend');
          await friend.connect(code);
          expect((await host.send({ type: 'FILL_BOTS' })).type).toBe('ACK');
          expect((await host.send({ type: 'READY', ready: true })).type).toBe('ACK');
          expect((await friend.send({ type: 'READY', ready: true })).type).toBe('ACK');
          expect((await host.send({ type: 'START_MATCH' })).type).toBe('ACK');
        }

        const dealUntil = host.view.transition?.until;
        if (dealUntil === undefined) throw new Error('MISSING_DEAL_TRANSITION');
        await f.advance(dealUntil);
        const wake = dealUntil + preparationTimeoutMs / 2;
        const deadline = dealUntil + preparationTimeoutMs;

        await f.advance(wake - 1);
        if (friend)
          expect((await friend.send({ type: 'PREPARE', intent: { type: 'pass' } })).type).toBe(
            'ACK',
          );
        expect(host.view.match?.powers?.players.map(({ ready }) => ready)).toEqual([
          false,
          !solo,
          false,
          false,
        ]);

        await f.advance(wake);
        expect(host.view.match?.phase.type).toBe('PREPARATION');
        expect(host.view.deadline).toBe(deadline);
        expect(host.view.match?.powers?.players.map(({ ready }) => ready)).toEqual([
          false,
          true,
          true,
          true,
        ]);
        expect(host.view.match?.powers?.activations).toEqual([]);
        expect((await host.send({ type: 'PREPARE', intent: { type: 'pass' } })).type).toBe('ACK');
        expect(host.view.match?.phase.type).toBe('TURN');
      } finally {
        f.service.close();
      }
    });
  }
}
