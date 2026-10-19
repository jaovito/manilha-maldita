import { t, localized } from '../../../shared/i18n';
import type { MatchView } from '@truco/game-protocol';

export type Card = MatchView['hand']['vira'];
export const suits = localized({
  diamonds: 'Ouros ♦',
  spades: 'Espadas ♠',
  hearts: 'Copas ♥',
  clubs: 'Paus ♣',
});

export function cardLabel(card: Card): string {
  return t('{0} de {1}', [card.rank, suits[card.suit]]);
}

export const manilhaRanks = {
  '4': '5',
  '5': '6',
  '6': '7',
  '7': 'Q',
  Q: 'J',
  J: 'K',
  K: 'A',
  A: '2',
  '2': '3',
  '3': '4',
};
