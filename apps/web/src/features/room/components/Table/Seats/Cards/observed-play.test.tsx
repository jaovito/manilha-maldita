import { expect, mock, test } from 'bun:test';
import { render, screen, within } from '@testing-library/react';
import type { MatchView, RoomView } from '@truco/game-protocol';
import { Table } from '../..';
import { powered } from '../../Powers/index.test';

type State = RoomView & { match: MatchView };
const observed = { rank: 'K', suit: 'spades' } as const;

function fixture(count: 2 | 4): State {
  const room = powered('spy', false);
  if (!room.match.powers) throw new Error('NO_POWERS');

  return {
    ...room,
    seats: ['Ana', 'Bia', ...(count === 4 ? ['Caio', 'Dani'] : [])].map((nickname, seat) => ({
      seat,
      nickname,
      ready: false,
      connected: true,
    })),
    match: {
      ...room.match,
      playerCount: count,
      powers: { ...room.match.powers, intel: { target: 1, card: observed } },
      hand: {
        ...room.match.hand,
        hands: [
          ...room.match.hand.hands,
          ...(count === 4
            ? [
                { seat: 2, count: 3, visibility: 'hidden' as const },
                { seat: 3, count: 3, visibility: 'hidden' as const },
              ]
            : []),
        ],
      },
    },
  };
}

function withPlays(room: State, plays: MatchView['hand']['plays']): State {
  return {
    ...room,
    match: {
      ...room.match,
      hand: {
        ...room.match.hand,
        plays,
        hands: room.match.hand.hands.map((hand) =>
          hand.seat === 1 ? { ...hand, count: 2 } : hand,
        ),
      },
    },
  };
}

function observation() {
  return within(screen.getByRole('region', { name: 'Bia, adversário' })).queryByRole('img', {
    name: /Espião · Só você/,
  });
}

for (const count of [2, 4] as const) {
  test(`${count} players remove the observed face from the enemy seat when openly played, including reconnect and completed tricks`, () => {
    const room = fixture(count);
    const send = mock(() => {});
    const view = render(<Table room={room} send={send} />);
    expect(observation()).not.toBeNull();

    const played = withPlays(room, [{ seat: 1, covered: false, card: observed }]);
    view.rerender(<Table room={played} send={send} />);
    expect(observation()).toBeNull();
    expect(
      within(screen.getByRole('region', { name: 'Cartas na mesa' })).getByRole('img', {
        name: 'K de Espadas ♠',
      }),
    ).toBeDefined();
    expect(
      screen.getByRole('region', { name: 'Bia, adversário' }).querySelectorAll('.card-back'),
    ).toHaveLength(2);

    const completed = {
      ...played,
      match: {
        ...played.match,
        hand: {
          ...played.match.hand,
          plays: [],
          completedTricks: [
            {
              leader: 1,
              plays: played.match.hand.plays,
              result: { winner: 'B' as const, nextLeader: 1 },
            },
          ],
        },
      },
    };
    view.rerender(<Table room={completed} send={send} />);
    expect(observation()).toBeNull();
    view.unmount();
    const resumed = render(<Table room={completed} send={send} />);
    expect(observation()).toBeNull();
    resumed.unmount();
    expect(send).not.toHaveBeenCalled();
  });
}

test('nonmatching ranks, suits and seats do not erase the observation; opaque plays do not reveal whether it left', () => {
  const room = fixture(4);
  const view = render(<Table room={room} send={mock(() => {})} />);
  for (const play of [
    { seat: 1, covered: false, card: { rank: 'Q', suit: 'spades' } },
    { seat: 1, covered: false, card: { rank: 'K', suit: 'hearts' } },
    { seat: 3, covered: false, card: observed },
    { seat: 1, covered: true },
    { seat: 1, covered: false, power: 'mask' },
  ] satisfies MatchView['hand']['plays']) {
    view.rerender(<Table room={withPlays(room, [play])} send={mock(() => {})} />);
    expect(observation()).not.toBeNull();
  }
});

test('a mask removes the observation only after its face is revealed; an empty hand never keeps it', () => {
  const room = fixture(2);
  const masked = withPlays(room, [{ seat: 1, covered: false, power: 'mask' }]);
  const view = render(<Table room={masked} send={mock(() => {})} />);
  expect(observation()).not.toBeNull();
  const resolved = {
    ...masked,
    match: {
      ...masked.match,
      hand: {
        ...masked.match.hand,
        plays: [],
        completedTricks: [
          {
            leader: 1,
            plays: [{ seat: 1, covered: false as const, power: 'mask' as const, card: observed }],
            result: { winner: 'B' as const, nextLeader: 1 },
          },
        ],
      },
    },
  };
  view.rerender(<Table room={resolved} send={mock(() => {})} />);
  expect(observation()).toBeNull();

  view.rerender(
    <Table
      room={{
        ...masked,
        match: {
          ...masked.match,
          hand: {
            ...masked.match.hand,
            hands: masked.match.hand.hands.map((hand) =>
              hand.seat === 1 ? { ...hand, count: 0 } : hand,
            ),
          },
        },
      }}
      send={mock(() => {})}
    />,
  );
  expect(observation()).toBeNull();
});
