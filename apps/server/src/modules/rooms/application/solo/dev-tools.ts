import { cardKey, type Card } from '@truco/game-core/cards';
import { dealNextHand } from '@truco/game-core/match';
import type { ClientMessage } from '@truco/game-protocol';
import { openTransition } from '../match/transitions';
import type { Ports, Room } from '../state/types';
import { choices, powerSetup } from '../state/randomness';

/** This trusted tooling path is restricted to the owner's solo development room. */
export function resetDevelopmentHand(
  room: Room,
  seat: number,
  message: ClientMessage,
  ports: Ports,
): void {
  if (!room.devTools || !room.solo || seat !== room.hostSeat) throw new Error('DEV_TOOLS_DISABLED');

  const state = room.match;
  const action = message.action;

  if (room.status !== 'playing' || !state || action.type !== 'DEV_RESET_HAND')
    throw new Error('INVALID_PHASE');
  if (message.matchId !== room.matchId || message.decisionId !== (room.clock?.decisionId ?? null))
    throw new Error('STALE_CONTEXT');
  if (message.expectedRevision !== state.revision) throw new Error('STALE_REVISION');
  if (action.cards && new Set(action.cards.map(cardKey)).size !== 3)
    throw new Error('DUPLICATE_CARDS');
  if (action.power && (state.score.A === 11 || state.score.B === 11))
    throw new Error('POWER_UNAVAILABLE');

  // A fresh deal clears plays, commitments, intel and pending negotiations, retaining the score.
  let next = dealNextHand(
    { ...state, phase: { type: 'HAND_END', winner: 'tie', reward: 0 } },
    state.revision,
    choices(ports),
    powerSetup(room, ports),
  ).state;

  if (action.cards) {
    const hands = next.hand.hands.map((cards) => [...cards]);
    const own = hands[seat];
    if (!own) throw new Error('NOT_MEMBER');

    const stock = [...next.hand.stock];
    const vira = [next.hand.vira];
    const groups: Card[][] = [...hands, stock, vira];

    for (const [index, desired] of action.cards.entries()) {
      const old = own[index];
      if (!old) throw new Error('INVALID_PHASE');

      for (const group of groups) {
        const source = group.findIndex((card) => cardKey(card) === cardKey(desired));
        if (source < 0) continue;

        group[source] = old;
        own[index] = { ...desired };
        break;
      }
    }

    next = { ...next, hand: { ...next.hand, hands, stock, vira: vira[0] ?? next.hand.vira } };
  }

  if (next.powers)
    next = {
      ...next,
      powers: {
        ...next.powers,
        slots: next.powers.slots.map((power, owner) =>
          owner === seat ? (action.power ?? power) : power,
        ),
        energy: next.powers.energy.map((energy, owner) =>
          owner === seat ? (action.energy ?? energy) : energy,
        ),
      },
    };

  room.match = next;
  room.botWake = null;
  for (const member of room.seats) {
    if (member) member.strikes = 0;
  }
  openTransition(room, ports, 'deal');
}
