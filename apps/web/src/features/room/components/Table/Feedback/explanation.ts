import { t } from '../../../../../shared/i18n';
import type { MatchView, RoomView } from '@truco/game-protocol';
import { cardLabel, manilhaRanks } from '../../../utils/cards';

type Trick = MatchView['hand']['completedTricks'][number];

/** Explain only the result and faces already authorized by the server. */
export function explainTrick(room: RoomView, match: MatchView, trick: Trick): string {
  const name = room.seats[trick.result.nextLeader]?.nickname ?? t('Jogador');
  if (trick.result.winner === 'tie')
    return t('Empate entre equipes. {0} continua abrindo.', [name]);

  const play = trick.plays.find((entry) => entry.seat === trick.result.nextLeader);
  if (!play || !('card' in play) || play.covered)
    return t('{0} fez a jogada vencedora e abre a próxima vaza.', [name]);

  const power = 'power' in play ? play.power : undefined;
  const detail =
    play.card.rank === manilhaRanks[match.hand.vira.rank]
      ? t('manilha')
      : power === 'boost'
        ? t('fortalecida por Impulso')
        : power === 'mask'
          ? t('revelada pela Máscara')
          : t('maior força da vaza');

  return `${name}: ${cardLabel(play.card)} · ${detail}.`;
}

export function explainHand(match: MatchView): string {
  if (match.hand.betting.pendingStake !== null) return t('Houve corrida. Vale a aposta já aceita.');
  if (match.hand.kind === 'eleven' && match.hand.completedTricks.length === 0)
    return t('A equipe de onze correu e concedeu 1 ponto.');

  const results = match.hand.completedTricks.map((trick) => trick.result.winner);
  if (results.length === 3 && results.every((result) => result === 'tie'))
    return t('Três empates: mão anulada, sem pontos.');
  if (results.length === 2 && results.includes('tie'))
    return t('Uma vitória e um empate definem a mão.');
  if (results.length === 3 && results[2] === 'tie')
    return t('Empate na terceira: vence quem ganhou a primeira vaza.');

  return t('Duas vazas vencidas definem a mão.');
}

export function resolutionFeedback(room: RoomView): { title: string; detail: string } | null {
  const match = room.match;
  if (!match || !room.transition || room.status !== 'playing') return null;
  if (room.transition.kind === 'deal')
    return {
      title: t('Distribuindo · mão {0}', [match.hand.number]),
      detail: t('Três cartas para cada jogador.'),
    };

  const ownTeam = room.selfSeat % 2 === 0 ? 'A' : 'B';
  if (room.transition.kind === 'hand' && match.phase.type === 'HAND_END') {
    const { winner, reward } = match.phase;
    return {
      title:
        winner === 'tie'
          ? t('Mão empatada · sem pontos')
          : t('{0} a mão · +{1} {2}', [
              winner === ownTeam ? t('Sua equipe venceu') : t('Adversários venceram'),
              reward,
              reward === 1 ? t('ponto') : t('pontos'),
            ]),
      detail: explainHand(match),
    };
  }

  const trick = match.hand.completedTricks.at(-1);
  if (!trick) return null;

  return {
    title:
      trick.result.winner === 'tie'
        ? t('Vaza {0} empatada', [match.hand.completedTricks.length])
        : t('{0} a vaza {1}', [
            trick.result.winner === ownTeam ? t('Sua equipe venceu') : t('Adversários venceram'),
            match.hand.completedTricks.length,
          ]),
    detail: explainTrick(room, match, trick),
  };
}

export function nextTurnLabel(room: RoomView): string {
  const match = room.match;
  if (match?.phase.type !== 'TURN') return '';
  const own = match.phase.seat === room.selfSeat;
  const last = match.hand.completedTricks.at(-1);
  if (match.hand.plays.length === 0 && last)
    return own
      ? t('Você abre a próxima vaza')
      : t('{0} abre a próxima vaza', [room.seats[match.phase.seat]?.nickname ?? t('Jogador')]);

  return own ? t('Escolha uma carta da sua mão') : t('Aguarde a jogada');
}
