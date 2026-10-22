import { expect, test } from 'bun:test';
import { defaultRoomConfig, serverMessageSchema, type ServerMessage } from '@truco/game-protocol';
import { ownCard, type Player, setup } from './multiplayer-fixture';

function nextMessage(socket: WebSocket, accepts: (message: ServerMessage) => boolean) {
  return new Promise<ServerMessage>((resolve, reject) => {
    const cleanup = () => {
      socket.removeEventListener('message', onMessage);
      socket.removeEventListener('close', onClose);
      socket.removeEventListener('error', onClose);
    };
    const onClose = () => {
      cleanup();
      reject(new Error('Socket closed before the expected reply'));
    };
    const onMessage = (event: MessageEvent) => {
      try {
        const message = serverMessageSchema.parse(JSON.parse(String(event.data)));
        if (!accepts(message)) return;

        cleanup();
        resolve(message);
      } catch (error) {
        cleanup();
        reject(error);
      }
    };

    socket.addEventListener('message', onMessage);
    socket.addEventListener('close', onClose);
    socket.addEventListener('error', onClose);
  });
}

async function freshSnapshot(player: Player) {
  const snapshot = nextMessage(player.socket, (message) => message.type === 'SNAPSHOT');
  expect((await player.act({ type: 'SYNC' })).type).toBe('ACK');
  const message = await snapshot;
  if (message.type !== 'SNAPSHOT') throw new Error('Missing snapshot');

  return message.room;
}

test('backend HTTP rejects SQL payloads in profile, room configuration and path without changing the room', async () => {
  const game = await setup(2);
  const host = game.players[0];
  const cookie = game.cookies[0];
  if (!host || !cookie) throw new Error('Missing authenticated host');

  try {
    const original = await freshSnapshot(host);
    const attacks = ["' OR 1=1 --", "x'; SELECT 1; --", 'x/*query*/', { $ne: null }];
    for (const payload of attacks) {
      const response = await game.post('/api/guest', { nickname: payload }, cookie);
      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({ code: 'INVALID_MESSAGE' });
      expect(response.headers.get('set-cookie')).toBeNull();
    }

    for (const body of [
      { config: { ...defaultRoomConfig, preset: "casual' OR 1=1 --" } },
      { config: { ...defaultRoomConfig, format: '1v1; SELECT 1' } },
      { config: { ...defaultRoomConfig, cardTimeoutMs: '30000; SELECT 1' } },
      { config: defaultRoomConfig, solo: "false' OR '1'='1" },
      { config: defaultRoomConfig, sql: 'SELECT 1' },
    ]) {
      const response = await game.post('/api/rooms', body, cookie);
      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({ code: 'INVALID_MESSAGE' });
    }

    for (const code of ["' OR 1=1 --", `${game.code}'; SELECT 1; --`]) {
      const response = await game.post(`/api/rooms/${encodeURIComponent(code)}/join`, {}, cookie);
      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({ code: 'INVALID_MESSAGE' });
    }

    const profile = await fetch(new URL('/api/guest', game.runtime.server.url), {
      headers: { Cookie: cookie },
    });
    expect(profile.status).toBe(200);
    expect(await profile.json()).toEqual({ nickname: 'Jogador 0' });
    expect(await freshSnapshot(host)).toEqual(original);
    expect((await game.act(0, { type: 'READY', ready: true })).type).toBe('ACK');
    expect((await freshSnapshot(host)).seats[0]?.ready).toBe(true);
  } finally {
    await game.stop();
  }
});

test('backend HTTP treats SQL-looking cookies as unauthenticated and valid keywords as profile text', async () => {
  const game = await setup(2);
  const host = game.players[0];
  const cookie = game.cookies[0];
  if (!host || !cookie) throw new Error('Missing authenticated host');

  try {
    const original = await freshSnapshot(host);
    for (const value of ["' OR '1'='1", 'invalid; SELECT 1', 'invalid/*comment*/']) {
      const response = await game.post(
        `/api/rooms/${game.code}/join`,
        {},
        `truco_session=${value}`,
      );
      expect(response.status).toBe(401);
      expect(await response.json()).toEqual({ code: 'UNAUTHENTICATED' });
    }

    // Validation follows the nickname contract; SQL words alone are harmless text.
    for (const nickname of ['SELECT', 'DROP TABLE']) {
      const response = await game.post('/api/guest', { nickname }, cookie);
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ nickname });
      expect(response.headers.get('set-cookie')).toBeNull();
    }

    expect(await freshSnapshot(host)).toEqual(original);
    expect((await game.act(0, { type: 'READY', ready: true })).type).toBe('ACK');
  } finally {
    await game.stop();
  }
});

test('backend WebSocket rejects injection payloads before commands mutate authoritative state', async () => {
  const game = await setup(2);

  try {
    await game.begin();
    const phase = game.players[0]?.view?.match?.phase;
    if (phase?.type !== 'TURN') throw new Error('Missing active turn');
    const host = game.players[phase.seat];
    if (!host) throw new Error('Missing current player');

    const original = await freshSnapshot(host);
    const envelope = host.envelope({ type: 'SYNC' });
    const attacks: unknown[] = [
      { ...envelope, commandId: "x' OR 1=1 --" },
      { ...envelope, matchId: "x'; SELECT 1; --" },
      { ...envelope, decisionId: 'x/*comment*/' },
      { ...envelope, expectedRevision: '0 OR 1=1' },
      { ...envelope, action: { type: 'READY', ready: "true' OR '1'='1" } },
      { ...envelope, action: { type: 'SET_SEAT', seat: '0; SELECT 1' } },
      { ...envelope, action: { type: "START_MATCH'; SELECT 1; --" } },
      {
        ...envelope,
        action: {
          type: 'PLAY_CARD',
          card: { rank: "A' OR 1=1 --", suit: 'spades' },
          covered: false,
        },
      },
      {
        ...envelope,
        action: {
          type: 'CONFIGURE',
          config: { ...defaultRoomConfig, preset: "competitive' OR 1=1 --" },
        },
      },
      { ...envelope, sql: 'SELECT 1' },
      { ...envelope, action: { type: 'SYNC', xp: '999999; SELECT 1' } },
    ];
    for (const attack of attacks) {
      const response = nextMessage(host.socket, (message) => message.type !== 'SNAPSHOT');
      host.socket.send(JSON.stringify(attack));
      expect(await response).toEqual({ type: 'ERROR', commandId: null, code: 'INVALID_MESSAGE' });
    }

    // A fresh SYNC is a protocol barrier, not a sleep or a check of cached UI state.
    expect(await freshSnapshot(host)).toEqual(original);
    expect(
      await host.send({ ...host.envelope({ type: 'SYNC' }), commandId: 'SELECT' }),
    ).toMatchObject({ type: 'ACK', commandId: 'SELECT', ok: true });
    expect(
      (await game.act(phase.seat, { type: 'PLAY_CARD', card: ownCard(host), covered: false })).type,
    ).toBe('ACK');
    const resumed = await freshSnapshot(host);
    const hand = resumed.match?.hand.hands[resumed.selfSeat];
    expect(hand?.count).toBe(2);
  } finally {
    await game.stop();
  }
});
