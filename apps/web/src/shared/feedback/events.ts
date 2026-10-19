import type { RoomView } from '@truco/game-protocol';
import { confirmedAcceptance, confirmedRaise } from './raises';
import type { Sound } from './audio';

function resultSound(
  winner: 'A' | 'B' | 'tie' | null,
  selfSeat: RoomView['selfSeat'],
  final: boolean,
): Sound {
  if (winner === null || winner === 'tie') return 'tie';

  const ownTeam = selfSeat % 2 === 0 ? 'A' : 'B';
  if (final) return winner === ownTeam ? 'matchWin' : 'matchLose';

  return winner === ownTeam ? 'win' : 'lose';
}

/** Observes only confirmed, authorized views and keeps no persistent match data. */
export class RoomAudioEvents {
  private previous: RoomView | null;

  constructor() {
    this.previous = null;
  }

  reset(): void {
    this.previous = null;
  }

  observe(room: RoomView): Sound[] {
    const previous = this.previous;
    this.previous = room;
    if (!previous || room.code !== previous.code || room.sequence !== previous.sequence + 1)
      return [];

    const match = room.match;
    const before = previous.match;
    if (!match) return [];
    if (!before) return room.status === 'playing' ? ['deal'] : [];
    if (room.matchId !== previous.matchId || match.revision < before.revision) return [];

    const sounds: Sound[] = [];
    const raised = confirmedRaise(previous, room);
    if (raised) sounds.push(({ 3: 'truco', 6: 'six', 9: 'nine', 12: 'twelve' } as const)[raised]);
    const accepted = confirmedAcceptance(previous, room);
    if (accepted) sounds.push('acceptRaise');
    const newHand = match.hand.number !== before.hand.number;
    if (
      newHand ||
      (room.transition?.kind === 'deal' && room.transition.id !== previous.transition?.id)
    )
      sounds.push('deal');
    if (
      !newHand &&
      (match.powers?.activations.length ?? 0) > (before.powers?.activations.length ?? 0)
    )
      sounds.push('power');
    // A single accepted command can resolve a vaza, a hand and the match.
    // Announce the most significant result once, from the public winner only.
    const finished = room.status === 'finished' || match.phase.type === 'MATCH_END';
    const wasFinished = previous.status === 'finished' || before.phase.type === 'MATCH_END';
    let result: Sound | null = null;
    if (finished && !wasFinished) {
      const winner = room.outcome
        ? room.outcome.winner
        : match.phase.type === 'MATCH_END'
          ? match.phase.winner
          : null;
      result = resultSound(winner, room.selfSeat, true);
    } else if (!finished && match.phase.type === 'HAND_END' && before.phase.type !== 'HAND_END') {
      result = resultSound(match.phase.winner, room.selfSeat, false);
    } else if (
      !finished &&
      !newHand &&
      match.hand.completedTricks.length > before.hand.completedTricks.length
    ) {
      result = resultSound(
        match.hand.completedTricks.at(-1)?.result.winner ?? null,
        room.selfSeat,
        false,
      );
    }
    if (result) sounds.push(result);
    if (
      !result &&
      !accepted &&
      !room.transition &&
      !room.paused &&
      room.status === 'playing' &&
      match.phase.type === 'TURN' &&
      match.phase.seat === room.selfSeat &&
      (room.decisionId !== previous.decisionId || previous.paused)
    )
      sounds.push('turn');

    return sounds;
  }
}

export function interactionSound(target: EventTarget | null): Sound | null {
  if (!(target instanceof Element)) return null;

  const control = target.closest(
    'button, summary, input[type="radio"], input[type="checkbox"], select',
  );
  if (
    !control ||
    control.closest('[data-audio-controls]') ||
    control.matches(':disabled') ||
    control.closest('[aria-disabled="true"]')
  )
    return null;
  if (control.matches('.card, .spy-target-card, .power-card')) return 'select';
  if (control.matches('summary, select') || control.closest('.main-menu')) return 'menu';

  return 'click';
}
