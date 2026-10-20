import { dealNextHand, type MatchState } from '@truco/game-core/match';
import type { Ports } from '../../ports/runtime';
import { choices, powerSetup } from './randomness';
import type { RoomRuntime } from '../../state/room-runtime';
import { openDecision } from './decisions';

const durationMs = { deal: 900, trick: 1800, hand: 2400 } as const;

/** Presentation pauses belong to the room queue, never to client acknowledgements. */
export function openTransition(
  room: RoomRuntime,
  ports: Ports,
  kind: keyof typeof durationMs,
): void {
  room.clock = null;
  room.transition = { id: ports.id(), kind, until: ports.now() + durationMs[kind] };
}

export function settleGameplay(room: RoomRuntime, previous: MatchState, ports: Ports): void {
  const state = room.state.match;
  if (state === null) throw new Error('INVALID_PHASE');

  if (state.phase.type === 'HAND_END') openTransition(room, ports, 'hand');
  else if (
    state.phase.type !== 'MATCH_END' &&
    state.hand.completedTricks.length > previous.hand.completedTricks.length
  )
    openTransition(room, ports, 'trick');
  else openDecision(room, ports);
}

export function advanceTransition(room: RoomRuntime, ports: Ports): boolean {
  const transition = room.transition;
  if (transition === null || ports.now() < transition.until) return false;

  room.transition = null;

  if (transition.kind === 'hand') {
    const state = room.state.match;
    if (state?.phase.type !== 'HAND_END') throw new Error('INVALID_PHASE');

    // Delay both the deal and its entropy until the completed hand was observable.
    room.state.match = dealNextHand(
      state,
      state.revision,
      choices(ports),
      state.score.A === 11 || state.score.B === 11 ? undefined : powerSetup(room, ports),
    ).state;
    openTransition(room, ports, 'deal');
  } else {
    // A delayed server callback opens a full decision now; it cannot penalize players
    // for time during which no actionable snapshot had been published.
    openDecision(room, ports);
  }

  return true;
}
