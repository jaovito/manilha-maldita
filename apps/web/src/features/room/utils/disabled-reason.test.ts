import { expect, test } from 'bun:test';
import { defaultRoomConfig, type RoomView } from '@truco/game-protocol';
import { gameplayDisabledReason } from './disabled-reason';

test('gameplay unavailability explains lifecycle before actions without reading hidden information', () => {
  const room: RoomView = {
    code: 'ABC123',
    sequence: 0,
    roomRevision: 0,
    status: 'playing',
    hostSeat: 0,
    selfSeat: 0,
    seats: [],
    config: defaultRoomConfig,
    matchId: 'match_one',
    decisionId: null,
    deadline: null,
    paused: false,
    match: null,
    outcome: null,
  };
  expect(gameplayDisabledReason(room)).toBeNull();
  expect(gameplayDisabledReason({ ...room, status: 'finished', paused: true })).toContain(
    'partida terminou',
  );
  expect(gameplayDisabledReason({ ...room, paused: true })).toContain('reconecta');
  expect(
    gameplayDisabledReason({ ...room, transition: { id: 'deal_one', kind: 'deal', until: 100 } }),
  ).toContain('distribuição');
  for (const kind of ['trick', 'hand'] as const)
    expect(
      gameplayDisabledReason({ ...room, transition: { id: 'transition_one', kind, until: 100 } }),
    ).toContain('resultado');
});
