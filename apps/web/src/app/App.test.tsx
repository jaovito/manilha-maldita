import { afterEach, expect, mock, test } from 'bun:test';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { defaultRoomConfig, type RoomView } from '@truco/game-protocol';
import { App } from './App';
import { connectRoom, envelope, request } from '../shared/transport/client';

const originalFetch = globalThis.fetch;
const originalWebSocket = globalThis.WebSocket;
class Socket {
  static OPEN = 1;
  static instances: Socket[] = [];
  readyState = 1;
  onopen: (() => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: (() => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  sent: string[] = [];
  constructor(readonly url: string | URL) {
    Socket.instances.push(this);
  }
  send(data: string) {
    this.sent.push(data);
  }
  close() {
    this.readyState = 3;
    this.onclose?.();
  }
  snapshot(room: RoomView) {
    this.onmessage?.({ data: JSON.stringify({ type: 'SNAPSHOT', room }) });
  }
}
function socket(): Socket {
  const value = Socket.instances.at(-1);
  if (!value) throw new Error('MISSING_SOCKET');
  return value;
}
function installSocket() {
  Object.defineProperty(globalThis, 'WebSocket', {
    configurable: true,
    writable: true,
    value: Socket,
  });
}
function room(): RoomView {
  return {
    code: 'ABC123',
    sequence: 1,
    roomRevision: 0,
    status: 'lobby',
    hostSeat: 0,
    selfSeat: 0,
    seats: [{ seat: 0, nickname: 'Ana', connected: true, ready: false }, null],
    config: { ...defaultRoomConfig },
    matchId: null,
    decisionId: null,
    deadline: null,
    paused: false,
    match: null,
    outcome: null,
  };
}
function playing(): RoomView {
  return {
    ...room(),
    status: 'playing',
    matchId: 'match_one',
    decisionId: 'decision_one',
    deadline: Date.now() + 10000,
    match: {
      seat: 0,
      playerCount: 2,
      revision: 5,
      score: { A: 3, B: 6 },
      phase: { type: 'TURN', seat: 0 },
      hand: {
        number: 2,
        kind: 'normal',
        leader: 0,
        elevenTeam: null,
        trickLeader: 0,
        vira: { rank: 'Q', suit: 'clubs' },
        hands: [
          { seat: 0, count: 1, visibility: 'visible', cards: [{ rank: '3', suit: 'hearts' }] },
          { seat: 1, count: 3, visibility: 'hidden' },
        ],
        plays: [{ seat: 1, covered: true }],
        completedTricks: [],
        betting: {
          acceptedStake: 1,
          pendingStake: null,
          lastRaisingTeam: null,
          resumeTurnSeat: null,
        },
      },
    },
  };
}
afterEach(() => {
  globalThis.fetch = originalFetch;
  Object.defineProperty(globalThis, 'WebSocket', {
    configurable: true,
    writable: true,
    value: originalWebSocket,
  });
  Socket.instances = [];
  location.href = 'http://localhost/';
});

test('HTTP uses same-origin cookies and rejects unsuccessful requests', async () => {
  const fetcher = mock(async () => new Response(JSON.stringify({ nickname: 'Ana' })));
  Object.defineProperty(globalThis, 'fetch', {
    configurable: true,
    writable: true,
    value: fetcher,
  });
  expect(await request('/guest')).toEqual({ nickname: 'Ana' });
  await request('/guest', { nickname: 'Ana' });
  expect(fetcher.mock.calls.length).toBe(2);
  Object.defineProperty(globalThis, 'fetch', {
    configurable: true,
    writable: true,
    value: mock(async () => new Response('{}', { status: 400 })),
  });
  await expect(request('/guest')).rejects.toThrow('Não foi possível');
});

test('envelopes preserve server context and sockets validate, order snapshots and close cleanly', () => {
  installSocket();
  const receive = mock(() => {});
  const status = mock(() => {});
  const error = mock(() => {});
  const connection = connectRoom('ABC123', receive, status, error);
  const ws = socket();
  ws.onopen?.();
  ws.snapshot(room());
  ws.snapshot(room());
  ws.snapshot({ ...room(), sequence: 0 });
  expect(receive).toHaveBeenCalledTimes(1);
  const game = envelope(playing(), { type: 'REQUEST_RAISE' });
  expect(game.expectedRevision).toBe(5);
  expect(game.decisionId).toBe('decision_one');
  const lobby = envelope(room(), { type: 'READY', ready: true });
  expect(lobby.expectedRevision).toBe(0);
  expect(lobby.decisionId).toBeNull();
  connection.send(lobby);
  expect(JSON.parse(ws.sent[0] ?? '{}')).toEqual(lobby);
  ws.onmessage?.({ data: 'invalid' });
  ws.onmessage?.({
    data: JSON.stringify({ type: 'ERROR', commandId: null, code: 'STALE_REVISION' }),
  });
  ws.onerror?.();
  ws.readyState = 3;
  connection.send(lobby);
  expect(error).toHaveBeenCalledTimes(3);
  expect(status).toHaveBeenLastCalledWith(false);
  connection.close();
  expect(ws.onclose).toBeNull();
});

test('guest creates a room, receives lobby, sends ready and leaves without storing tokens', async () => {
  installSocket();
  const calls: string[] = [];
  Object.defineProperty(globalThis, 'fetch', {
    configurable: true,
    writable: true,
    value: mock(async (input: string | URL | Request, init?: RequestInit) => {
      calls.push(String(input));
      if (String(input).endsWith('/guest') && init?.method === 'GET')
        return new Response('{}', { status: 401 });
      return new Response(
        JSON.stringify(String(input).endsWith('/rooms') ? { code: 'ABC123' } : { nickname: 'Ana' }),
      );
    }),
  });
  render(<App />);
  fireEvent.change(screen.getByLabelText('Apelido'), { target: { value: 'Ana' } });
  fireEvent.click(screen.getByRole('button', { name: 'Criar sala' }));
  await waitFor(() => expect(Socket.instances).toHaveLength(1));
  act(() => {
    socket().onopen?.();
    socket().snapshot(room());
  });
  await screen.findByRole('heading', { name: 'Sala ABC123' });
  fireEvent.click(screen.getByRole('button', { name: 'Estou pronto' }));
  expect(JSON.parse(socket().sent[0] ?? '{}').action).toEqual({ type: 'READY', ready: true });
  expect(calls).toContain('/api/rooms/ABC123/join');
  fireEvent.click(screen.getByRole('button', { name: 'Sair da sala' }));
  expect(screen.queryByLabelText('Apelido')).toBeNull();
  const rejected = JSON.parse(socket().sent.at(-1) ?? '{}');
  act(() =>
    socket().onmessage?.({
      data: JSON.stringify({
        type: 'ERROR',
        commandId: rejected.commandId,
        code: 'STALE_REVISION',
      }),
    }),
  );
  expect(screen.getByRole('heading', { name: 'Sala ABC123' })).toBeDefined();
  fireEvent.click(screen.getByRole('button', { name: 'Sair da sala' }));
  const accepted = JSON.parse(socket().sent.at(-1) ?? '{}');
  act(() =>
    socket().onmessage?.({
      data: JSON.stringify({ type: 'ACK', commandId: accepted.commandId, ok: true, sequence: 2 }),
    }),
  );
  expect(screen.getByLabelText('Apelido')).toBeDefined();
});

test('invitation resumes a cookie session and HTTP failures are visible', async () => {
  installSocket();
  location.href = 'http://localhost/?room=ABC123';
  Object.defineProperty(globalThis, 'fetch', {
    configurable: true,
    writable: true,
    value: mock(async () => new Response(JSON.stringify({ nickname: 'Ana' }))),
  });
  render(<App />);
  await waitFor(() => expect(Socket.instances).toHaveLength(1));
  act(() => socket().snapshot(playing()));
  await screen.findByRole('region', { name: 'Mesa da partida' });
  act(() =>
    socket().onmessage?.({
      data: JSON.stringify({ type: 'ERROR', commandId: null, code: 'NOT_YOUR_TURN' }),
    }),
  );
  await screen.findByRole('alert');
});

test('join by code handles network failure and allows editing form', async () => {
  Object.defineProperty(globalThis, 'fetch', {
    configurable: true,
    writable: true,
    value: mock(async () => new Response('{}', { status: 400 })),
  });
  render(<App />);
  fireEvent.change(screen.getByLabelText('Apelido'), { target: { value: 'Beto' } });
  fireEvent.click(screen.getByRole('button', { name: 'Entrar em sala' }));
  fireEvent.change(screen.getByLabelText('Código da sala'), { target: { value: 'abc123' } });
  fireEvent.click(screen.getByRole('button', { name: 'Entrar na sala' }));
  await screen.findByRole('alert');
  expect(screen.getByRole('button', { name: 'Entrar na sala' }).hasAttribute('disabled')).toBe(
    false,
  );
});

test('reconnection retries with backoff without repeating earlier commands', () => {
  installSocket();
  const timers: (() => void)[] = [];
  const originalTimeout = globalThis.setTimeout;
  Object.defineProperty(globalThis, 'setTimeout', {
    configurable: true,
    writable: true,
    value: (callback: () => void) => {
      timers.push(callback);
      return 1;
    },
  });
  const receive = mock(() => {});
  const status = mock(() => {});
  const error = mock(() => {});
  try {
    const connection = connectRoom('ABC123', receive, status, error);
    connection.send(envelope(room(), { type: 'READY', ready: true }));
    socket().close();
    expect(timers).toHaveLength(1);
    timers.shift()?.();
    expect(Socket.instances).toHaveLength(2);
    expect(socket().sent).toHaveLength(0);
    socket().onopen?.();
    socket().snapshot({ ...room(), sequence: 2 });
    expect(receive).toHaveBeenCalledTimes(1);
    socket().onmessage?.({
      data: JSON.stringify({ type: 'ERROR', commandId: null, code: 'CONNECTION_REPLACED' }),
    });
    socket().close();
    expect(timers).toHaveLength(0);
    expect(error).toHaveBeenLastCalledWith(
      'Esta mesa foi aberta em outra aba. Recarregue para retomar aqui.',
    );
    connection.close();
  } finally {
    globalThis.setTimeout = originalTimeout;
  }
});

test('returning to a tab resynchronizes a missed lobby update without replaying readiness', () => {
  installSocket();
  const receive = mock(() => {});
  const connection = connectRoom(
    'ABC123',
    receive,
    () => {},
    () => {},
  );
  const ws = socket();
  const visibility = Object.getOwnPropertyDescriptor(document, 'visibilityState');

  try {
    // Focus before the initial snapshot cannot build an authenticated room context.
    window.dispatchEvent(new Event('focus'));
    expect(ws.sent).toHaveLength(0);
    ws.snapshot(room());
    connection.send(envelope(room(), { type: 'READY', ready: true }));

    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' });
    document.dispatchEvent(new Event('visibilitychange'));
    expect(ws.sent).toHaveLength(1);

    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
    document.dispatchEvent(new Event('visibilitychange'));

    expect(JSON.parse(ws.sent.at(-1) ?? '{}').action).toEqual({ type: 'SYNC' });
    const updated: RoomView = {
      ...room(),
      sequence: 3,
      roomRevision: 1,
      seats: [
        room().seats[0] ?? null,
        { seat: 1, nickname: 'Beto', connected: true, ready: false },
      ],
    };
    ws.snapshot(updated);
    expect(receive).toHaveBeenLastCalledWith(updated);

    window.dispatchEvent(new Event('focus'));
    expect(JSON.parse(ws.sent.at(-1) ?? '{}').expectedRevision).toBe(1);
    expect(ws.sent.map((raw) => JSON.parse(raw).action.type)).toEqual(['READY', 'SYNC', 'SYNC']);

    ws.readyState = 3;
    window.dispatchEvent(new Event('focus'));
    expect(ws.sent).toHaveLength(3);

    connection.close();
    window.dispatchEvent(new Event('focus'));
    document.dispatchEvent(new Event('visibilitychange'));
    expect(ws.sent).toHaveLength(3);
  } finally {
    connection.close();
    if (visibility) Object.defineProperty(document, 'visibilityState', visibility);
    else Reflect.deleteProperty(document, 'visibilityState');
  }
});
