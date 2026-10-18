import { expect, test } from 'bun:test';
import {
  defaultRoomConfig,
  type ClientMessage,
  type RoomView,
  type ServerMessage,
} from '@truco/game-protocol';
import { createTransport, type RoomPort } from '../../src/bootstrap/transport';

const origin = 'http://truco.test';
const room: RoomView = {
  code: 'ABC123',
  sequence: 1,
  roomRevision: 0,
  status: 'lobby',
  hostSeat: 0,
  seats: [{ seat: 0, nickname: 'Ana', connected: true, ready: false }, null],
  config: defaultRoomConfig,
  matchId: null,
  decisionId: null,
  deadline: null,
  paused: false,
  match: null,
  outcome: null,
  selfSeat: 0,
};
function fixture() {
  const received: ClientMessage[] = [];
  const disconnected: string[] = [];
  let sink: { send(message: ServerMessage): void; close(): void } | undefined;
  let failure: string | undefined;
  const rooms: RoomPort = {
    async create() {
      if (failure) throw new Error(failure);
      return { code: 'ABC123' };
    },
    async join() {
      if (failure) throw new Error(failure);
    },
    async connect(_code, _session, s) {
      if (failure) throw new Error(failure);
      sink = s;
      s.send({ type: 'SNAPSHOT', room });
      return 'connection';
    },
    async disconnect(_code, _session, id) {
      disconnected.push(id);
    },
    async receive(_code, _session, _connection, message) {
      if (failure) throw new Error(failure);
      received.push(message);
      return { type: 'ACK', ok: true, commandId: message.commandId, sequence: 1 };
    },
  };
  let time = 0;
  const transport = createTransport({ rooms, allowedOrigins: [origin], now: () => time });
  const server = Bun.serve({
    hostname: '127.0.0.1',
    port: 0,
    fetch: transport.app.fetch,
    websocket: transport.websocket,
  });
  async function request(
    path: string,
    body?: unknown,
    cookie?: string,
    requestOrigin: string = origin,
  ) {
    return fetch(new URL(path, server.url), {
      method: body === undefined ? 'GET' : 'POST',
      headers: {
        Origin: requestOrigin,
        ...(cookie ? { Cookie: cookie } : {}),
        'Content-Type': 'application/json',
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  }
  async function guest() {
    const response = await request('/api/guest', { nickname: 'Ana' });
    const cookie = response.headers.get('set-cookie')?.split(';')[0];
    if (!cookie) throw new Error('No cookie');
    return cookie;
  }
  function connect(cookie: string, wsOrigin = origin) {
    const url = new URL('/api/rooms/ABC123/ws', server.url);
    url.protocol = 'ws:';
    return new WebSocket(url, { headers: { Cookie: cookie, Origin: wsOrigin } });
  }
  return {
    request,
    guest,
    connect,
    received,
    disconnected,
    getSink: () => sink,
    fail: (value: string | undefined) => {
      failure = value;
    },
    advance: (value: number) => {
      time += value;
    },
    async stop() {
      transport.close();
      await server.stop(true);
    },
  };
}
function messages(socket: WebSocket) {
  const pending: ((value: unknown) => void)[] = [];
  const buffered: unknown[] = [];
  socket.addEventListener('message', (event) => {
    const value: unknown = JSON.parse(String(event.data));
    const resolve = pending.shift();
    if (resolve) resolve(value);
    else buffered.push(value);
  });
  return {
    next: () =>
      buffered.length
        ? Promise.resolve(buffered.shift())
        : new Promise<unknown>((resolve) => pending.push(resolve)),
  };
}
const command: ClientMessage = {
  protocol: 1,
  commandId: 'first',
  matchId: null,
  decisionId: null,
  expectedRevision: null,
  action: { type: 'SYNC' },
};

test('real HTTP sessions require origin and auth, protect cookies and sanitize failures', async () => {
  const f = fixture();
  try {
    expect((await f.request('/api/rooms', { config: defaultRoomConfig })).status).toBe(401);
    expect(
      (await f.request('/api/guest', { nickname: 'Ana' }, undefined, 'http://evil.test')).status,
    ).toBe(403);
    expect((await f.request('/api/guest', { nickname: '<script>' })).status).toBe(400);
    const response = await f.request('/api/guest', { nickname: 'Ana' });
    const header = response.headers.get('set-cookie') ?? '';
    expect(header).toContain('HttpOnly');
    expect(header).toContain('SameSite=Strict');
    expect(header).not.toContain('Secure');
    expect(await response.json()).toEqual({ nickname: 'Ana' });
    const cookie = header.split(';')[0];
    if (!cookie) throw new Error('No cookie');
    expect(await (await f.request('/api/guest', undefined, cookie)).json()).toEqual({
      nickname: 'Ana',
    });
    expect((await f.request('/api/guest', { nickname: 'Beto' }, cookie)).status).toBe(200);
    expect(
      await (await f.request('/api/rooms', { config: defaultRoomConfig }, cookie)).json(),
    ).toEqual({ code: 'ABC123' });
    expect(await (await f.request('/api/rooms/ABC123/join', {}, cookie)).json()).toEqual({
      code: 'ABC123',
    });
    expect((await f.request('/api/rooms/bad/join', {}, cookie)).status).toBe(400);
    expect((await f.request('/api/rooms/ABC123/join', { unexpected: true }, cookie)).status).toBe(
      400,
    );
    expect((await f.request('/api/rooms', { config: {} }, cookie)).status).toBe(400);
    expect((await f.request('/api/rooms/ABC123/ws', undefined, cookie)).status).toBe(400);
    f.fail('SECRET_CARD_AND_TOKEN');
    expect(
      await (await f.request('/api/rooms', { config: defaultRoomConfig }, cookie)).json(),
    ).toEqual({ code: 'INTERNAL_ERROR' });
    f.fail('ROOM_FULL');
    expect(await (await f.request('/api/rooms/ABC123/join', {}, cookie)).json()).toEqual({
      code: 'ROOM_FULL',
    });
    f.advance(86400000);
    expect((await f.request('/api/guest', undefined, cookie)).status).toBe(401);
  } finally {
    await f.stop();
  }
});

test('real websocket delivers safe snapshots, validates messages and processes authenticated commands', async () => {
  const f = fixture();
  let socket: WebSocket | undefined;
  try {
    const cookie = await f.guest();
    socket = f.connect(cookie);
    const inbox = messages(socket);
    expect(await inbox.next()).toEqual({ type: 'SNAPSHOT', room });
    socket.send('not-json');
    expect(await inbox.next()).toEqual({ type: 'ERROR', commandId: null, code: 'INVALID_MESSAGE' });
    socket.send(JSON.stringify({ ...command, playerId: 'spoof' }));
    expect(await inbox.next()).toEqual({ type: 'ERROR', commandId: null, code: 'INVALID_MESSAGE' });
    socket.send(JSON.stringify(command));
    expect(await inbox.next()).toEqual({ type: 'ACK', commandId: 'first', ok: true, sequence: 1 });
    expect(f.received).toEqual([command]);
    f.fail('PRIVATE_DETAILS');
    socket.send(JSON.stringify({ ...command, commandId: 'second' }));
    expect(await inbox.next()).toEqual({
      type: 'ERROR',
      commandId: 'second',
      code: 'INTERNAL_ERROR',
    });
    f.fail(undefined);
    const closed = new Promise<number>((resolve) =>
      socket?.addEventListener('close', (event) => resolve(event.code)),
    );
    f.getSink()?.close();
    expect(await closed).toBe(1000);
  } finally {
    socket?.close();
    await f.stop();
  }
});

test('websocket rejects expired sessions and oversized messages', async () => {
  for (const expire of [false, true]) {
    const f = fixture();
    let socket: WebSocket | undefined;
    try {
      socket = f.connect(await f.guest());
      const inbox = messages(socket);
      await inbox.next();
      const closed = new Promise<number>((resolve) =>
        socket?.addEventListener('close', (event) => resolve(event.code)),
      );
      if (expire) {
        f.advance(86400000);
        socket.send(JSON.stringify(command));
      } else socket.send('x'.repeat(8193));
      expect(await closed).toBe(expire ? 1008 : 1009);
    } finally {
      socket?.close();
      await f.stop();
    }
  }
});

test('real HTTP enforces message size and IP rate limits', async () => {
  const f = fixture();
  try {
    expect((await f.request('/api/guest', { nickname: 'x'.repeat(9000) })).status).toBe(413);
    for (let index = 0; index < 120; index++) await f.request('/api/guest');
    expect((await f.request('/api/guest')).status).toBe(429);
    f.advance(60000);
    expect((await f.request('/api/guest')).status).toBe(401);
  } finally {
    await f.stop();
  }
});

test('real websocket handshake denies unknown sessions and foreign origins', async () => {
  const f = fixture();
  try {
    const cookie = await f.guest();
    for (const [credential, requestOrigin] of [
      ['truco_session=invalid', origin],
      [cookie, 'http://evil.test'],
    ] as const) {
      const socket = f.connect(credential, requestOrigin);
      const failed = await new Promise<boolean>((resolve) => {
        socket.addEventListener('open', () => {
          socket.close();
          resolve(false);
        });
        socket.addEventListener('error', () => resolve(true));
      });
      expect(failed).toBe(true);
    }
    expect(f.received).toHaveLength(0);
  } finally {
    await f.stop();
  }
});

test('late snapshots close expired sockets without exposing room state', async () => {
  const f = fixture();
  let socket: WebSocket | undefined;
  try {
    socket = f.connect(await f.guest());
    const inbox = messages(socket);
    await inbox.next();
    const closed = new Promise<number>((resolve) =>
      socket?.addEventListener('close', (event) => resolve(event.code)),
    );
    f.advance(86400000);
    f.getSink()?.send({ type: 'SNAPSHOT', room });
    expect(await closed).toBe(1008);
  } finally {
    socket?.close();
    await f.stop();
  }
});
