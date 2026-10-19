import { t } from '../../../../../shared/i18n';
import type { RoomView } from '@truco/game-protocol';

export type ResultWinner = 'A' | 'B' | 'tie' | null;

export function resultPerspective(room: RoomView, winner: ResultWinner): 'win' | 'lose' | 'tie' {
  if (winner === null || winner === 'tie') return 'tie';

  return winner === (room.selfSeat % 2 === 0 ? 'A' : 'B') ? 'win' : 'lose';
}

export function resultTitle(room: RoomView, winner: ResultWinner, completed = false): string {
  if (winner === null) return t('PARTIDA ENCERRADA');
  if (winner === 'tie') return t('EMPATE!');

  const subject = room.match?.playerCount === 4 ? t('SEU TIME') : t('VOCÊ');
  return resultPerspective(room, winner) === 'win'
    ? t('{0} VENCEU{1}', [subject, completed ? '!!' : '!'])
    : t('{0} PERDEU', [subject]);
}

/** Score is only a presentation gate; the authoritative winner comes from outcome. */
export function completedVictory(room: RoomView): boolean {
  const { match, outcome } = room;
  return (
    room.status === 'finished' &&
    outcome?.reason === 'completed' &&
    outcome.winner !== null &&
    match?.phase.type === 'MATCH_END' &&
    match.phase.winner === outcome.winner &&
    match.score[outcome.winner] >= 12 &&
    resultPerspective(room, outcome.winner) === 'win'
  );
}

export function roundResult(room: RoomView) {
  const { match, transition } = room;
  if (!match || room.status !== 'playing' || !transition || transition.kind === 'deal') return null;

  if (transition.kind === 'hand' && match.phase.type === 'HAND_END') {
    return {
      key: transition.id,
      winner: match.phase.winner,
      caption: t('MÃO {0} · {1} {2}', [
        match.hand.number,
        match.phase.reward,
        match.phase.reward === 1 ? t('PONTO') : t('PONTOS'),
      ]),
    };
  }

  const trick = match.hand.completedTricks.at(-1);
  return transition.kind === 'trick' && trick
    ? {
        key: transition.id,
        winner: trick.result.winner,
        caption: t('VAZA {0}', [match.hand.completedTricks.length]),
      }
    : null;
}
