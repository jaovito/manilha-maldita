import { defaultRoomConfig, type MatchView, type RoomView } from '@truco/game-protocol';
import { t } from '../../../../../shared/i18n';
import type { GuidedLesson } from './lessons';

type Card = MatchView['hand']['vira'];
export const exampleHand: readonly Card[] = [
  { rank: 'Q', suit: 'clubs' },
  { rank: '3', suit: 'hearts' },
  { rank: '2', suit: 'diamonds' },
];

/** Public, authored examples only. This adapter never joins or changes a real room. */
export function tutorialScenario(lesson: GuidedLesson, done: boolean): RoomView {
  const hand = exampleHand.map((card, index): Card => {
    if (index === 1 && lesson.id === 'trump') return { rank: '3', suit: 'clubs' };
    if (index === 2 && lesson.id === 'suit-play') return { rank: '2', suit: 'clubs' };
    if (index === 0 && (lesson.id === 'boost' || (lesson.id === 'exchange' && done)))
      return { rank: '7', suit: 'spades' };
    return card;
  });
  const enemy: Card =
    lesson.id === 'trump'
      ? { rank: '3', suit: 'hearts' }
      : lesson.id === 'suit-play'
        ? { rank: '2', suit: 'hearts' }
        : { rank: 'K', suit: 'spades' };
  const played =
    done && (lesson.action === 'card' || lesson.id === 'boost' || lesson.id === 'mask');
  const preparation = lesson.power === 'spy' || lesson.power === 'exchange';
  const power = lesson.power ?? 'mask';
  const cost = power === 'boost' || power === 'exchange' ? 2 : 1;
  const own = hand.filter((_, index) => !played || index !== lesson.card);
  const plays: Array<MatchView['hand']['plays'][number]> = [];
  if (['low', 'trump', 'suit-play'].includes(lesson.id) || played)
    plays.push({ seat: 1, card: enemy, covered: false });
  const chosen = lesson.card === undefined ? undefined : hand[lesson.card];
  if (played && chosen)
    plays.push({
      seat: 0,
      card: chosen,
      covered: false,
      ...(lesson.id === 'boost' || lesson.id === 'mask' ? { power: lesson.id } : {}),
    });
  if (lesson.id === 'tie') {
    plays.push(
      { seat: 1, card: { rank: 'K', suit: 'diamonds' }, covered: false },
      { seat: 0, card: { rank: 'K', suit: 'clubs' }, covered: false },
    );
  }
  if (lesson.id === 'covered')
    plays.push({ seat: 1, covered: true }, { seat: 0, covered: false, power: 'mask' });

  return {
    code: 'GUIADO',
    sequence: done ? 2 : 1,
    roomRevision: 0,
    status: 'playing',
    hostSeat: 0,
    selfSeat: 0,
    seats: [
      { seat: 0, nickname: t('Você'), connected: true, ready: false },
      { seat: 1, nickname: t('Seu adversário'), connected: true, ready: false },
    ],
    config: { ...defaultRoomConfig },
    matchId: `tutorial-${lesson.id}`,
    decisionId: `tutorial-${lesson.id}-${done}`,
    deadline: null,
    paused: false,
    outcome: null,
    match: {
      seat: 0,
      playerCount: 2,
      revision: done ? 2 : 1,
      score: { A: 0, B: 0 },
      phase: preparation ? { type: 'PREPARATION' } : { type: 'TURN', seat: 0 },
      hand: {
        number: 1,
        kind: 'normal',
        leader: 1,
        elevenTeam: null,
        trickLeader: 1,
        vira: { rank: 'A', suit: 'diamonds' },
        hands: [
          { seat: 0, count: own.length, visibility: 'visible', cards: own },
          { seat: 1, count: plays.some((play) => play.seat === 1) ? 2 : 3, visibility: 'hidden' },
        ],
        plays,
        completedTricks: [],
        betting: {
          acceptedStake: lesson.id === 'raise' && done ? 3 : 1,
          pendingStake: null,
          lastRaisingTeam: lesson.id === 'raise' && done ? 'B' : null,
          resumeTurnSeat: null,
        },
      },
      powers: {
        players: [
          {
            seat: 0,
            power,
            energy: done && lesson.power ? 2 - cost : 2,
            used: done && Boolean(lesson.power),
            ready: done && preparation,
          },
          { seat: 1, power: null, energy: 2, used: false, ready: false },
        ],
        activations:
          done && lesson.power ? [{ seat: 0, power, target: power === 'spy' ? 1 : 0 }] : [],
        intel: lesson.id === 'spy' && done ? { target: 1, card: enemy } : null,
      },
    },
  };
}
