import { expect, mock, spyOn, test } from 'bun:test';
import { defaultRoomConfig } from '@truco/game-protocol';
import { fixture } from '../../room-application.test';

test('one human cannot fill or start a competitive lobby with only bots', async () => {
  const reserve = mock(() => {});
  const f = fixture(
    { soloEnabled: true },
    { policyVersion: 'fixture-v1', reserve, release() {}, write() {} },
  );

  try {
    const config = { ...defaultRoomConfig, preset: 'competitive' as const };
    const { host, peers } = await f.room({ ...config, format: '2v2' });
    const [, second, friend, fourth] = peers;
    if (!second || !friend || !fourth) throw new Error('MISSING_PLAYERS');

    expect((await second.send({ type: 'LEAVE' })).type).toBe('ACK');
    expect((await fourth.send({ type: 'LEAVE' })).type).toBe('ACK');
    expect((await host.send({ type: 'FILL_BOTS' })).type).toBe('ACK');
    expect((await friend.send({ type: 'LEAVE' })).type).toBe('ACK');

    const ids = spyOn(f.ports, 'id');
    const entropy = spyOn(f.ports, 'randomInt');
    const partial = host.view;
    expect(await host.send({ type: 'FILL_BOTS' })).toMatchObject({
      code: 'BOT_FILL_NEEDS_PLAYERS',
    });
    expect(host.view).toEqual(partial);

    // Shrinking can retain a bot in seat 1 after the second human leaves seat 2.
    expect((await host.send({ type: 'CONFIGURE', config })).type).toBe('ACK');
    expect(host.view.seats[1]?.bot).toBe(true);
    expect((await host.send({ type: 'READY', ready: true })).type).toBe('ACK');
    const full = host.view;
    expect(await host.send({ type: 'START_MATCH' })).toMatchObject({
      code: 'BOT_FILL_NEEDS_PLAYERS',
    });
    expect(host.view).toEqual(full);
    expect(ids).not.toHaveBeenCalled();
    expect(entropy).not.toHaveBeenCalled();
    expect(reserve).not.toHaveBeenCalled();
  } finally {
    f.service.close();
  }
});

for (const fillFirst of [true, false]) {
  test(`concurrent join and fill preserve all four humans when fill is ${fillFirst ? 'first' : 'last'}`, async () => {
    const f = fixture({ soloEnabled: true });
    try {
      const room = await f.room({ ...defaultRoomConfig, format: '2v2' });
      const departing = room.peers[3];
      if (!departing) throw new Error('NO_DEPARTING_PLAYER');
      await departing.send({ type: 'LEAVE' });
      const message = room.host.message({ type: 'FILL_BOTS' });
      const ids = spyOn(f.ports, 'id');
      const entropy = spyOn(f.ports, 'randomInt');
      const newcomer = f.peer('newcomer');
      const fill = () => room.host.raw(message);
      const join = () => f.service.join(room.code, newcomer.session, 'Newcomer');
      const replies = fillFirst
        ? await Promise.all([fill(), join()])
        : await Promise.all([join(), fill()]);
      expect(replies[fillFirst ? 0 : 1]).toMatchObject(
        fillFirst ? { type: 'ACK' } : { code: 'STALE_REVISION' },
      );
      expect(ids).toHaveBeenCalledTimes(fillFirst ? 1 : 0);
      expect(entropy).not.toHaveBeenCalled();
      expect(room.host.view.seats.every((member) => member !== null && !member.bot)).toBe(true);
      expect(room.host.view.seats[3]?.nickname).toBe('Newcomer');
      const before = room.host.view;
      expect(await room.host.send({ type: 'FILL_BOTS' })).toMatchObject({ code: 'ROOM_FULL' });
      expect(room.host.view).toEqual(before);
      await newcomer.connect(room.code);
      expect(newcomer.view.selfSeat).toBe(3);
    } finally {
      f.service.close();
    }
  });
}
