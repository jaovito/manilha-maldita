import { expect, test } from 'bun:test';
import { fixture } from '../room-application.test';

test('joining an existing membership stays idempotent before validating a replacement nickname', async () => {
  const f = fixture();
  const room = await f.room();
  const before = room.host.view;

  await expect(f.service.join(room.code, room.host.session, '<invalid>')).resolves.toBeUndefined();
  expect(room.host.view).toEqual(before);
  await expect(f.service.join('ABSENT', room.host.session, '<invalid>')).rejects.toThrow(
    'ROOM_NOT_FOUND',
  );
  f.service.close();
});

test('retired connections are rejected before decoding malformed commands, without mutating the room', async () => {
  const f = fixture();
  const room = await f.room();
  const oldConnection = room.host.connection;
  const replacement = f.peer(room.host.session);
  await replacement.connect(room.code);
  const before = replacement.view;
  const invalid = { ...replacement.message({ type: 'READY', ready: true }), commandId: '' };

  await expect(
    f.service.receive(room.code, room.host.session, oldConnection, invalid),
  ).rejects.toThrow('CONNECTION_REPLACED');
  expect(await replacement.raw(invalid)).toEqual({
    type: 'ERROR',
    commandId: null,
    code: 'INVALID_MESSAGE',
  });
  expect(replacement.view).toEqual(before);
  f.service.close();
});

test('application accepts an alternate decoder without importing or requiring the websocket protocol', async () => {
  const { defaultRoomConfig } = await import('@truco/game-protocol');
  const { RoomApplication } = await import('../room-application');
  const { InMemoryRoomRepository } = await import('../../adapters/outbound/memory/room-repository');
  const { ports } = fixture();
  let decoded = 0;
  const application = new RoomApplication(ports, {}, new InMemoryRoomRepository(), {
    nickname() {},
    configuration: (value) => value,
    command(value) {
      decoded++;
      if (value !== 'ready') return null;
      return {
        commandId: 'alternate-command',
        matchId: null,
        decisionId: null,
        expectedRevision: 0,
        action: { type: 'READY', ready: true },
      };
    },
  });
  const { code } = await application.create('member', 'Jogador', defaultRoomConfig);
  const connection = await application.connect(code, 'member', { send() {}, close() {} });

  await expect(application.receive(code, 'member', 'retired', 'ready')).rejects.toThrow(
    'CONNECTION_REPLACED',
  );
  expect(decoded).toBe(0);
  expect(await application.receive(code, 'member', connection, 'ready')).toMatchObject({
    type: 'ACK',
    commandId: 'alternate-command',
  });
  expect(decoded).toBe(1);
  application.close();
});

test('a delayed disconnect from a departed membership cannot detach the same session after rejoining', async () => {
  const f = fixture();
  const room = await f.room();
  const oldConnection = room.host.connection;
  expect(await room.host.send({ type: 'LEAVE' })).toMatchObject({ type: 'ACK' });

  await f.service.join(room.code, room.host.session, 'Retornou');
  const replacement = f.peer(room.host.session);
  await replacement.connect(room.code);
  await f.service.disconnect(room.code, room.host.session, oldConnection);

  expect(await replacement.send({ type: 'READY', ready: true })).toMatchObject({ type: 'ACK' });
  expect(replacement.view.seats.find((member) => member?.nickname === 'Retornou')).toMatchObject({
    connected: true,
    ready: true,
  });
  f.service.close();
});

test('queued commands recheck authorization before any room mutation or command caching', async () => {
  const f = fixture();
  try {
    const room = await f.room();
    const before = room.host.view;
    const message = room.host.message({ type: 'READY', ready: true });
    let authorized = true;
    const pending = f.service.receive(
      room.code,
      room.host.session,
      room.host.connection,
      message,
      () => authorized,
    );
    authorized = false;
    await expect(pending).rejects.toThrow('UNAUTHENTICATED');
    expect(room.host.view).toEqual(before);
    authorized = true;
    expect(
      await f.service.receive(
        room.code,
        room.host.session,
        room.host.connection,
        message,
        () => authorized,
      ),
    ).toMatchObject({ type: 'ACK' });
    expect(room.host.view.seats[0]?.ready).toBe(true);
  } finally {
    f.service.close();
  }
});
