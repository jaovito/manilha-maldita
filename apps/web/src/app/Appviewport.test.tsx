import { afterEach, expect, mock, test } from 'bun:test';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import {
  clientMessageSchema,
  defaultRoomConfig,
  type ClientMessage,
  type RoomView,
} from '@truco/game-protocol';
import { App } from './App';

const originalFetch = globalThis.fetch;
const originalWebSocket = globalThis.WebSocket;

class ViewportSocket {
  static OPEN = 1;
  static latest: ViewportSocket | undefined;
  readyState = 1;
  onopen: (() => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: (() => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  sent: ClientMessage[] = [];

  constructor() {
    ViewportSocket.latest = this;
  }

  send(raw: string) {
    this.sent.push(clientMessageSchema.parse(JSON.parse(raw)));
  }

  close() {
    this.readyState = 3;
    this.onclose?.();
  }

  snapshot(room: RoomView) {
    this.onmessage?.({ data: JSON.stringify({ type: 'SNAPSHOT', room }) });
  }
}

function playing(): RoomView {
  return {
    code: 'ABC123',
    sequence: 1,
    roomRevision: 2,
    status: 'playing',
    hostSeat: 0,
    selfSeat: 0,
    seats: [
      { seat: 0, nickname: 'Ana', connected: true, ready: true },
      { seat: 1, nickname: 'Beto', connected: true, ready: true },
    ],
    config: defaultRoomConfig,
    matchId: 'match_one',
    decisionId: 'decision_one',
    deadline: null,
    paused: false,
    outcome: null,
    match: {
      playerCount: 2,
      revision: 0,
      seat: 0,
      score: { A: 0, B: 0 },
      phase: { type: 'TURN', seat: 0 },
      hand: {
        number: 1,
        kind: 'normal',
        leader: 0,
        elevenTeam: null,
        trickLeader: 0,
        vira: { rank: 'Q', suit: 'clubs' },
        hands: [
          { seat: 0, count: 1, visibility: 'visible', cards: [{ rank: '3', suit: 'hearts' }] },
          { seat: 1, count: 3, visibility: 'hidden' },
        ],
        plays: [],
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

async function openGame() {
  location.href = 'http://localhost/?room=ABC123';
  Object.defineProperty(globalThis, 'fetch', {
    configurable: true,
    writable: true,
    value: mock(async () => new Response(JSON.stringify({ nickname: 'Ana' }))),
  });
  Object.defineProperty(globalThis, 'WebSocket', {
    configurable: true,
    writable: true,
    value: ViewportSocket,
  });
  const view = render(<App />);
  await waitFor(() => expect(ViewportSocket.latest).toBeDefined());
  const socket = ViewportSocket.latest;
  if (!socket) throw new Error('MISSING_SOCKET');

  act(() => {
    socket.onopen?.();
    socket.snapshot(playing());
  });
  await screen.findByRole('region', { name: 'Mesa da partida' });
  const menu = view.container.querySelector<HTMLDetailsElement>('details.room-menu');
  if (!menu) throw new Error('MISSING_ROOM_MENU');

  return { ...view, socket, menu };
}

afterEach(() => {
  globalThis.fetch = originalFetch;
  Object.defineProperty(globalThis, 'WebSocket', {
    configurable: true,
    writable: true,
    value: originalWebSocket,
  });
  ViewportSocket.latest = undefined;
  location.href = 'http://localhost/';
});

test('the active game keeps room settings collapsed while preserving table actions', async () => {
  const view = await openGame();

  expect(view.container.querySelector('main')?.classList.contains('game-shell')).toBe(true);
  expect(view.menu.open).toBe(false);
  expect(view.menu.hasAttribute('open')).toBe(false);
  expect(screen.getByText('Sala · ABC123')).toBeDefined();
  expect(screen.queryByRole('button', { name: 'Revanche' })).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: '3 de Copas ♥' }));
  expect(view.socket.sent.at(-1)?.action).toEqual({
    type: 'PLAY_CARD',
    card: { rank: '3', suit: 'hearts' },
    covered: false,
  });

  act(() => view.socket.snapshot({ ...playing(), sequence: 2 }));
  expect(view.menu.open).toBe(false);
  expect(view.socket.sent).toHaveLength(1);
});

test('finishing opens the room menu and keeps rematch and acknowledged leave available', async () => {
  const view = await openGame();
  const game = playing();
  const match = game.match;
  if (!match) throw new Error('MISSING_MATCH');

  act(() =>
    view.socket.snapshot({
      ...game,
      sequence: 2,
      status: 'finished',
      decisionId: null,
      outcome: { winner: 'A', reason: 'completed' },
      match: { ...match, phase: { type: 'MATCH_END', winner: 'A' }, score: { A: 12, B: 0 } },
    }),
  );
  expect(view.menu.open).toBe(true);
  expect(view.menu.querySelector('.room-result')?.textContent).toBe('Equipe A venceu a partida.');
  expect(screen.getByRole('button', { name: 'Revanche' })).toBeDefined();
  expect(screen.getByRole('button', { name: 'Sair da sala' })).toBeDefined();
  fireEvent.click(screen.getByRole('button', { name: 'Revanche' }));
  expect(view.socket.sent.at(-1)?.action).toEqual({ type: 'REMATCH' });
  expect(view.socket.sent.at(-1)?.matchId).toBe('match_one');
  expect(view.socket.sent.at(-1)?.decisionId).toBeNull();

  fireEvent.click(screen.getByRole('button', { name: 'Sair da sala' }));
  const leave = view.socket.sent.at(-1);
  expect(leave?.action).toEqual({ type: 'LEAVE' });
  expect(screen.getByRole('region', { name: 'Mesa da partida' })).toBeDefined();
  act(() =>
    view.socket.onmessage?.({
      data: JSON.stringify({ type: 'ACK', commandId: leave?.commandId, ok: true, sequence: 3 }),
    }),
  );
  expect(screen.queryByRole('region', { name: 'Mesa da partida' })).toBeNull();
  expect(screen.getByLabelText('Apelido')).toBeDefined();
  expect(view.socket.readyState).toBe(3);
});
