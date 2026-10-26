import { defaultRoomConfig, type RoomView } from '@truco/game-protocol';

export function resultRoom(): RoomView {
  return {
    code: 'ABC123',
    sequence: 2,
    roomRevision: 0,
    status: 'finished',
    hostSeat: 0,
    selfSeat: 0,
    seats: [],
    config: defaultRoomConfig,
    matchId: 'match_one',
    decisionId: null,
    deadline: null,
    paused: false,
    outcome: { reason: 'completed', winner: 'A' },
    match: {
      seat: 0,
      playerCount: 2,
      revision: 5,
      score: { A: 12, B: 6 },
      phase: { type: 'MATCH_END', winner: 'A' },
      hand: {
        number: 2,
        kind: 'normal',
        leader: 0,
        elevenTeam: null,
        trickLeader: 0,
        vira: { rank: 'Q', suit: 'diamonds' },
        hands: [],
        plays: [],
        betting: {
          acceptedStake: 1,
          pendingStake: null,
          lastRaisingTeam: null,
          resumeTurnSeat: null,
        },
        completedTricks: [
          {
            leader: 0,
            result: { winner: 'A', nextLeader: 0 },
            plays: [
              { seat: 0, covered: false, card: { rank: '3', suit: 'clubs' } },
              { seat: 1, covered: false, card: { rank: '4', suit: 'clubs' } },
            ],
          },
        ],
      },
    },
  };
}
