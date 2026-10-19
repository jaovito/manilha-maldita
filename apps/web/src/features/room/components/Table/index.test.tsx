import { expect, mock, test } from 'bun:test';
import { fireEvent, render, screen } from '@testing-library/react';
import { defaultRoomConfig, type RoomView } from '@truco/game-protocol';
import { Table } from './index';

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
export function playing(): RoomView {
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
test('table sends only explicit card actions, distinguishes covered plays and handles every decision', () => {
  const state = playing();
  if (!state.match) throw new Error('MISSING_MATCH');
  const send = mock(() => {});
  const view = render(<Table room={state} send={send} />);
  fireEvent.click(screen.getByRole('button', { name: '3 de Copas ♥' }));
  fireEvent.click(screen.getByRole('button', { name: 'Pedir Truco / aumentar' }));
  expect(screen.getByText(/Carta coberta/)).toBeDefined();
  const second = {
    ...state.match,
    hand: {
      ...state.match.hand,
      completedTricks: [
        { leader: 0, plays: [], result: { winner: 'tie' as const, nextLeader: 0 } },
      ],
    },
  };
  view.rerender(<Table room={{ ...state, match: second }} send={send} />);
  fireEvent.click(screen.getByLabelText('Jogar coberta (a partir da segunda vaza)'));
  fireEvent.click(screen.getByRole('button', { name: '3 de Copas ♥' }));
  view.rerender(
    <Table
      room={{
        ...state,
        match: {
          ...state.match,
          phase: { type: 'RAISE_RESPONSE' },
          hand: {
            ...state.match.hand,
            betting: { acceptedStake: 1, pendingStake: 3, lastRaisingTeam: 'B', resumeTurnSeat: 1 },
          },
        },
      }}
      send={send}
    />,
  );
  for (const name of ['Aceitar', 'SEEEIS!', 'Correr'])
    fireEvent.click(screen.getByRole('button', { name: new RegExp(`^${name}$`) }));
  view.rerender(
    <Table
      room={{ ...state, match: { ...state.match, phase: { type: 'ELEVEN_DECISION', team: 'A' } } }}
      send={send}
    />,
  );
  fireEvent.click(screen.getByRole('button', { name: 'Jogar por 3' }));
  fireEvent.click(screen.getByRole('button', { name: 'Correr por 1' }));
  fireEvent.click(screen.getByRole('button', { name: 'Desistir da partida' }));
  expect(send).toHaveBeenCalledTimes(9);
  view.rerender(<Table room={{ ...state, paused: true }} send={send} />);
  expect(screen.getByText('Partida pausada para reconexão')).toBeDefined();
  view.rerender(
    <Table
      room={{ ...state, status: 'finished', outcome: { winner: 'A', reason: 'completed' } }}
      send={send}
    />,
  );
  expect(screen.getByText(/Equipe A venceu/)).toBeDefined();
  view.rerender(<Table room={room()} send={send} />);
  expect(screen.queryByRole('region', { name: 'Mesa da partida' })).toBeNull();
});

test('2v2 seats rotate around the viewer and only authorized eleven partner cards appear', () => {
  const base = playing();
  if (!base.match) throw new Error('MISSING_MATCH');
  const state: RoomView = {
    ...base,
    selfSeat: 1,
    config: { ...base.config, format: '2v2' },
    seats: ['Ana', 'Beto', 'Caio', 'Dora'].map((nickname, seat) => ({
      seat,
      nickname,
      connected: seat !== 2,
      ready: true,
    })),
    match: {
      ...base.match,
      seat: 1,
      playerCount: 4,
      phase: { type: 'TURN', seat: 2 },
      hand: {
        ...base.match.hand,
        plays: [],
        hands: [
          { seat: 0, count: 3, visibility: 'hidden' },
          { seat: 1, count: 1, visibility: 'visible', cards: [{ rank: '7', suit: 'diamonds' }] },
          { seat: 2, count: 3, visibility: 'hidden' },
          { seat: 3, count: 3, visibility: 'hidden' },
        ],
      },
    },
  };
  const view = render(<Table room={state} send={() => {}} />);
  expect(view.container.querySelector('.seat-relative-1')?.textContent).toContain('Caio');
  expect(view.container.querySelector('.seat-relative-2')?.textContent).toContain('Dora');
  expect(view.container.querySelector('.seat-relative-3')?.textContent).toContain('Ana');
  expect(view.container.querySelector('.seat-relative-1')?.textContent).toContain('Reconectando');
  expect(view.container.querySelector('.seat-relative-1')?.classList.contains('seat-active')).toBe(
    true,
  );
  expect(view.container.querySelectorAll('.opponents .card-face')).toHaveLength(0);
  expect(view.container.querySelectorAll('.opponents .card-back')).toHaveLength(9);
  expect((screen.getByRole('button', { name: '7 de Ouros ♦' }) as HTMLButtonElement).disabled).toBe(
    true,
  );
  expect(screen.queryByText('Selecione uma carta para jogar')).toBeNull();
  expect(screen.getByText('As jogadas desta mão aparecerão aqui.')).toBeDefined();

  if (!state.match) throw new Error('MISSING_MATCH');

  const eleven: RoomView = {
    ...state,
    match: {
      ...state.match,
      phase: { type: 'ELEVEN_DECISION', team: 'B' },
      hand: {
        ...state.match.hand,
        kind: 'eleven',
        elevenTeam: 'B',
        hands: state.match.hand.hands.map((hand) =>
          hand.seat === 3
            ? { seat: 3, count: 1, visibility: 'visible', cards: [{ rank: 'K', suit: 'spades' }] }
            : hand,
        ),
      },
    },
  };
  view.rerender(<Table room={eleven} send={() => {}} />);
  expect(view.container.querySelectorAll('.seat-relative-2 .card-face')).toHaveLength(1);
  expect(screen.getByRole('img', { name: 'K de Espadas ♠' })).toBeDefined();
  expect(view.container.querySelectorAll('.opponents .card-back')).toHaveLength(6);
});

test('negotiation limit, finished games and decisive hands keep illegal actions disabled', () => {
  const state = playing();
  if (!state.match) throw new Error('MISSING_MATCH');
  const send = mock(() => {});
  const fullRaise: RoomView = {
    ...state,
    match: {
      ...state.match,
      phase: { type: 'RAISE_RESPONSE' },
      hand: {
        ...state.match.hand,
        betting: { acceptedStake: 9, pendingStake: 12, lastRaisingTeam: 'B', resumeTurnSeat: 0 },
      },
    },
  };
  const view = render(<Table room={fullRaise} send={send} />);
  expect(
    (
      screen.getByRole('button', {
        name: /SEEEIS!|NOOVE!|DOOOZE!!|Limite de 12/,
      }) as HTMLButtonElement
    ).disabled,
  ).toBe(true);
  expect((screen.getByRole('button', { name: '3 de Copas ♥' }) as HTMLButtonElement).disabled).toBe(
    true,
  );

  const decisive: RoomView = {
    ...state,
    match: {
      ...state.match,
      hand: {
        ...state.match.hand,
        kind: 'decisive',
        completedTricks: [
          {
            leader: 0,
            plays: [{ seat: 1, covered: true }],
            result: { winner: 'A', nextLeader: 0 },
          },
        ],
      },
    },
  };
  view.rerender(<Table room={decisive} send={send} />);
  expect(
    (screen.getByLabelText('Jogar coberta (a partir da segunda vaza)') as HTMLInputElement)
      .disabled,
  ).toBe(true);
  expect(
    (screen.getByRole('button', { name: 'Pedir Truco / aumentar' }) as HTMLButtonElement).disabled,
  ).toBe(true);
  expect(screen.getByText('Mão decisiva')).toBeDefined();
  expect(screen.queryByText('JOGAR CARTA')).toBeNull();
  expect(document.querySelector('.own-player .turn-badge')?.textContent).toBe('Sua vez');

  view.rerender(
    <Table
      room={{ ...state, status: 'finished', outcome: { winner: null, reason: 'technical' } }}
      send={send}
    />,
  );
  expect(screen.getByText(/Sem vencedor · falha técnica/)).toBeDefined();
  expect(screen.queryByRole('button', { name: 'Desistir da partida' })).toBeNull();
  expect((screen.getByRole('button', { name: '3 de Copas ♥' }) as HTMLButtonElement).disabled).toBe(
    true,
  );
});

test('public trick history uses authorized cards, preserves covered identities and shows the last trick', () => {
  const state = playing();
  if (!state.match) throw new Error('MISSING_MATCH');
  const view = render(
    <Table
      room={{
        ...state,
        match: {
          ...state.match,
          hand: {
            ...state.match.hand,
            plays: [],
            completedTricks: [
              {
                leader: 0,
                plays: [
                  { seat: 0, covered: false, card: { rank: 'A', suit: 'clubs' } },
                  { seat: 1, covered: true },
                ],
                result: { winner: 'A', nextLeader: 0 },
              },
            ],
          },
        },
      }}
      send={() => {}}
    />,
  );
  expect(screen.getByRole('img', { name: 'A de Paus ♣' })).toBeDefined();
  expect(screen.getByRole('img', { name: 'Carta coberta' })).toBeDefined();
  expect(screen.getByText('Vaza 1 · Equipe A')).toBeDefined();
  expect(view.container.querySelectorAll('.center-plays .card-back')).toHaveLength(1);
  expect(view.container.querySelectorAll('.center-plays .card-face')).toHaveLength(1);
});

test('covered selection resets only when the server confirms consumption of the played card', () => {
  const state = playing();
  if (!state.match) throw new Error('MISSING_MATCH');

  state.match.hand.hands = [
    {
      seat: 0,
      count: 2,
      visibility: 'visible',
      cards: [
        { rank: '3', suit: 'hearts' },
        { rank: '4', suit: 'clubs' },
      ],
    },
    { seat: 1, count: 2, visibility: 'hidden' },
  ];
  state.match.hand.completedTricks = [
    { leader: 0, plays: [], result: { winner: 'tie', nextLeader: 0 } },
  ];

  const send = mock(() => {});
  const view = render(<Table room={state} send={send} />);
  const checkbox = screen.getByLabelText(
    'Jogar coberta (a partir da segunda vaza)',
  ) as HTMLInputElement;

  fireEvent.click(checkbox);
  fireEvent.click(screen.getByRole('button', { name: '3 de Copas ♥' }));
  expect(send).toHaveBeenLastCalledWith({
    type: 'PLAY_CARD',
    card: { rank: '3', suit: 'hearts' },
    covered: true,
  });
  expect(checkbox.checked).toBe(true);

  // A rejected command or unrelated snapshot must not consume the selection.
  view.rerender(<Table room={{ ...state, sequence: 2, decisionId: 'other' }} send={send} />);
  expect(checkbox.checked).toBe(true);

  const confirmed: RoomView = {
    ...state,
    sequence: 3,
    match: {
      ...state.match,
      hand: {
        ...state.match.hand,
        hands: [
          { seat: 0, count: 1, visibility: 'visible', cards: [{ rank: '4', suit: 'clubs' }] },
          { seat: 1, count: 2, visibility: 'hidden' },
        ],
      },
    },
  };
  view.rerender(<Table room={confirmed} send={send} />);
  expect(checkbox.checked).toBe(false);
  fireEvent.click(screen.getByRole('button', { name: '4 de Paus ♣' }));
  expect(send).toHaveBeenLastCalledWith({
    type: 'PLAY_CARD',
    card: { rank: '4', suit: 'clubs' },
    covered: false,
  });

  fireEvent.click(checkbox);
  expect(checkbox.checked).toBe(true);
  view.rerender(<Table room={{ ...confirmed, matchId: 'rematch' }} send={send} />);
  expect(checkbox.checked).toBe(false);
});
