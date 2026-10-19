import { localized } from '../../../../../shared/i18n';
import { manilhaRanks } from '../../../utils/cards';
import type { MatchView, RoomView } from '@truco/game-protocol';

export function availablePower(room: RoomView, match: MatchView) {
  const own = match.powers?.players[room.selfSeat];
  const power = own?.power;
  if (
    !power ||
    !own ||
    own.used ||
    room.paused ||
    room.transition ||
    room.status !== 'playing' ||
    match.hand.kind !== 'normal' ||
    own.energy < (power === 'spy' || power === 'mask' ? 1 : 2)
  )
    return null;

  if (power === 'spy' || power === 'exchange')
    return match.phase.type === 'PREPARATION' && !own.ready ? power : null;

  return match.phase.type === 'TURN' && match.phase.seat === room.selfSeat ? power : null;
}

export const powerInstructions = localized({
  spy: 'Espião · Escolha um verso adversário.',
  exchange: 'Segunda Chance · Escolha uma carta para trocar.',
  boost: 'Impulso · Escolha uma carta para fortalecer.',
  mask: 'Máscara · Escolha uma carta para esconder.',
});

export function hasBoostTarget(match: MatchView, seat: number): boolean {
  const hand = match.hand.hands[seat];
  return (
    hand?.visibility === 'visible' &&
    hand.cards.some((card) => card.rank !== manilhaRanks[match.hand.vira.rank] && card.rank !== '3')
  );
}
