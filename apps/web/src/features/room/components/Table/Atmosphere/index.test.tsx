import { expect, test } from 'bun:test';
import { render } from '@testing-library/react';
import { defaultRoomConfig, type RoomView } from '@truco/game-protocol';
import { TableAtmosphere } from './index';

function dealingRoom(playerCount: 2 | 4 = 2): RoomView {
  return {
    code: 'ABC123',
    sequence: 1,
    roomRevision: 0,
    status: 'playing',
    hostSeat: 0,
    selfSeat: 0,
    seats: Array.from({ length: playerCount }, () => null),
    config: { ...defaultRoomConfig, format: playerCount === 4 ? '2v2' : '1v1' },
    matchId: 'public-match-context',
    decisionId: null,
    deadline: null,
    paused: false,
    transition: { id: 'public-deal-context', kind: 'deal', until: 900 },
    match: {
      seat: 0,
      playerCount,
      revision: 1,
      score: { A: 0, B: 0 },
      phase: { type: 'PREPARATION' },
      hand: {
        number: 1,
        kind: 'normal',
        leader: 0,
        elevenTeam: null,
        trickLeader: 0,
        vira: { rank: 'Q', suit: 'clubs' },
        hands: [],
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
    outcome: null,
  };
}

test('deals three anonymous backs to each relative seat without exposing projected cards or ids', () => {
  const room = dealingRoom();
  const view = render(<TableAtmosphere room={room} />);
  const overlay = view.container.querySelector('.table-atmosphere');
  expect(overlay?.getAttribute('aria-hidden')).toBe('true');
  expect(overlay?.getAttribute('data-player-count')).toBe('2');
  expect(overlay?.querySelectorAll('.deal-card')).toHaveLength(6);
  expect(overlay?.querySelectorAll('.deal-relative-0')).toHaveLength(3);
  expect(overlay?.querySelectorAll('.deal-relative-1')).toHaveLength(3);
  expect(overlay?.querySelectorAll('.card-back')).toHaveLength(7);
  expect(overlay?.querySelectorAll('.card-face')).toHaveLength(0);
  expect(overlay?.textContent).toBe('');
  expect(overlay?.innerHTML).not.toContain('public-match-context');
  expect(overlay?.innerHTML).not.toContain('public-deal-context');
  expect(view.queryAllByRole('button')).toHaveLength(0);

  view.rerender(<TableAtmosphere room={{ ...dealingRoom(4), selfSeat: 3 }} />);
  const cards = view.container.querySelectorAll<HTMLElement>('.deal-card');
  expect(cards).toHaveLength(12);
  for (const relative of [0, 1, 2, 3]) {
    expect(view.container.querySelectorAll(`.deal-relative-${relative}`)).toHaveLength(3);
  }
  expect(cards[0]?.style.getPropertyValue('--deal-delay')).toBe('0ms');
  expect(cards[11]?.style.getPropertyValue('--deal-delay')).toBe('330ms');
  expect(cards[11]?.style.getPropertyValue('--deal-rotation')).toBe('7deg');
});

test('only server-confirmed deals animate; trick results, absent matches and finished games do not', () => {
  const room = dealingRoom();
  const view = render(<TableAtmosphere room={room} />);

  for (const nextRoom of [
    { ...room, transition: undefined },
    { ...room, transition: { id: 'trick', kind: 'trick' as const, until: 1000 } },
    { ...room, transition: { id: 'hand', kind: 'hand' as const, until: 1000 } },
    { ...room, match: null },
    { ...room, status: 'finished' as const },
  ]) {
    view.rerender(<TableAtmosphere room={nextRoom} />);
    expect(view.container.querySelector('.table-atmosphere')).toBeNull();
    expect(view.container.querySelector('.table-scenery')).not.toBeNull();
  }
});

test('snapshot refresh keeps the same deal; a new hand or transition remounts it and pause is explicit', () => {
  const room = dealingRoom();
  if (!room.match) throw new Error('MISSING_MATCH');

  const view = render(<TableAtmosphere room={room} />);
  const first = view.container.querySelector('.table-atmosphere');
  view.rerender(<TableAtmosphere room={{ ...room, sequence: 2, paused: true }} />);
  expect(view.container.querySelector('.table-atmosphere')).toBe(first);
  expect(first?.getAttribute('data-paused')).toBe('true');

  view.rerender(
    <TableAtmosphere
      room={{ ...room, match: { ...room.match, hand: { ...room.match.hand, number: 2 } } }}
    />,
  );
  const nextHand = view.container.querySelector('.table-atmosphere');
  expect(nextHand).not.toBe(first);

  view.rerender(
    <TableAtmosphere
      room={{ ...room, transition: { id: 'new-deal', kind: 'deal', until: 1000 } }}
    />,
  );
  expect(view.container.querySelector('.table-atmosphere')).not.toBe(nextHand);
});
