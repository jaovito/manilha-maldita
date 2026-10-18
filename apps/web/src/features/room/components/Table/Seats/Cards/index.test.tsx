import { expect, mock, test } from 'bun:test';
import { fireEvent, render, screen, within } from '@testing-library/react';
import type { MatchView, RoomView } from '@truco/game-protocol';
import { Table } from '../..';
import { powered } from '../../Powers/index.test';

function fourPlayers(): RoomView & { match: MatchView } {
  const state = powered('spy');
  return {
    ...state,
    seats: ['Ana', 'Bia', 'Caio', 'Dani'].map((nickname, seat) => ({
      seat,
      nickname,
      ready: false,
      connected: true,
    })),
    match: {
      ...state.match,
      playerCount: 4,
      hand: {
        ...state.match.hand,
        hands: [
          ...state.match.hand.hands,
          { seat: 2, count: 3, visibility: 'hidden' },
          { seat: 3, count: 3, visibility: 'hidden' },
        ],
      },
      powers: {
        players: [
          { seat: 0, power: 'spy', energy: 2, used: false, ready: false },
          ...[1, 2, 3].map((seat) => ({ seat, power: null, energy: 2, used: false, ready: false })),
        ],
        activations: [],
        intel: null,
      },
    },
  };
}

test('spy targets only enemy backs, reveals the result at the clicked back and keeps a historical observation after an opaque play', () => {
  const state = fourPlayers();
  const send = mock(() => {});
  const view = render(<Table room={state} send={send} />);
  fireEvent.click(screen.getByRole('button', { name: 'Poder Espião' }));
  expect(screen.getAllByRole('button', { name: /^Espionar carta/ })).toHaveLength(6);
  expect(screen.queryByRole('button', { name: /de Caio/ })).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Espionar carta 2 de Bia' }));
  expect(send).toHaveBeenLastCalledWith({ type: 'PREPARE', intent: { type: 'spy', target: 1 } });
  expect(screen.queryByRole('img', { name: /Espião · Só você/ })).toBeNull();
  if (!state.match.powers) throw new Error('NO_POWERS');
  const revealed: RoomView & { match: MatchView } = {
    ...state,
    decisionId: 'turn',
    match: {
      ...state.match,
      phase: { type: 'TURN', seat: 1 },
      powers: {
        ...state.match.powers,
        players: state.match.powers.players.map((p) =>
          p.seat === 0 ? { ...p, used: true, ready: true, energy: 1 } : p,
        ),
        intel: { target: 1, card: { rank: 'A', suit: 'clubs' } },
        activations: [{ seat: 0, power: 'spy', target: 1 }],
      },
    },
  };
  view.rerender(<Table room={revealed} send={send} />);
  const bia = screen.getByRole('region', { name: 'Bia, adversário' });
  expect(within(bia).getByRole('img', { name: /Espião · Só você: A de Paus/ })).toBeDefined();
  expect(
    bia.querySelector('.seat-cards > .mini-card:nth-child(2) .spy-observation'),
  ).not.toBeNull();
  expect(bia.querySelector('.spy-memory')).toBeNull();

  const masked = {
    ...revealed,
    match: {
      ...revealed.match,
      hand: {
        ...revealed.match.hand,
        plays: [{ seat: 1, covered: false as const, power: 'mask' as const }],
        hands: revealed.match.hand.hands.map((h) => (h.seat === 1 ? { ...h, count: 2 } : h)),
      },
    },
  };
  view.rerender(<Table room={masked} send={send} />);
  expect(screen.getByRole('img', { name: 'Carta mascarada' })).toBeDefined();
  expect(bia.querySelector('.spy-memory')).not.toBeNull();
  expect(bia.querySelectorAll('.seat-cards > .mini-card')).toHaveLength(3);
  expect(within(bia).getByRole('img', { name: /Vista na preparação/ })).toBeDefined();
  expect(screen.queryByText(/Só você · Espião: Bia tinha/)).toBeNull();

  view.unmount();
  const resumed = render(<Table room={masked} send={send} />);
  expect(screen.getByRole('img', { name: /Espião · Só você: A de Paus/ })).toBeDefined();
  resumed.rerender(<Table room={state} send={send} />);
  expect(screen.queryByRole('img', { name: /Espião · Só você/ })).toBeNull();
});

test('a recipient without private intel sees only backs and new contexts cancel an unfinished spy selection', () => {
  const state = fourPlayers();
  const send = mock(() => {});
  const view = render(<Table room={state} send={send} />);
  expect(screen.queryByRole('img', { name: /Espião · Só você/ })).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Poder Espião' }));
  view.rerender(<Table room={{ ...state, decisionId: 'other' }} send={send} />);
  expect(screen.queryByRole('button', { name: /^Espionar carta/ })).toBeNull();
  expect(send).not.toHaveBeenCalled();
});
