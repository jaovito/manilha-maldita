import { afterEach, expect, test } from 'bun:test';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { defaultRoomConfig, type RoomView } from '@truco/game-protocol';
import { App } from './index';

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

test('account feature connects welcome, profile, customization, ranking and completed-match refreshes', async () => {
  const { catalog, profile, mockFetch, response } = await import(
    '../../features/player/tests/player-fixture.test'
  );
  location.href = 'http://localhost/';
  installSocket();
  let authenticated = false;
  // Leave the initial preference empty so optional login is reachable before guest naming.
  globalThis.fetch = mockFetch(async (input, init) => {
    const path = String(input);
    if (path.endsWith('/guest') && !init?.body) return response({ code: 'UNAUTHENTICATED' }, 401);
    if (path.endsWith('/features')) return response({ accounts: true });
    if (path.endsWith('/accounts/progression'))
      return authenticated ? response(profile) : response({ code: 'UNAUTHENTICATED' }, 401);
    if (path.endsWith('/catalog')) return response(catalog);
    if (path.includes('/ranking')) return response({ entries: [], nextPage: null });
    if (path.endsWith('/rooms')) return response({ code: 'ABC123' });
    return response({ nickname: 'Ana' });
  });
  render(<App />);
  fireEvent.click(await screen.findByRole('button', { name: 'Entrar na conta' }));
  fireEvent.click(screen.getByRole('button', { name: 'Fechar painel' }));
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  fireEvent.change(screen.getByLabelText('Apelido'), { target: { value: 'Ana' } });
  fireEvent.click(screen.getByRole('button', { name: 'Continuar' }));
  fireEvent.click(screen.getByRole('button', { name: /^Cosméticos/ }));
  await screen.findByRole('tab', { name: 'Mesas' });
  fireEvent.click(screen.getByRole('button', { name: 'Voltar ao menu' }));
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  fireEvent.click(screen.getByRole('button', { name: 'Ranking global' }));
  await screen.findByText('Ainda não há jogadores pontuando.');
  fireEvent.click(screen.getByRole('button', { name: 'Fechar painel' }));
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  fireEvent.click(screen.getByRole('button', { name: 'Entrar na conta' }));
  fireEvent.click(screen.getByRole('button', { name: 'Fechar painel' }));
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  authenticated = true;
  act(() => window.dispatchEvent(new Event('focus')));
  await screen.findByRole('button', { name: 'Minha conta' });
  fireEvent.click(screen.getByRole('button', { name: 'Editar nome' }));
  fireEvent.click(screen.getByRole('button', { name: 'Fechar painel' }));
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  fireEvent.click(screen.getByRole('button', { name: 'Criar sala' }));
  await act(async () => {
    await Promise.resolve();
  });
  expect(screen.queryByRole('alert')?.textContent).toBeUndefined();
  await waitFor(() => expect(Socket.instances).toHaveLength(1));
  const ws = socket();
  const timeout = globalThis.setTimeout;
  const originalTimeout = globalThis.setTimeout;
  Object.defineProperty(globalThis, 'setTimeout', {
    configurable: true,
    writable: true,
    value: (callback: TimerHandler, delay?: number, ...args: unknown[]) =>
      timeout(callback, [1000, 3000, 6000].includes(delay ?? 0) ? 0 : delay, ...args),
  });
  try {
    act(() => {
      ws.onopen?.();
      ws.snapshot({
        ...playing(),
        status: 'finished',
        selfSeat: 1,
        outcome: { winner: 'A', reason: 'abandonment' },
      });
    });
    await screen.findByRole('dialog', { name: 'Resultado da partida' });
    await act(async () => {
      await new Promise((resolve) => timeout(resolve, 10));
    });
    fireEvent.click(screen.getByRole('button', { name: 'Sair da sala' }));
    await screen.findByRole('button', { name: 'Minha conta' });
  } finally {
    globalThis.setTimeout = originalTimeout;
  }
});
